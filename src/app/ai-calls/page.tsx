"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Loader2, PhoneCall, Search } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import AppHeader from "@/components/app-header";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DateRangePicker, createDefaultDateRange, toDateInputValue, type DateRangeValue } from "@/components/date-range-picker";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { canAccessAiCalls } from "@/lib/roles";
import { cn, formatPhoneNumber } from "@/lib/utils";
import { getAiCalls, type AiCallListItem, type AiCallListResponse, type AiCallOutcome } from "@/services/aiCallService";
import { ConversationView, EvalBadge, OUTCOME_META, SentimentBadge } from "@/components/ai-calls/conversation-view";
import { Card, fmt } from "@/components/ai-calls/ai-charts";

const OUTCOMES: ("all" | AiCallOutcome)[] = ["all", "booked", "transferred", "payment_pending", "slot_held", "quoted", "not_booked", "hang_up", "failed"];

function dayLabel(d: Date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

export default function AiCallsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const canAccess = canAccessAiCalls(user?.role_id);

  const [dateRange, setDateRange] = useState<DateRangeValue>(() => createDefaultDateRange("7d"));
  const [outcome, setOutcome] = useState<"all" | AiCallOutcome>("all");
  const [sentiment, setSentiment] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AiCallListResponse | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  // Deep link from the insights page: /ai-calls?call=123
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("call"));
    if (Number.isFinite(id) && id > 0) setOpenId(id);
  }, []);

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
      setData(await getAiCalls({ from: fromDate, to: toDate, outcome, search: searchDebounced || undefined, sentiment: sentiment || undefined, success: success || undefined }));
    } catch {
      toast({ title: "Could not load the call log", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, outcome, searchDebounced, sentiment, success, toast]);

  useEffect(() => {
    if (canAccess) void loadList();
  }, [canAccess, loadList]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (openId) url.searchParams.set("call", String(openId));
    else url.searchParams.delete("call");
    window.history.replaceState(null, "", url.toString());
  }, [openId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const calls: AiCallListItem[] = useMemo(() => data?.calls ?? [], [data]);
  const groups = useMemo(() => {
    const out: { day: string; items: AiCallListItem[] }[] = [];
    for (const c of calls) {
      const day = c.started_at ? dayLabel(new Date(c.started_at)) : "Unknown date";
      if (!out.length || out[out.length - 1].day !== day) out.push({ day, items: [] });
      out[out.length - 1].items.push(c);
    }
    return out;
  }, [calls]);
  const index = openId ? calls.findIndex((c) => c.id === openId) : -1;

  if (!user || !canAccess) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <AppSidebar />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex min-h-screen flex-col bg-[#f9f9f7]">
          <AppHeader user={user} logout={logout} pageTitle="AI Call Log" />
          <div className="border-b border-black/[0.06] bg-white px-4 py-4 md:px-6 xl:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0b0b0b] text-white">
                  <PhoneCall className="h-5 w-5" />
                </span>
                <div>
                  <h1 className="text-xl font-semibold text-[#0b0b0b]">AI call log</h1>
                  <p className="text-sm text-[#52514e]">Every call the voice agent answered — open one to replay it</p>
                </div>
              </div>
              <Link href="/ai-calls/dashboard" className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm font-medium text-[#0b0b0b] hover:bg-[#f4f3ef]">
                <BarChart3 className="h-4 w-4" /> Insights
              </Link>
            </div>
            {summary && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Calls", fmt.num(summary.total)],
                  ["Minutes", fmt.num(summary.minutes)],
                  ["Spend", fmt.usd(summary.cost, 2)],
                  ["Booked", `${summary.booking_rate}%`],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-[#f4f3ef] px-4 py-2.5">
                    <div className="text-xs text-[#52514e]">{l}</div>
                    <div className="text-lg font-semibold text-[#0b0b0b]">{v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <main className="flex-1 space-y-4 px-4 py-5 md:px-6 xl:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[260px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#898781]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search summary, phone number or appointment ID"
                  className="h-10 w-full rounded-xl border border-black/10 bg-white pl-9 pr-3 text-sm outline-none focus:border-black/30"
                />
              </div>
              <DateRangePicker value={dateRange} onChange={setDateRange} className="min-w-[230px]" disabled={loading} />
              <select value={sentiment} onChange={(e) => setSentiment(e.target.value)} className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm">
                <option value="">Any mood</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </select>
              <select value={success} onChange={(e) => setSuccess(e.target.value)} className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm">
                <option value="">Any result</option>
                <option value="success">Resolved</option>
                <option value="failure">Not resolved</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {OUTCOMES.map((o) => {
                const count = o === "all" ? summary?.total : summary?.by_outcome?.[o];
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setOutcome(o)}
                    className={cn("rounded-lg px-2.5 py-1 text-xs font-medium transition", outcome === o ? "bg-[#0b0b0b] text-white" : "bg-white text-[#52514e] ring-1 ring-black/10 hover:text-[#0b0b0b]")}
                  >
                    {o === "all" ? "All outcomes" : OUTCOME_META[o]?.label}
                    {count !== undefined && <span className="ml-1 opacity-60">{count}</span>}
                  </button>
                );
              })}
            </div>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-[#fbfaf7]">
                    <tr className="text-left text-xs text-[#898781]">
                      <th className="px-5 py-3 font-medium">Time</th>
                      <th className="px-3 py-3 font-medium">Caller</th>
                      <th className="px-3 py-3 font-medium">What it was about</th>
                      <th className="px-3 py-3 font-medium">Outcome</th>
                      <th className="px-3 py-3 font-medium">Checks</th>
                      <th className="px-3 py-3 font-medium">Mood</th>
                      <th className="px-3 py-3 text-right font-medium">Length</th>
                      <th className="px-5 py-3 text-right font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && !calls.length ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center">
                          <Loader2 className="mx-auto h-5 w-5 animate-spin text-[#898781]" />
                        </td>
                      </tr>
                    ) : calls.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-sm text-[#898781]">
                          No AI calls match these filters.
                        </td>
                      </tr>
                    ) : (
                      groups.map((g) => (
                        <FragmentRows key={g.day} day={g.day} items={g.items} openId={openId} onOpen={setOpenId} />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </main>
        </div>

        {openId && (
          <div className="fixed inset-0 z-50 bg-[#f9f9f7]">
            <ConversationView
              callId={openId}
              position={index >= 0 ? `${index + 1} of ${calls.length}` : undefined}
              onClose={() => setOpenId(null)}
              onPrev={index > 0 ? () => setOpenId(calls[index - 1].id) : undefined}
              onNext={index >= 0 && index < calls.length - 1 ? () => setOpenId(calls[index + 1].id) : undefined}
              onChanged={loadList}
            />
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}

function FragmentRows({ day, items, openId, onOpen }: { day: string; items: AiCallListItem[]; openId: number | null; onOpen: (id: number) => void }) {
  return (
    <>
      <tr>
        <td colSpan={8} className="border-t border-black/[0.06] bg-[#f4f3ef]/60 px-5 py-1.5 text-xs font-semibold text-[#52514e]">
          {day} <span className="font-normal text-[#898781]">· {items.length} call{items.length === 1 ? "" : "s"}</span>
        </td>
      </tr>
      {items.map((c) => (
        <tr key={c.id} onClick={() => onOpen(c.id)} className={cn("cursor-pointer border-t border-black/[0.06] transition hover:bg-[#fbfaf7]", openId === c.id && "bg-[#fbfaf7]")}>
          <td className="whitespace-nowrap px-5 py-3 tabular-nums text-[#52514e]">{c.started_at ? new Date(c.started_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"}</td>
          <td className="whitespace-nowrap px-3 py-3">
            {c.customer_number ? <span className="font-medium text-[#0b0b0b]">{formatPhoneNumber(c.customer_number)}</span> : <span className="text-[#898781]">{c.initiation_source === "react_sdk" ? "Web test" : "Unknown"}</span>}
            {c.routing_reason && <div className="text-[11px] text-[#898781]">{c.routing_reason === "after_hours" ? "after hours" : "team didn't pick up"}</div>}
          </td>
          <td className="max-w-[340px] px-3 py-3">
            <div className="truncate text-[#0b0b0b]" title={c.summary ?? undefined}>
              {c.title ?? c.summary?.slice(0, 70) ?? "Conversation"}
            </div>
            {c.message_count !== null && <div className="text-[11px] text-[#898781]">{c.message_count} messages</div>}
          </td>
          <td className="px-3 py-3">
            <span className={cn("whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium", OUTCOME_META[c.outcome ?? ""]?.className ?? "bg-[#f0efea]")}>{OUTCOME_META[c.outcome ?? ""]?.label ?? "—"}</span>
          </td>
          <td className="px-3 py-3">
            <EvalBadge score={c.evaluation_score} size={24} />
          </td>
          <td className="px-3 py-3">
            <SentimentBadge label={c.sentiment_label} />
          </td>
          <td className="px-3 py-3 text-right tabular-nums text-[#52514e]">{fmt.duration(c.duration_secs)}</td>
          <td className="px-5 py-3 text-right tabular-nums text-[#52514e]">{fmt.usd(c.cost, 2)}</td>
        </tr>
      ))}
    </>
  );
}
