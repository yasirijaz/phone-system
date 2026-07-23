"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Filter,
  Flame,
  Loader2,
  MoreHorizontal,
  Phone,
  Search,
  Smile,
  Sparkles,
  Star,
  TrendingUp,
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
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { hasSupervisorAccess } from "@/lib/roles";
import { events } from "@/lib/events";
import { formatPhoneNumber, cn } from "@/lib/utils";
import { addParticipant } from "@/services/twilioService";
import {
  getLiveCalls,
  leaveLiveDashboardWatching,
  pingLiveDashboardWatching,
  type LiveCall,
  type LiveCallAnalysis,
  type LiveCallsSummary,
  type LiveTranscriptSegment,
} from "@/services/liveCallService";

function formatElapsed(createdAt?: string | null): string {
  if (!createdAt) return "00:00";
  const start = new Date(createdAt).getTime();
  if (Number.isNaN(start)) return "00:00";
  const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatSegmentTime(at?: string): string {
  if (!at) return "";
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function LiveTimer({ createdAt }: { createdAt?: string | null }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <span className="tabular-nums">{formatElapsed(createdAt)}</span>;
}

function DeltaBadge({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (!value) return null;
  const up = value > 0;
  return (
    <span className={cn("text-xs font-medium", up ? "text-emerald-600" : "text-red-500")}>
      {up ? "↑" : "↓"} {Math.abs(value)}
      {suffix} vs yesterday
    </span>
  );
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

function StarRating({ value }: { value: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < filled ? "fill-amber-400 text-amber-400" : "text-slate-300"
          )}
        />
      ))}
    </div>
  );
}

function IntentTag({ analysis }: { analysis?: LiveCallAnalysis | null }) {
  const intent = analysis?.buying_intent ?? 0;
  const risk = analysis?.risk_level;
  const sentiment = analysis?.sentiment;

  if (risk === "high" || sentiment === "negative") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
        <Flame className="h-3 w-3" />
        At Risk
      </span>
    );
  }
  if (intent >= 4) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-600">
        <Flame className="h-3 w-3" />
        High Intent
      </span>
    );
  }
  if (risk === "low" && sentiment === "positive") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
        <Check className="h-3 w-3" />
        Low Risk
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
      Neutral
    </span>
  );
}

function agendaLabel(analysis?: LiveCallAnalysis | null): string {
  return (
    analysis?.agenda ||
    analysis?.stage ||
    analysis?.topic ||
    analysis?.purpose ||
    "In progress"
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

/** Interleave transcript segments with AI moment banners after the matching index. */
function buildTranscriptFeed(
  segments: LiveTranscriptSegment[],
  moments?: LiveCallAnalysis["moments"]
): Array<
  | { kind: "segment"; segment: LiveTranscriptSegment; index: number }
  | { kind: "moment"; label: string; key: string }
> {
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

  if ((moments || []).length && finalOrdinal < 0 && moments?.[0]?.label) {
    feed.push({ kind: "moment", label: moments[0].label, key: "fallback-moment" });
  }

  return feed;
}

function Waveform() {
  const bars = [4, 10, 6, 14, 8, 16, 5, 12, 7, 15, 9, 11, 6, 13, 8, 10, 5, 14, 7, 12];
  return (
    <div className="flex h-6 items-end gap-[2px]">
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[3px] animate-pulse rounded-full bg-violet-500/80"
          style={{ height: `${h}px`, animationDelay: `${i * 40}ms` }}
        />
      ))}
    </div>
  );
}

function RingScore({ value }: { value: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg className="h-12 w-12 -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#E5E7EB" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="4"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700">
        {value}%
      </span>
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  delta,
  deltaSuffix,
  icon,
  accent,
}: {
  title: string;
  value: string;
  subtitle?: string;
  delta?: number;
  deltaSuffix?: string;
  icon?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between">
        <p className="text-xs font-medium text-slate-500">{title}</p>
        {icon}
      </div>
      <p className={cn("text-3xl font-bold tracking-tight text-slate-900", accent)}>{value}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
      {typeof delta === "number" && <div className="mt-1"><DeltaBadge value={delta} suffix={deltaSuffix} /></div>}
    </div>
  );
}

const DEFAULT_JOURNEY = [
  { stage: "Greeting", status: "pending", duration_label: null },
  { stage: "Vehicle Info", status: "pending", duration_label: null },
  { stage: "Quote", status: "pending", duration_label: null },
  { stage: "Objection", status: "pending", duration_label: null },
  { stage: "Close", status: "pending", duration_label: null },
];

export default function LiveCallsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const [summary, setSummary] = useState<LiveCallsSummary | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [search, setSearch] = useState("");
  const [keyPointsOpen, setKeyPointsOpen] = useState(true);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);

  const canAccess = hasSupervisorAccess(user?.role_id);
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    []
  );

  useEffect(() => {
    if (user && !canAccess) router.replace("/app");
  }, [user, canAccess, router]);

  const loadCalls = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getLiveCalls();
      setCalls(data.live_calls);
      setSummary(data.summary);
      setSelectedId((prev) => {
        if (prev && data.live_calls.some((c) => c.id === prev)) return prev;
        return data.live_calls[0]?.id ?? null;
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to load live calls.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (canAccess) loadCalls();
  }, [canAccess, loadCalls]);

  // Heartbeat: live AI analysis only runs while this dashboard is open.
  useEffect(() => {
    if (!canAccess) return;

    let cancelled = false;
    const ping = () => {
      if (!cancelled) {
        void pingLiveDashboardWatching().catch(() => {});
      }
    };

    ping();
    const interval = window.setInterval(ping, 20_000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') ping();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      leaveLiveDashboardWatching();
    };
  }, [canAccess]);

  useEffect(() => {
    const onState = (payload: LiveCall) => {
      if (!payload?.id) return;
      setCalls((prev) => {
        const status = (payload.call_status || "").toLowerCase();
        const ended =
          payload.event === "ended" ||
          ["completed", "busy", "no-answer", "failed", "canceled", "missed", "decline"].includes(status);

        if (ended) return prev.filter((c) => c.id !== payload.id);

        const idx = prev.findIndex((c) => c.id === payload.id);
        if (idx === -1) {
          if (status === "in_progress" || payload.event === "in_progress" || payload.event === "accepted") {
            return [payload, ...prev];
          }
          return prev;
        }
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          ...payload,
          transcript: payload.transcript ?? next[idx].transcript,
          live_analysis: payload.live_analysis ?? next[idx].live_analysis,
        };
        return next;
      });
    };

    const onTranscript = (payload: {
      id: number;
      segment?: LiveTranscriptSegment;
      transcript?: LiveTranscriptSegment[];
    }) => {
      if (!payload?.id) return;
      setCalls((prev) =>
        prev.map((c) => {
          if (c.id !== payload.id) return c;
          if (payload.transcript) return { ...c, transcript: payload.transcript };
          if (payload.segment) return { ...c, transcript: [...(c.transcript || []), payload.segment] };
          return c;
        })
      );
    };

    const onAnalysis = (payload: { id: number; live_analysis?: LiveCallAnalysis }) => {
      if (!payload?.id) return;
      setCalls((prev) =>
        prev.map((c) =>
          c.id === payload.id ? { ...c, live_analysis: payload.live_analysis ?? c.live_analysis } : c
        )
      );
    };

    events.on("liveCallState", onState);
    events.on("liveTranscript", onTranscript);
    events.on("liveAnalysis", onAnalysis);
    return () => {
      events.off("liveCallState", onState);
      events.off("liveTranscript", onTranscript);
      events.off("liveAnalysis", onAnalysis);
    };
  }, []);

  const selected = useMemo(
    () => calls.find((c) => c.id === selectedId) ?? null,
    [calls, selectedId]
  );

  const filteredCalls = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return calls;
    return calls.filter((c) => {
      const hay = [
        c.user?.name,
        c.from,
        c.to,
        c.department?.name,
        c.live_analysis?.stage,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [calls, search]);

  useEffect(() => {
    if (selectedId && !calls.some((c) => c.id === selectedId)) {
      setSelectedId(calls[0]?.id ?? null);
    }
  }, [calls, selectedId]);

  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [selected?.transcript?.length]);

  const handleJoin = async (call: LiveCall | null, silent = false) => {
    if (!user || !call?.conference_sid) {
      toast({
        title: "Error",
        description: "Cannot join call. Conference is missing.",
        variant: "destructive",
      });
      return;
    }
    try {
      setJoining(true);
      await addParticipant(call.conference_sid, call.from || "", String(user.id), undefined, {
        coach: true,
        silent,
      });
      toast({
        title: "Success",
        description: silent ? "Listening to the call." : "You have joined the call.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to join the call.",
        variant: "destructive",
      });
    } finally {
      setJoining(false);
    }
  };

  const analysis = selected?.live_analysis;
  const journey = analysis?.journey?.length ? analysis.journey : DEFAULT_JOURNEY;
  const maxObjection = Math.max(1, ...(summary?.objections?.map((o) => o.count) ?? [1]));
  const queueStages = summary?.queue_by_stage ?? {};
  const queueColors: Record<string, string> = {
    Greeting: "bg-sky-100 text-sky-700",
    "Vehicle Info": "bg-violet-100 text-violet-700",
    Pricing: "bg-amber-100 text-amber-700",
    Closing: "bg-orange-100 text-orange-700",
    Booked: "bg-emerald-100 text-emerald-700",
  };

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
          <AppHeader user={user} logout={logout} pageTitle="Live Intelligence Center" />
          <main className="flex-1 space-y-4 p-4 md:p-6">
            {/* Page header */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Live Intelligence Center
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                  {calls.length} calls live
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search anything..."
                    className="h-9 w-52 rounded-full border-slate-200 bg-white pl-8"
                  />
                </div>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-full bg-white">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {todayLabel}
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full bg-white">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
              <KpiCard
                title="Live Calls"
                value={String(summary?.live_calls ?? calls.length)}
                delta={summary?.live_calls_delta}
                icon={<Phone className="h-4 w-4 text-violet-500" />}
              />
              <KpiCard
                title="Conversion Today"
                value={`${summary?.conversion_today ?? 0}%`}
                delta={summary?.conversion_delta}
                deltaSuffix="%"
                icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
              />
              <KpiCard
                title="Avg Sentiment"
                value={`${summary?.avg_sentiment ?? 0}%`}
                subtitle={
                  (summary?.avg_sentiment ?? 0) >= 60
                    ? "Positive"
                    : (summary?.avg_sentiment ?? 0) >= 40
                      ? "Neutral"
                      : "Negative"
                }
                icon={<Smile className="h-4 w-4 text-amber-500" />}
              />
              <KpiCard
                title="Critical Calls"
                value={String(summary?.critical_calls ?? 0)}
                subtitle="Needs attention"
                accent="text-red-600"
                icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
              />
              <KpiCard
                title="Bookings Today"
                value={String(summary?.bookings_today ?? 0)}
                delta={summary?.bookings_delta}
                icon={<Check className="h-4 w-4 text-emerald-500" />}
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Main 4-column board — fixed-height call/transcript columns */}
                <div className="grid items-start gap-4 xl:grid-cols-[240px_minmax(0,1.4fr)_260px_260px]">
                  {/* Live calls list */}
                  <div className="flex h-[min(70vh,640px)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="shrink-0 border-b border-slate-100 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Live Calls
                    </div>
                    {filteredCalls.length === 0 ? (
                      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-3 py-10 text-center">
                        <Phone className="h-8 w-8 text-slate-300" />
                        <p className="text-sm text-slate-500">No live calls</p>
                        <Button variant="outline" size="sm" onClick={loadCalls}>
                          Refresh
                        </Button>
                      </div>
                    ) : (
                      <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
                        {filteredCalls.map((call) => {
                          const isSelected = call.id === selectedId;
                          const agenda = agendaLabel(call.live_analysis);
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
                                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] tabular-nums text-slate-500">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                      <LiveTimer createdAt={call.created_at} />
                                    </span>
                                  </div>
                                  <p className="truncate text-[11px] font-medium text-slate-500">
                                    {agenda}
                                  </p>
                                  <div className="mt-1.5 flex items-center gap-1.5">
                                    <DirectionBadge direction={call.direction} />
                                  </div>
                                  <div className="mt-1.5 flex items-center justify-between gap-2">
                                    <IntentTag analysis={call.live_analysis} />
                                    <div className="flex h-3 items-end gap-[2px]">
                                      {[3, 5, 4, 6, 3].map((h, i) => (
                                        <span
                                          key={i}
                                          className={cn(
                                            "w-[2px] rounded-full",
                                            call.live_analysis?.risk_level === "high"
                                              ? "bg-red-400"
                                              : (call.live_analysis?.buying_intent ?? 0) >= 4
                                                ? "bg-orange-400"
                                                : "bg-emerald-400"
                                          )}
                                          style={{ height: `${h}px` }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {/* Transcript — fixed height; messages scroll inside */}
                  <div className="flex h-[min(70vh,640px)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    {selected ? (
                      <>
                        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                              <p className="text-sm font-semibold text-slate-900">
                                Live Call · {selected.user?.name || "Agent"}
                              </p>
                              <DirectionBadge direction={selected.direction} />
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {selected.direction === "outbound"
                                ? formatPhoneNumber(selected.to)
                                : formatPhoneNumber(selected.from)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold tabular-nums text-slate-700">
                              <LiveTimer createdAt={selected.created_at} />
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              Rec
                            </span>
                            <Button
                              size="sm"
                              className="rounded-full bg-violet-600 px-4 hover:bg-violet-700"
                              disabled={joining || !selected.conference_sid}
                              onClick={() => handleJoin(selected, false)}
                            >
                              Join Call
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-full"
                              disabled={joining || !selected.conference_sid}
                              onClick={() => handleJoin(selected, true)}
                              title="Listen"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div
                          ref={transcriptScrollRef}
                          className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
                        >
                          {(selected.transcript || []).length === 0 ? (
                            <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-slate-400">
                              Waiting for live transcript…
                            </div>
                          ) : (
                            buildTranscriptFeed(
                              selected.transcript || [],
                              analysis?.moments
                            ).map((item) => {
                              if (item.kind === "moment") {
                                return <MomentBanner key={item.key} label={item.label} />;
                              }

                              const seg = item.segment;
                              const isAgent = (seg.role || "").toLowerCase() === "agent";
                              const externalLabel =
                                selected.direction === "inbound" ? "Caller" : "Customer";
                              return (
                                <div
                                  key={`seg-${item.index}-${seg.at ?? ""}`}
                                  className={cn("flex gap-2", isAgent ? "justify-end" : "justify-start")}
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
                                        : "rounded-bl-md bg-violet-50 text-slate-800",
                                      seg.partial && "italic opacity-70"
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
                                      <AvatarImage src={selected.user?.profile_picture || undefined} />
                                      <AvatarFallback className="bg-sky-100 text-[10px] text-sky-700">
                                        {initials(selected.user?.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>

                        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5">
                          <Waveform />
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                            Live Transcription
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
                        Select a live call to view the transcript
                      </div>
                    )}
                  </div>

                  {/* AI Analysis */}
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                      <h3 className="mb-3 text-sm font-semibold text-slate-900">AI Analysis (Live)</h3>
                      {!analysis ? (
                        <p className="text-sm text-slate-400">
                          Analysis appears as the transcript builds.
                        </p>
                      ) : (
                        <div className="space-y-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500">Agenda</span>
                            <span className="max-w-[60%] truncate text-right font-semibold text-violet-700">
                              {agendaLabel(analysis)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500">Customer Sentiment</span>
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
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500">Buying Intent</span>
                            <StarRating value={analysis.buying_intent ?? 0} />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500">Current Stage</span>
                            <span className="font-medium text-slate-800">{analysis.stage || "—"}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500">Detected Objection</span>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-xs font-semibold",
                                analysis.objection && analysis.objection !== "none"
                                  ? "bg-red-50 text-red-600"
                                  : "bg-slate-100 text-slate-600"
                              )}
                            >
                              {analysis.objection && analysis.objection !== "none"
                                ? analysis.objection
                                : "None"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500">Risk Level</span>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
                                analysis.risk_level === "high" && "bg-red-50 text-red-600",
                                analysis.risk_level === "medium" && "bg-orange-50 text-orange-600",
                                analysis.risk_level === "low" && "bg-emerald-50 text-emerald-600"
                              )}
                            >
                              {analysis.risk_level || "—"}
                            </span>
                          </div>
                          <div className="pt-1">
                            <div className="mb-1.5 flex items-center justify-between">
                              <span className="text-slate-500">Probability of Booking</span>
                              <span className="font-semibold text-violet-700">
                                {analysis.booking_probability ?? 0}%
                              </span>
                            </div>
                            <Progress
                              value={analysis.booking_probability ?? 0}
                              className="h-2 bg-violet-100"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <Collapsible open={keyPointsOpen} onOpenChange={setKeyPointsOpen}>
                      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-900"
                          >
                            Key Points
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 text-slate-400 transition-transform",
                                keyPointsOpen && "rotate-180"
                              )}
                            />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <ul className="space-y-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
                            {(analysis?.key_points || []).length === 0 ? (
                              <li className="text-slate-400">No key points yet.</li>
                            ) : (
                              (analysis?.key_points || []).map((point, i) => (
                                <li key={i} className="flex gap-2">
                                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                                  <span>{point}</span>
                                </li>
                              ))
                            )}
                          </ul>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  </div>

                  {/* AI Coach + Alerts */}
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900">AI Coach</h3>
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                          Live
                        </span>
                      </div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Next Best Action
                      </p>
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                        <p className="text-sm font-semibold text-emerald-800">
                          {analysis?.next_best_action?.title || "Continue discovery"}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-emerald-700/90">
                          {analysis?.next_best_action?.reason ||
                            "AI coaching will appear once enough transcript is available."}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-emerald-800">
                          Success Chance: {analysis?.next_best_action?.success_chance ?? 0}%
                        </p>
                      </div>
                      <div className="mt-3 space-y-2">
                        {(analysis?.suggested_scripts || []).length === 0 ? (
                          <p className="text-xs text-slate-400">Suggested scripts appear during the call.</p>
                        ) : (
                          (analysis?.suggested_scripts || []).slice(0, 2).map((script, i) => (
                            <Button
                              key={i}
                              variant="outline"
                              size="sm"
                              className="h-auto w-full justify-start whitespace-normal rounded-xl border-slate-200 px-3 py-2 text-left text-xs"
                            >
                              {script}
                            </Button>
                          ))
                        )}
                      </div>
                      <button
                        type="button"
                        className="mt-3 text-xs font-medium text-violet-600 hover:underline"
                      >
                        View all suggestions
                      </button>
                    </div>

                    <div className="rounded-2xl border border-red-200 bg-red-50/40 p-4 shadow-sm">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-red-700">Supervisor Alerts</h3>
                        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">
                          {summary?.alerts?.length ?? 0}
                        </span>
                      </div>
                      {(summary?.alerts || []).length === 0 ? (
                        <p className="text-sm text-red-400">No alerts right now.</p>
                      ) : (
                        <ul className="space-y-2.5">
                          {(summary?.alerts || []).map((alert, i) => (
                            <li
                              key={i}
                              className="flex items-start justify-between gap-2 rounded-xl bg-white/80 px-3 py-2"
                            >
                              <p className="text-xs font-medium text-slate-700">{alert.message}</p>
                              <button
                                type="button"
                                className="shrink-0 text-[11px] font-semibold text-violet-600 hover:underline"
                                onClick={() => {
                                  if (alert.call_id) setSelectedId(alert.call_id);
                                  if (alert.action === "Join Call" && alert.call_id) {
                                    const call = calls.find((c) => c.id === alert.call_id);
                                    if (call) void handleJoin(call, false);
                                  }
                                }}
                              >
                                {alert.action}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom analytics */}
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                    <h3 className="mb-4 text-sm font-semibold text-slate-900">Call Journey</h3>
                    <div className="flex items-start justify-between gap-1 overflow-x-auto pb-1">
                      {journey.map((step, i) => {
                        const status = step.status || "pending";
                        const active = status === "active";
                        const done = status === "done";
                        return (
                          <div key={`${step.stage}-${i}`} className="flex min-w-[64px] flex-1 flex-col items-center">
                            <div className="mb-2 flex w-full items-center">
                              {i > 0 && (
                                <div
                                  className={cn(
                                    "h-0.5 flex-1",
                                    done || active ? "bg-violet-500" : "bg-slate-200"
                                  )}
                                />
                              )}
                              <div
                                className={cn(
                                  "mx-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                                  active && "bg-violet-600 text-white ring-4 ring-violet-100",
                                  done && !active && "bg-violet-500 text-white",
                                  !done && !active && "bg-slate-100 text-slate-400"
                                )}
                              >
                                {done && !active ? <Check className="h-3.5 w-3.5" /> : i + 1}
                              </div>
                              {i < journey.length - 1 && (
                                <div
                                  className={cn(
                                    "h-0.5 flex-1",
                                    done ? "bg-violet-500" : "bg-slate-200"
                                  )}
                                />
                              )}
                            </div>
                            <p
                              className={cn(
                                "text-center text-[10px] font-semibold",
                                active ? "text-violet-700" : "text-slate-600"
                              )}
                            >
                              {step.stage}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {step.duration_label || (active ? "Active" : "—")}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                    <h3 className="mb-4 text-sm font-semibold text-slate-900">Objections (Live)</h3>
                    {(summary?.objections || []).length === 0 ? (
                      <p className="text-sm text-slate-400">No objections detected yet.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {(summary?.objections || []).map((obj) => (
                          <div key={obj.label}>
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-700">{obj.label}</span>
                              <span className="text-slate-500">{obj.count}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-violet-500"
                                style={{ width: `${(obj.count / maxObjection) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                    <h3 className="mb-4 text-sm font-semibold text-slate-900">Call Queue (By Stage)</h3>
                    <div className="grid grid-cols-5 gap-2">
                      {["Greeting", "Vehicle Info", "Pricing", "Closing", "Booked"].map((stage) => (
                        <div
                          key={stage}
                          className={cn(
                            "rounded-xl px-1 py-3 text-center",
                            queueColors[stage] || "bg-slate-100 text-slate-700"
                          )}
                        >
                          <p className="text-lg font-bold">{queueStages[stage] ?? 0}</p>
                          <p className="text-[9px] font-semibold leading-tight">{stage}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                    <h3 className="mb-4 text-sm font-semibold text-slate-900">
                      Top Performing Agents (Today)
                    </h3>
                    {(summary?.top_agents || []).length === 0 ? (
                      <p className="text-sm text-slate-400">No agent stats yet today.</p>
                    ) : (
                      <div className="space-y-3">
                        {(summary?.top_agents || []).map((agent) => (
                          <div key={agent.id} className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-slate-200">
                              <AvatarImage src={agent.profile_picture || undefined} />
                              <AvatarFallback className="bg-violet-100 text-xs text-violet-700">
                                {initials(agent.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-800">{agent.name}</p>
                              <p className="text-[11px] text-slate-500">{agent.calls_count} calls</p>
                            </div>
                            <RingScore value={agent.booking_rate} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
