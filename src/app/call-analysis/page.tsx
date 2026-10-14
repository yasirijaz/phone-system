"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  FileSearch,
} from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import AppHeader from "@/components/app-header";
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DateRangePicker,
  createDefaultDateRange,
  toDateInputValue,
  type DateRangeValue,
} from "@/components/date-range-picker";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { canAccessCallAnalysis } from "@/lib/roles";
import { formatPhoneNumber, cn } from "@/lib/utils";
import {
  AnalysisWidgetFields,
  IntentTag,
} from "@/components/analysis-widget-fields";
import WindshieldHubTimeline from "@/components/windshield-hub-timeline";
import {
  getCallAnalysisDetail,
  getCallAnalysisList,
  runCallAnalysis,
  type CallAnalysisDetail,
  type CallAnalysisFilter,
  type CallAnalysisListItem,
} from "@/services/callAnalysisService";
import type { LiveCallAnalysis, LiveTranscriptSegment } from "@/services/liveCallService";

function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function formatDuration(seconds?: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatSegmentTime(at?: string): string {
  if (!at) return "";
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function DirectionBadge({ direction }: { direction?: string | null }) {
  const isOutbound = (direction || "").toLowerCase().startsWith("outbound");
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        isOutbound ? "bg-sky-50 text-sky-700" : "bg-emerald-50 text-emerald-700"
      )}
    >
      {isOutbound ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
      {isOutbound ? "Outbound" : "Inbound"}
    </span>
  );
}

function agendaLabel(analysis?: LiveCallAnalysis | null): string {
  return (
    analysis?.agenda ||
    analysis?.stage ||
    analysis?.topic ||
    analysis?.purpose ||
    "No agenda"
  );
}

function MomentBanner({ label }: { label: string }) {
  return (
    <div className="mx-auto my-1 flex max-w-[92%] items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 shadow-sm">
      <Sparkles className="h-4 w-4 shrink-0 text-rose-500" />
      <span>AI Detected: {label}</span>
    </div>
  );
}

function buildTranscriptFeed(
  segments: LiveTranscriptSegment[],
  moments?: LiveCallAnalysis["moments"]
) {
  const byAfter = new Map<number, string[]>();
  (moments || []).forEach((m) => {
    if (!m?.label) return;
    const list = byAfter.get(m.after_index) || [];
    list.push(m.label);
    byAfter.set(m.after_index, list);
  });

  const feed: Array<
    | { kind: "segment"; segment: LiveTranscriptSegment; index: number }
    | { kind: "moment"; label: string; key: string }
  > = [];

  let finalOrdinal = -1;
  segments.forEach((seg, i) => {
    feed.push({ kind: "segment", segment: seg, index: i });
    if (!seg.partial) {
      finalOrdinal += 1;
      const labels = byAfter.get(finalOrdinal) || [];
      labels.forEach((label, j) => {
        feed.push({ kind: "moment", label, key: `${finalOrdinal}-${j}-${label}` });
      });
    }
  });

  return feed;
}

const FILTERS: { value: CallAnalysisFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Needs analysis" },
  { value: "ready", label: "Analyzed" },
  { value: "critical", label: "Critical" },
];

export default function CallAnalysisPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const canAccess = canAccessCallAnalysis(user?.role_id);

  const [dateRange, setDateRange] = useState<DateRangeValue>(() => createDefaultDateRange("today"));
  const [filter, setFilter] = useState<CallAnalysisFilter>("all");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState<CallAnalysisListItem[]>([]);
  const [summary, setSummary] = useState({ total: 0, pending: 0, ready: 0, critical: 0 });

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CallAnalysisDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const fromDate = toDateInputValue(dateRange.from);
  const toDate = toDateInputValue(dateRange.to);

  useEffect(() => {
    if (user && !canAccess) router.replace("/app");
  }, [user, canAccess, router]);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCallAnalysisList({
        from: fromDate,
        to: toDate,
        filter,
        search: searchDebounced || undefined,
      });
      setCalls(data.calls);
      setSummary(data.summary);
      setSelectedId((prev) => {
        if (prev && data.calls.some((c) => c.id === prev)) return prev;
        return data.calls[0]?.id ?? null;
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to load call analysis list.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, filter, searchDebounced, toast]);

  useEffect(() => {
    if (user && canAccess) void loadList();
  }, [user, canAccess, loadList]);

  const loadDetail = useCallback(
    async (id: number, needsAnalysis: boolean) => {
      try {
        setDetailLoading(true);
        setDetail(null);

        if (needsAnalysis) {
          setAnalyzing(true);
          try {
            const result = await runCallAnalysis(id, false);
            setDetail(result.call);
            if (result.source === "skipped_short") {
              toast({
                title: "Call too short",
                description: "AI analysis runs for calls longer than 30 seconds.",
              });
            }
            setCalls((prev) =>
              prev.map((c) =>
                c.id === id
                  ? {
                      ...c,
                      has_analysis: Boolean(result.call.has_analysis),
                      is_critical:
                        result.call.live_analysis?.risk_level === "high" ||
                        result.call.live_analysis?.sentiment === "negative",
                      analysis_preview: result.call.live_analysis
                        ? {
                            agenda:
                              result.call.live_analysis.agenda ||
                              result.call.live_analysis.topic ||
                              result.call.live_analysis.purpose ||
                              null,
                            sentiment: result.call.live_analysis.sentiment,
                            risk_level: result.call.live_analysis.risk_level,
                            buying_intent: result.call.live_analysis.buying_intent,
                            stage: result.call.live_analysis.stage,
                            is_final: result.call.live_analysis.is_final,
                          }
                        : null,
                    }
                  : c
              )
            );
          } catch {
            // Fall back to transcript-only view if analysis fails.
            const call = await getCallAnalysisDetail(id);
            setDetail(call);
            toast({
              title: "Analysis unavailable",
              description: "Loaded transcript, but AI analysis could not be generated.",
              variant: "destructive",
            });
          } finally {
            setAnalyzing(false);
          }
        } else {
          const call = await getCallAnalysisDetail(id);
          setDetail(call);
        }
      } catch {
        toast({
          title: "Error",
          description: "Failed to load call details.",
          variant: "destructive",
        });
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    const row = calls.find((c) => c.id === selectedId);
    void loadDetail(selectedId, row ? !row.has_analysis : false);
    // Only re-fetch when the selected call changes — not when list metadata updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleReanalyze = async () => {
    if (!selectedId) return;
    try {
      setAnalyzing(true);
      const result = await runCallAnalysis(selectedId, true);
      setDetail(result.call);
      toast({
        title: "Analysis refreshed",
        description: result.cached ? "Used cached result." : "Generated a fresh AI analysis.",
      });
      void loadList();
    } catch {
      toast({
        title: "Error",
        description: "Failed to re-run analysis.",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const selectedCall = calls.find((call) => call.id === selectedId) ?? null;
  const windshieldSource = detail ?? selectedCall;
  const windshieldOutbound = (windshieldSource?.direction || "").toLowerCase().includes("outbound");
  const windshieldPhone = windshieldOutbound ? windshieldSource?.to : windshieldSource?.from;
  const windshieldCompanyId =
    windshieldSource?.company_id ?? user?.company_id ?? null;

  const analysis = detail?.live_analysis;
  const journey = analysis?.journey?.length
    ? analysis.journey
    : [
        { stage: "Greeting", status: "pending" },
        { stage: "Vehicle Info", status: "pending" },
        { stage: "Quote", status: "pending" },
        { stage: "Objection", status: "pending" },
        { stage: "Close", status: "pending" },
      ];

  if (!user || !canAccess) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <AppSidebar />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex min-h-screen flex-col bg-[#F7F8FC]">
          <AppHeader user={user} logout={logout} pageTitle="Call Analysis" />
          <main className="flex-1 space-y-4 p-4 md:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Call Analysis</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Review transcripts and AI insights for calls you missed on Live Intel.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <DateRangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  className="min-w-[240px]"
                  disabled={loading}
                />
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search agent or number…"
                    className="h-9 w-56 rounded-full border-slate-200 bg-white pl-8"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-full bg-white"
                  onClick={() => void loadList()}
                  disabled={loading}
                >
                  <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => {
                const count =
                  f.value === "all"
                    ? summary.total
                    : f.value === "pending"
                      ? summary.pending
                      : f.value === "ready"
                        ? summary.ready
                        : summary.critical;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFilter(f.value)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                      filter === f.value
                        ? "bg-violet-600 text-white"
                        : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {f.label}
                    <span className="ml-1.5 opacity-80">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid items-start gap-4 xl:grid-cols-[280px_minmax(0,1.2fr)_340px]">
              {/* Call list */}
              <div className="flex h-[min(72vh,720px)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <div className="shrink-0 border-b border-slate-100 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Reviewable calls
                </div>
                {loading ? (
                  <div className="flex flex-1 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : calls.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
                    <FileSearch className="h-8 w-8 text-slate-300" />
                    <p className="text-sm text-slate-500">No transcribed calls in this range</p>
                  </div>
                ) : (
                  <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
                    {calls.map((call) => {
                      const isSelected = call.id === selectedId;
                      const preview = call.analysis_preview;
                      return (
                        <li key={call.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(call.id)}
                            className={cn(
                              "flex w-full items-start gap-2.5 px-3 py-3 text-left transition-colors hover:bg-slate-50",
                              isSelected && "bg-violet-50/70"
                            )}
                          >
                            <Avatar className="h-9 w-9 border border-slate-200">
                              <AvatarImage src={call.user?.profile_picture || undefined} />
                              <AvatarFallback className="bg-violet-100 text-xs text-violet-700">
                                {initials(call.user?.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-1">
                                <p className="truncate text-sm font-semibold text-slate-800">
                                  {call.user?.name || "Unassigned"}
                                </p>
                                <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                                  {formatDuration(call.duration_seconds)}
                                </span>
                              </div>
                              <p className="truncate text-xs text-slate-500">
                                {call.direction === "outbound"
                                  ? formatPhoneNumber(call.to || "")
                                  : formatPhoneNumber(call.from || "")}
                              </p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <DirectionBadge direction={call.direction} />
                                <span className="truncate text-[11px] font-medium text-violet-700">
                                  {preview?.agenda || (call.has_analysis ? "Analyzed" : "Needs analysis")}
                                </span>
                                {call.has_analysis ? (
                                  <IntentTag analysis={preview as LiveCallAnalysis} />
                                ) : (
                                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                    Pending AI
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-[10px] text-slate-400">
                                {call.created_at
                                  ? new Date(call.created_at).toLocaleString()
                                  : "—"}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Transcript */}
              <div className="flex h-[min(72vh,720px)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                {detailLoading && !detail ? (
                  <div className="flex flex-1 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : detail ? (
                  <>
                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {detail.user?.name || "Agent"} ·{" "}
                            {detail.direction === "outbound"
                              ? formatPhoneNumber(detail.to || "")
                              : formatPhoneNumber(detail.from || "")}
                          </p>
                          <DirectionBadge direction={detail.direction} />
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {detail.created_at
                            ? new Date(detail.created_at).toLocaleString()
                            : "—"}{" "}
                          · {formatDuration(detail.duration_seconds)} ·{" "}
                          <span className="capitalize">{detail.call_status || "unknown"}</span>
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        disabled={analyzing}
                        onClick={() => void handleReanalyze()}
                      >
                        {analyzing ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Re-analyze
                      </Button>
                    </div>
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
                      {(detail.transcript || []).length === 0 ? (
                        <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-slate-400">
                          No transcript available for this call
                        </div>
                      ) : (
                        buildTranscriptFeed(detail.transcript || [], analysis?.moments).map(
                          (item) => {
                            if (item.kind === "moment") {
                              return <MomentBanner key={item.key} label={item.label} />;
                            }
                            const seg = item.segment;
                            const isAgent = (seg.role || "").toLowerCase() === "agent";
                            const externalLabel =
                              detail.direction === "inbound" ? "Caller" : "Customer";
                            return (
                              <div
                                key={`seg-${item.index}-${seg.at ?? ""}`}
                                className={cn(
                                  "flex gap-2",
                                  isAgent ? "justify-end" : "justify-start"
                                )}
                              >
                                {!isAgent && (
                                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">
                                    C
                                  </div>
                                )}
                                <div
                                  className={cn(
                                    "max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                                    isAgent
                                      ? "rounded-br-md bg-sky-50 text-slate-800"
                                      : "rounded-bl-md bg-violet-50 text-slate-800"
                                  )}
                                >
                                  <div className="mb-0.5 flex items-center justify-between gap-3">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                      {isAgent ? "Agent" : externalLabel}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      {formatSegmentTime(seg.at)}
                                    </span>
                                  </div>
                                  <p>{seg.text}</p>
                                </div>
                                {isAgent && (
                                  <Avatar className="mt-1 h-7 w-7 border border-slate-200">
                                    <AvatarImage
                                      src={detail.user?.profile_picture || undefined}
                                    />
                                    <AvatarFallback className="bg-sky-100 text-[10px] text-sky-700">
                                      {initials(detail.user?.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                )}
                              </div>
                            );
                          }
                        )
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
                    Select a call to review transcript and analysis
                  </div>
                )}
              </div>

              {/* Analysis panels */}
              <div className="flex h-[min(72vh,720px)] flex-col gap-3 overflow-y-auto pr-1 [&>*]:shrink-0">
                {selectedId && windshieldCompanyId ? (
                  <WindshieldHubTimeline
                    companyId={windshieldCompanyId}
                    phone={windshieldPhone}
                    callLogId={selectedId}
                    className="shrink-0 rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm"
                  />
                ) : null}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900">AI Analysis</h3>
                      {detail?.department?.name ? (
                        <p className="mt-0.5 truncate text-xs font-medium text-violet-700">
                          {detail.department.name}
                        </p>
                      ) : null}
                    </div>
                    {analyzing && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-500" />}
                  </div>
                  {!analysis && !analyzing ? (
                    <p className="text-sm text-slate-400">
                      Open a call to load or generate analysis.
                    </p>
                  ) : analyzing && !analysis ? (
                    <p className="text-sm text-slate-500">Generating analysis…</p>
                  ) : analysis ? (
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Agenda</span>
                        <span className="max-w-[60%] truncate text-right font-semibold text-violet-700">
                          {agendaLabel(analysis)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Sentiment</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
                            analysis.sentiment === "positive" && "bg-emerald-50 text-emerald-700",
                            analysis.sentiment === "negative" && "bg-red-50 text-red-700",
                            analysis.sentiment === "neutral" && "bg-slate-100 text-slate-700"
                          )}
                        >
                          {analysis.sentiment || "—"}
                        </span>
                      </div>
                      <AnalysisWidgetFields analysis={analysis} />
                      {analysis.insight_alert && (
                        <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-800">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <p className="text-xs font-medium">{analysis.insight_alert}</p>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                <Collapsible defaultOpen className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-900">
                    Key Points
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 border-t border-slate-100 px-4 py-3">
                    {(analysis?.key_points || []).length === 0 ? (
                      <p className="text-sm text-slate-400">No key points yet</p>
                    ) : (
                      (analysis?.key_points || []).map((point, i) => (
                        <div key={i} className="flex gap-2 text-sm text-slate-700">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                          <p>{point}</p>
                        </div>
                      ))
                    )}
                  </CollapsibleContent>
                </Collapsible>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">AI Coach</h3>
                  {analysis?.next_best_action ? (
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {analysis.next_best_action.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {analysis.next_best_action.reason}
                        </p>
                        {analysis.next_best_action.success_chance != null && (
                          <p className="mt-2 text-xs font-medium text-emerald-600">
                            {analysis.next_best_action.success_chance}% success chance
                          </p>
                        )}
                      </div>
                      {(analysis.suggested_scripts || []).length > 0 && (
                        <div className="space-y-1.5">
                          {(analysis.suggested_scripts || []).map((script, i) => (
                            <div
                              key={i}
                              className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-medium text-violet-800"
                            >
                              {script}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Coach insights appear after analysis.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">Call Journey</h3>
                  <ol className="space-y-2">
                    {journey.map((step, i) => (
                      <li key={`${step.stage}-${i}`} className="flex items-center gap-2 text-sm">
                        <span
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                            step.status === "done" && "bg-emerald-100 text-emerald-700",
                            step.status === "active" && "bg-violet-100 text-violet-700",
                            step.status === "pending" && "bg-slate-100 text-slate-500"
                          )}
                        >
                          {i + 1}
                        </span>
                        <span className="flex-1 text-slate-700">{step.stage}</span>
                        {step.duration_label && (
                          <span className="text-[11px] text-slate-400">{step.duration_label}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
