"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Bot,
  CalendarCheck,
  ChevronDown,
  Clock,
  CornerDownRight,
  DollarSign,
  Flag,
  Gauge as GaugeIcon,
  GitBranch,
  ListChecks,
  Loader2,
  PhoneCall,
  RefreshCw,
  Sparkles,
  Timer,
  Wrench,
  XCircle,
} from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import AppHeader from "@/components/app-header";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DateRangePicker, toDateInputValue, type DateRangeValue } from "@/components/date-range-picker";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { canAccessAiCalls } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { getAiCallDashboard, type AiCallDashboard, type Granularity, type SpotlightItem } from "@/services/aiCallService";
import {
  Card,
  CardHead,
  Columns,
  CsvButton,
  DIVERGING,
  Empty,
  Gauge,
  INK,
  Legend,
  Lines,
  Meter,
  PALETTE,
  RankBars,
  STATUS,
  SectionTitle,
  SegmentBar,
  Segmented,
  StatCard,
  fmt,
  prettyId,
  type ChartSeries,
} from "@/components/ai-calls/ai-charts";
import { WorkflowGraph } from "@/components/ai-calls/workflow-graph";
import { OUTCOME_META, SentimentBadge } from "@/components/ai-calls/conversation-view";

/* ------------------------------------------------------------------ config */

const SECTIONS = [
  { key: "overview", label: "Overview", icon: Activity },
  { key: "attention", label: "Needs attention", icon: Flag },
  { key: "quality", label: "Call quality", icon: BadgeCheck },
  { key: "speed", label: "Speed & AI usage", icon: Timer },
  { key: "tools", label: "Integrations", icon: Wrench },
  { key: "flow", label: "Call flow", icon: GitBranch },
  { key: "outcomes", label: "Outcomes", icon: CalendarCheck },
] as const;
type SectionKey = (typeof SECTIONS)[number]["key"];

type Preset = "today" | "7d" | "30d" | "90d" | "custom";

/** Outcome identity colours, fixed per outcome (never re-assigned by rank). */
const OUTCOME_COLOR: Record<string, string> = {
  booked: PALETTE[0],
  transferred: PALETTE[6],
  quoted: PALETTE[2],
  payment_pending: PALETTE[3],
  slot_held: PALETTE[4],
  not_booked: "#b9b7ae",
  hang_up: "#d6d4cd",
  failed: PALETTE[7],
  other: "#b9b7ae",
};

function presetRange(p: Exclude<Preset, "custom">): DateRangeValue {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  if (p !== "today") from.setDate(from.getDate() - (p === "7d" ? 6 : p === "30d" ? 29 : 89));
  return { from, to };
}

const avgOf = (values: (number | null | undefined)[]) => {
  const v = values.filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/* ------------------------------------------------------------------ small pieces */

function FlaggedList({ items, metric }: { items: SpotlightItem[]; metric: (i: SpotlightItem) => ReactNode }) {
  if (!items.length) return <Empty height={140} text="No calls flagged for this check" />;
  return (
    <table className="w-full text-sm">
      <tbody>
        {items.map((i) => (
          <tr key={i.id} className="border-t border-black/[0.06] first:border-0">
            <td className="py-2.5 pr-3">
              <Link href={`/ai-calls?call=${i.id}`} className="font-medium text-[#0b0b0b] hover:underline">
                {i.title ?? "Conversation"}
              </Link>
              <div className="text-xs text-[#898781]">
                {i.started_at ? new Date(i.started_at).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""} · {fmt.duration(i.duration_secs)}
              </div>
            </td>
            <td className="py-2.5 pr-3 text-xs text-[#52514e]">{OUTCOME_META[i.outcome ?? ""]?.label ?? "—"}</td>
            <td className="py-2.5 text-right text-sm">{metric(i)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 24-cell strip (or 7 for weekdays) shaded by volume — a one-row heatmap. */
function HeatStrip({ cells }: { cells: { label: string; value: number }[] }) {
  const max = Math.max(1, ...cells.map((c) => c.value));
  const ramp = ["#f2f6fc", "#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95"];
  return (
    <div>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
        {cells.map((c) => {
          const step = c.value === 0 ? 0 : Math.min(ramp.length - 1, 1 + Math.floor((c.value / max) * (ramp.length - 2)));
          return (
            <div key={c.label} title={`${c.label}: ${c.value} call${c.value === 1 ? "" : "s"}`} className="flex h-10 items-end justify-center rounded-md pb-0.5 text-[10px] font-medium" style={{ background: ramp[step], color: step >= 4 ? "#fff" : INK.secondary }}>
              {c.value || ""}
            </div>
          );
        })}
      </div>
      <div className="mt-1 grid gap-[3px] text-center text-[10px] text-[#898781]" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
        {cells.map((c, i) => (
          <span key={c.label}>{cells.length > 12 ? (i % 3 === 0 ? c.label : "") : c.label}</span>
        ))}
      </div>
    </div>
  );
}

function Funnel({ steps }: { steps: { label: string; value: number; note?: string }[] }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].value : null;
        const pct = (s.value / top) * 100;
        return (
          <div key={s.label} className="grid grid-cols-[150px_minmax(0,1fr)_110px] items-center gap-3 text-sm">
            <span className="text-[#52514e]">{s.label}</span>
            <div className="h-8 rounded-lg bg-[#f4f3ef]">
              <div className="flex h-8 items-center rounded-lg px-2 text-xs font-semibold text-white" style={{ width: `${Math.max(pct, s.value ? 4 : 0)}%`, background: PALETTE[0], opacity: 1 - i * 0.18 }}>
                {pct >= 12 ? fmt.num(s.value) : ""}
              </div>
            </div>
            <span className="text-right tabular-nums">
              <span className="font-semibold text-[#0b0b0b]">{pct >= 12 ? `${pct.toFixed(0)}%` : fmt.num(s.value)}</span>
              {prev !== null && prev > 0 && <span className="ml-1 text-xs text-[#898781]">({((s.value / prev) * 100).toFixed(0)}% of prev)</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export default function AiCallsDashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const canAccess = canAccessAiCalls(user?.role_id);

  const [section, setSection] = useState<SectionKey>("overview");
  const [preset, setPreset] = useState<Preset>("7d");
  const [range, setRange] = useState<DateRangeValue>(() => presetRange("7d"));
  const [granularity, setGranularity] = useState<Granularity>("auto");
  const [agentId, setAgentId] = useState("");
  const [metric, setMetric] = useState("conversations");
  const [flagTab, setFlagTab] = useState<"frustrated" | "score" | "slow" | "tools">("frustrated");
  const [topicBy, setTopicBy] = useState<"service" | "vehicle">("service");
  const [toolMetric, setToolMetric] = useState<"calls" | "errors" | "latency" | "error_rate">("latency");
  const [data, setData] = useState<AiCallDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const from = toDateInputValue(range.from);
  const to = toDateInputValue(range.to);

  useEffect(() => {
    if (user && !canAccess) router.replace("/app");
  }, [user, canAccess, router]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setData(await getAiCallDashboard({ from, to, granularity, agent_id: agentId || undefined }));
    } catch {
      toast({ title: "Could not load AI insights", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [from, to, granularity, agentId, toast]);

  useEffect(() => {
    if (canAccess) void load();
  }, [canAccess, load]);

  const k = data?.kpis;
  const p = data?.previous;
  const series = useMemo(
    () =>
      (data?.series ?? []).map((s) => ({
        ...s,
        cost_per_call: s.conversations ? s.cost / s.conversations : null,
        minutes: s.duration_secs / 60,
        agent_minutes: s.tts_seconds / 60,
        caller_minutes: s.asr_seconds / 60,
      })),
    [data],
  );

  const metrics: Record<string, { label: string; key: string; f: (v: number) => string; integer?: boolean }> = {
    conversations: { label: "Calls handled", key: "conversations", f: (v) => fmt.num(v), integer: true },
    avg_duration: { label: "Average call length", key: "avg_duration_secs", f: (v) => fmt.duration(v) },
    cost: { label: "Spend (USD)", key: "cost", f: (v) => fmt.usd(v, 2) },
    cost_per_call: { label: "Cost per call", key: "cost_per_call", f: (v) => fmt.usd(v) },
    llm_cost: { label: "AI model spend", key: "llm_cost", f: (v) => fmt.usd(v, 2) },
    booked: { label: "Bookings", key: "booked", f: (v) => fmt.num(v), integer: true },
  };
  const m = metrics[metric];
  const metricAvg = avgOf(series.map((s) => (s as Record<string, unknown>)[m.key] as number | null));

  if (!user || !canAccess) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const total = k?.conversations ?? 0;
  const spark = (key: string) => series.map((s) => (s as Record<string, unknown>)[key] as number | null);
  const toolSeries: ChartSeries[] = (data?.tools.names ?? []).map((n, i) => ({ key: n, label: n, color: PALETTE[i] }));
  const flagged =
    flagTab === "frustrated"
      ? data?.spotlight.most_frustrated
      : flagTab === "score"
        ? data?.spotlight.lowest_score
        : flagTab === "slow"
          ? data?.spotlight.slowest
          : data?.spotlight.tool_errors;

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <AppSidebar />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex min-h-screen flex-col bg-[#f9f9f7]">
          <AppHeader user={user} logout={logout} pageTitle="AI Insights" />

          {/* header + filters */}
          <div className="border-b border-black/[0.06] bg-white px-4 py-4 md:px-6 xl:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0b0b0b] text-white">
                  <Bot className="h-5 w-5" />
                </span>
                <div>
                  <h1 className="text-xl font-semibold text-[#0b0b0b]">AI Receptionist Insights</h1>
                  <p className="text-sm text-[#52514e]">How the voice agent is handling WindshieldHUB calls</p>
                </div>
              </div>
              <Link href="/ai-calls" className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm font-medium text-[#0b0b0b] hover:bg-[#f4f3ef]">
                <PhoneCall className="h-4 w-4" /> Call log
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Segmented
                value={preset}
                onChange={(v) => {
                  setPreset(v);
                  if (v !== "custom") setRange(presetRange(v));
                }}
                options={[
                  { value: "today", label: "Today" },
                  { value: "7d", label: "7 days" },
                  { value: "30d", label: "30 days" },
                  { value: "90d", label: "90 days" },
                  { value: "custom", label: "Custom" },
                ]}
              />
              {preset === "custom" && <DateRangePicker value={range} onChange={setRange} className="min-w-[230px]" disabled={loading} />}
              <span className="mx-1 hidden h-6 w-px bg-black/10 sm:block" />
              <span className="text-sm text-[#52514e]">Group by</span>
              <Segmented
                value={granularity}
                onChange={setGranularity}
                options={[
                  { value: "auto", label: "Auto" },
                  { value: "hour", label: "Hour" },
                  { value: "day", label: "Day" },
                  { value: "week", label: "Week" },
                ]}
              />
              <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="h-9 rounded-xl border border-black/10 bg-white px-3 text-sm text-[#0b0b0b]">
                <option value="">Every agent</option>
                {(data?.agents ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name ?? a.id}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => void load()} className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-[#52514e] hover:bg-[#f4f3ef]">
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
              </button>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-1 xl:grid-cols-[230px_minmax(0,1fr)]">
            {/* section navigation */}
            <nav className="border-b border-black/[0.06] bg-white px-4 py-2 xl:border-b-0 xl:border-r xl:px-3 xl:py-5">
              <div className="flex gap-1 overflow-x-auto xl:sticky xl:top-4 xl:flex-col">
                {SECTIONS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSection(key)}
                    className={cn(
                      "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition",
                      section === key ? "bg-[#0b0b0b] font-medium text-white" : "text-[#52514e] hover:bg-[#f4f3ef] hover:text-[#0b0b0b]",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                    {key === "attention" && (data?.alerts.length ?? 0) > 0 && (
                      <span className={cn("ml-auto rounded-full px-1.5 text-[11px] font-semibold", section === key ? "bg-white text-[#0b0b0b]" : "bg-[#d03b3b] text-white")}>{data?.alerts.length}</span>
                    )}
                  </button>
                ))}
              </div>
            </nav>

            <main className="min-w-0 space-y-5 px-4 py-5 md:px-6 xl:px-8">
              {data?.range.truncated && <p className="text-xs text-[#9a6a00]">Showing the first 20,000 calls in this range — narrow the dates for exact totals.</p>}

              {!data || !k || !p ? (
                <div className="flex h-72 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[#898781]" />
                </div>
              ) : (
                <div className={cn("space-y-5 transition-opacity", loading && "opacity-60")}>
                  {/* =========================================== OVERVIEW */}
                  {section === "overview" && (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                        <StatCard icon={<PhoneCall className="h-4 w-4" />} label="Calls handled" value={fmt.num(k.conversations)} current={k.conversations} previous={p.conversations} spark={spark("conversations")} active={metric === "conversations"} onClick={() => setMetric("conversations")} />
                        <StatCard icon={<Clock className="h-4 w-4" />} label="Avg call length" value={fmt.duration(k.avg_duration_secs)} sub={`${fmt.hours(k.total_duration_secs)} total`} current={k.avg_duration_secs} previous={p.avg_duration_secs} spark={spark("avg_duration_secs")} active={metric === "avg_duration"} onClick={() => setMetric("avg_duration")} />
                        <StatCard icon={<DollarSign className="h-4 w-4" />} label="Spend" value={fmt.usd(k.total_cost, 2)} sub={k.total_credits ? `${fmt.compact(k.total_credits)} credits` : undefined} current={k.total_cost} previous={p.total_cost} lowerIsBetter spark={spark("cost")} active={metric === "cost"} onClick={() => setMetric("cost")} />
                        <StatCard icon={<DollarSign className="h-4 w-4" />} label="Cost per call" value={fmt.usd(k.avg_cost, 2)} sub={k.cost_per_minute ? `${fmt.usd(k.cost_per_minute, 2)}/min` : undefined} current={k.avg_cost} previous={p.avg_cost} lowerIsBetter spark={spark("cost_per_call")} active={metric === "cost_per_call"} onClick={() => setMetric("cost_per_call")} />
                        <StatCard icon={<Sparkles className="h-4 w-4" />} label="AI model spend" value={fmt.usd(k.total_llm_cost, 2)} sub={`${fmt.usd(k.avg_llm_cost, 2)} / call`} current={k.total_llm_cost} previous={p.total_llm_cost} lowerIsBetter spark={spark("llm_cost")} active={metric === "llm_cost"} onClick={() => setMetric("llm_cost")} />
                        <StatCard icon={<CalendarCheck className="h-4 w-4" />} label="Bookings" value={fmt.num(k.booked)} sub={`${fmt.pct(k.booking_rate)} of calls`} current={k.booked} previous={p.booked} spark={spark("booked")} active={metric === "booked"} onClick={() => setMetric("booked")} />
                      </div>

                      <Card>
                        <CardHead
                          title={m.label}
                          hint="Pick a card above to change this chart. The line marks the average per period."
                          actions={<CsvButton name={`ai-${m.key}`} rows={series} series={[{ key: m.key, label: m.label }]} />}
                        />
                        <div className="px-2 pb-4 pt-2">
                          <Columns data={series} series={[{ key: m.key, label: m.label, color: PALETTE[0] }]} yFormat={m.f} integer={m.integer} height={300} reference={metricAvg ? { value: metricAvg, label: `avg ${m.integer ? metricAvg.toFixed(1) : m.f(metricAvg)} per period` } : null} />
                        </div>
                      </Card>

                      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-4">
                        <Card>
                          <CardHead title="Resolved" icon={<BadgeCheck className="h-4 w-4" />} hint="Calls the analysis marked successful, out of all judged calls." />
                          <div className="flex items-center justify-around gap-4 px-5 py-4">
                            <Gauge value={k.success_rate} label="success rate" color={PALETTE[0]} size={170} />
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: PALETTE[0] }} /> Successful <b className="ml-auto pl-3 tabular-nums">{k.success_count}</b>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "#d6d4cd" }} /> Not successful <b className="ml-auto pl-3 tabular-nums">{k.failure_count}</b>
                              </div>
                              <div className="pt-1 text-xs text-[#898781]">avg score {k.avg_success_score ?? "—"}/100</div>
                            </div>
                          </div>
                          <div className="px-2 pb-4">
                            <Columns data={series} series={[{ key: "success", label: "Successful", color: PALETTE[0] }, { key: "failure", label: "Not successful", color: "#d6d4cd" }]} stacked integer height={120} />
                          </div>
                        </Card>

                        <Card>
                          <CardHead title="Caller mood" icon={<Sparkles className="h-4 w-4" />} figure={<span className="text-base">{fmt.score(k.avg_sentiment)} <span className="text-xs font-normal text-[#898781]">avg sentiment (−1 … +1)</span></span>} />
                          <div className="px-5 py-3">
                            <SegmentBar
                              segments={[
                                { label: "Positive", value: data.sentiment.positive ?? 0, color: DIVERGING.positive },
                                { label: "Neutral", value: data.sentiment.neutral ?? 0, color: DIVERGING.neutral },
                                { label: "Negative", value: data.sentiment.negative ?? 0, color: DIVERGING.negative },
                              ]}
                            />
                          </div>
                          <div className="px-2 pb-4">
                            <Columns
                              data={series}
                              series={[
                                { key: "negative", label: "Negative", color: DIVERGING.negative },
                                { key: "neutral", label: "Neutral", color: DIVERGING.neutral },
                                { key: "positive", label: "Positive", color: DIVERGING.positive },
                              ]}
                              stacked
                              integer
                              height={120}
                            />
                          </div>
                        </Card>

                        <Card>
                          <CardHead title="Reply speed" icon={<GaugeIcon className="h-4 w-4" />} hint="Caller stops talking → agent voice starts (includes waiting for integrations)." figure={<span className="text-base">{fmt.ms(k.median_response_ms)} <span className="text-xs font-normal text-[#898781]">typical · {fmt.ms(k.p90_response_ms)} slowest 10%</span></span>} />
                          <div className="px-2 pb-4 pt-2">
                            <Columns data={series} series={[{ key: "response_ms", label: "Reply time", color: PALETTE[2] }]} yFormat={(v) => fmt.ms(v)} height={210} reference={{ value: 1000, label: "1 s goal" }} />
                          </div>
                        </Card>

                        <Card>
                          <CardHead title="Talk time" icon={<Clock className="h-4 w-4" />} figure={<span className="text-base">{fmt.hours(k.total_duration_secs)} <span className="text-xs font-normal text-[#898781]">on the phone</span></span>} />
                          <div className="px-2 pb-4 pt-2">
                            <Columns data={series} series={[{ key: "minutes", label: "Minutes", color: PALETTE[6] }]} yFormat={(v) => `${Math.round(v)}m`} height={210} />
                          </div>
                        </Card>
                      </div>
                    </>
                  )}

                  {/* =========================================== NEEDS ATTENTION */}
                  {section === "attention" && (
                    <>
                      <SectionTitle title="Needs attention" sub="Automatic checks on this period's calls" />
                      {data.alerts.length === 0 ? (
                        <Card className="flex items-center gap-3 p-5 text-sm text-[#52514e]">
                          <BadgeCheck className="h-5 w-5" style={{ color: STATUS.good }} /> Everything looks healthy for this period.
                        </Card>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                          {data.alerts.map((a) => (
                            <Card key={a.title} className="flex items-start gap-3 p-4">
                              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${a.severity === "high" ? STATUS.critical : STATUS.warning}1f`, color: a.severity === "high" ? STATUS.critical : "#9a6a00" }}>
                                <AlertTriangle className="h-4 w-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-[#0b0b0b]">{a.title}</span>
                                  <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: a.severity === "high" ? STATUS.critical : "#9a6a00" }}>
                                    {a.severity === "high" ? "Critical" : "Warning"}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-sm text-[#52514e]">{a.body}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSection((a.tab === "evaluation" ? "quality" : a.tab === "tools" ? "tools" : a.tab === "general" ? "speed" : "attention") as SectionKey)}
                                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1 text-xs font-medium text-[#0b0b0b] hover:bg-[#f4f3ef]"
                              >
                                Review <CornerDownRight className="h-3 w-3" />
                              </button>
                            </Card>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                        <Card>
                          <CardHead
                            title="Flagged calls"
                            icon={<Flag className="h-4 w-4" />}
                            actions={
                              <Segmented
                                size="sm"
                                value={flagTab}
                                onChange={setFlagTab}
                                options={[
                                  { value: "frustrated", label: "Frustrated" },
                                  { value: "score", label: "Low score" },
                                  { value: "slow", label: "Slow replies" },
                                  { value: "tools", label: "Integration errors" },
                                ]}
                              />
                            }
                          />
                          <div className="px-5 pb-4 pt-2">
                            <FlaggedList
                              items={flagged ?? []}
                              metric={(i) =>
                                flagTab === "frustrated" ? (
                                  <span className="inline-flex items-center gap-2">
                                    <SentimentBadge label={i.sentiment_label} />
                                    <span className="tabular-nums text-[#52514e]">frustration {i.frustration_score?.toFixed(1)}</span>
                                  </span>
                                ) : flagTab === "score" ? (
                                  <span className="font-semibold tabular-nums">{i.success_score}/100</span>
                                ) : flagTab === "slow" ? (
                                  <span className="tabular-nums">
                                    <b>{fmt.ms(i.p90_response_ms)}</b> <span className="text-xs text-[#898781]">slowest 10%</span>
                                  </span>
                                ) : (
                                  <span className="font-semibold tabular-nums">{i.tool_error_count} failed</span>
                                )
                              }
                            />
                          </div>
                        </Card>

                        <Card>
                          <CardHead
                            title="What callers want"
                            icon={<ListChecks className="h-4 w-4" />}
                            hint="Grouped from what the agent collected (service requested or vehicle make). Hang-ups are listed separately."
                            actions={
                              <Segmented
                                size="sm"
                                value={topicBy}
                                onChange={setTopicBy}
                                options={[
                                  { value: "service", label: "Service" },
                                  { value: "vehicle", label: "Vehicle" },
                                ]}
                              />
                            }
                          />
                          <div className="px-5 pb-4 pt-3">
                            {data.topics[topicBy].length === 0 ? (
                              <Empty height={140} />
                            ) : (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-xs text-[#898781]">
                                    <th className="pb-2 font-normal">Topic</th>
                                    <th className="pb-2 text-right font-normal">Calls</th>
                                    <th className="pb-2 pl-3 font-normal">Success</th>
                                    <th className="pb-2 text-right font-normal">Mood</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {data.topics[topicBy].map((t) => (
                                    <tr key={t.label} className="border-t border-black/[0.06]">
                                      <td className={cn("py-2 pr-2", t.non_engaged ? "text-[#898781]" : "text-[#0b0b0b]")}>{t.label}</td>
                                      <td className="py-2 text-right font-semibold tabular-nums">{t.conversations}</td>
                                      <td className="w-28 py-2 pl-3">
                                        <div className="flex items-center gap-2">
                                          <Meter value={t.success_rate} color={PALETTE[0]} />
                                          <span className="w-9 text-right text-xs tabular-nums text-[#52514e]">{fmt.pct(t.success_rate)}</span>
                                        </div>
                                      </td>
                                      <td className="py-2 text-right text-xs tabular-nums text-[#52514e]">{fmt.score(t.sentiment)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </Card>
                      </div>

                      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
                        <Card className="2xl:col-span-2">
                          <CardHead title="Busiest hours" icon={<Clock className="h-4 w-4" />} hint="Calls by hour of day in your time zone. Darker = more calls." />
                          <div className="space-y-4 px-5 pb-5 pt-3">
                            <HeatStrip cells={data.breakdowns.hour_of_day.map((h) => ({ label: `${h.hour % 12 || 12}${h.hour < 12 ? "a" : "p"}`, value: h.count }))} />
                            <HeatStrip cells={data.breakdowns.weekday.map((d) => ({ label: d.day, value: d.count }))} />
                          </div>
                        </Card>
                        <Card>
                          <CardHead title="How calls ended" icon={<PhoneCall className="h-4 w-4" />} />
                          <div className="space-y-5 px-5 pb-5 pt-3">
                            <RankBars items={data.breakdowns.termination.map((t) => ({ label: t.label, value: t.count }))} total={total} color={PALETTE[6]} />
                            <SegmentBar
                              segments={data.breakdowns.routing_reason.map((t, i) => ({
                                label: t.label === "after_hours" ? "After hours" : t.label === "no_answer" ? "Team didn't pick up" : t.label === "Unknown" ? "Direct / test" : t.label,
                                value: t.count,
                                color: PALETTE[i],
                              }))}
                            />
                          </div>
                        </Card>
                      </div>
                    </>
                  )}

                  {/* =========================================== QUALITY */}
                  {section === "quality" && (
                    <>
                      <SectionTitle title="Call quality" sub="How each call scored against your checks, and what the agent captured" />
                      <Card>
                        <CardHead title="Checks" icon={<BadgeCheck className="h-4 w-4" />} hint="The evaluation criteria configured on the agent. Pass rate = passed ÷ judged." />
                        <div className="overflow-x-auto px-5 pb-4 pt-3">
                          {data.evaluation.criteria.length === 0 ? (
                            <Empty height={120} text="No checks configured on the agent yet" />
                          ) : (
                            <table className="w-full min-w-[640px] text-sm">
                              <thead>
                                <tr className="text-left text-xs text-[#898781]">
                                  <th className="pb-2 font-normal">Check</th>
                                  <th className="w-1/3 pb-2 font-normal">Pass rate</th>
                                  <th className="pb-2 text-right font-normal">Passed</th>
                                  <th className="pb-2 text-right font-normal">Missed</th>
                                  <th className="pb-2 text-right font-normal">Unclear</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[...data.evaluation.criteria].sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0)).map((c) => (
                                  <tr key={c.id} className="border-t border-black/[0.06]">
                                    <td className="py-2.5 font-medium text-[#0b0b0b]">{prettyId(c.id)}</td>
                                    <td className="py-2.5 pr-4">
                                      <div className="flex items-center gap-2">
                                        <Meter value={c.rate} color={PALETTE[0]} />
                                        <span className="w-10 text-right font-semibold tabular-nums">{fmt.pct(c.rate)}</span>
                                      </div>
                                    </td>
                                    <td className="py-2.5 text-right tabular-nums">{c.success}</td>
                                    <td className="py-2.5 text-right tabular-nums">{c.failure}</td>
                                    <td className="py-2.5 text-right tabular-nums text-[#898781]">{c.unknown}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </Card>
                      {data.evaluation.criteria.length > 0 && (
                        <Card>
                          <CardHead title="Check pass rate over time" actions={<CsvButton name="ai-checks" rows={data.evaluation.series} series={data.evaluation.criteria.map((c) => ({ key: c.id, label: prettyId(c.id) }))} />} />
                          <div className="px-2 pt-2">
                            <Lines data={data.evaluation.series} series={data.evaluation.criteria.slice(0, 8).map((c, i) => ({ key: c.id, label: prettyId(c.id), color: PALETTE[i] }))} yFormat={(v) => `${v.toFixed(0)}%`} yMax={100} height={260} />
                          </div>
                          <Legend series={data.evaluation.criteria.slice(0, 8).map((c, i) => ({ key: c.id, label: prettyId(c.id), color: PALETTE[i] }))} shape="line" />
                        </Card>
                      )}
                      <Card>
                        <CardHead title="Details captured" icon={<ListChecks className="h-4 w-4" />} hint="How often the agent collected each field. Contact details never show values here." />
                        <div className="overflow-x-auto px-5 pb-4 pt-3">
                          {data.data_collection.length === 0 ? (
                            <Empty height={120} text="No data fields configured on the agent yet" />
                          ) : (
                            <table className="w-full min-w-[640px] text-sm">
                              <thead>
                                <tr className="text-left text-xs text-[#898781]">
                                  <th className="pb-2 font-normal">Field</th>
                                  <th className="w-1/3 pb-2 font-normal">Captured</th>
                                  <th className="pb-2 font-normal">Most common answers</th>
                                </tr>
                              </thead>
                              <tbody>
                                {data.data_collection.map((f) => (
                                  <tr key={f.id} className="border-t border-black/[0.06] align-top">
                                    <td className="py-2.5 font-medium text-[#0b0b0b]">{prettyId(f.id)}</td>
                                    <td className="py-2.5 pr-4">
                                      <div className="flex items-center gap-2">
                                        <Meter value={f.rate} color={PALETTE[2]} />
                                        <span className="w-20 text-right text-xs tabular-nums text-[#52514e]">
                                          {f.collected}/{f.total}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-2.5">
                                      <div className="flex flex-wrap gap-1">
                                        {f.top_values.length ? (
                                          f.top_values.map((v) => (
                                            <span key={v.value} className="rounded-md bg-[#f4f3ef] px-1.5 py-0.5 text-xs text-[#0b0b0b]">
                                              {v.value} <span className="text-[#898781]">×{v.count}</span>
                                            </span>
                                          ))
                                        ) : (
                                          <span className="text-xs text-[#898781]">—</span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </Card>
                    </>
                  )}

                  {/* =========================================== SPEED & AI USAGE */}
                  {section === "speed" && (
                    <>
                      <SectionTitle title="Speed & AI usage" sub="Where reply time goes, and what the AI services consumed" />
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                        <StatCard icon={<GaugeIcon className="h-4 w-4" />} label="Typical reply" value={fmt.ms(k.median_response_ms)} current={k.median_response_ms} previous={p.median_response_ms} lowerIsBetter spark={spark("response_ms")} color={PALETTE[2]} />
                        <StatCard icon={<Timer className="h-4 w-4" />} label="Slowest 10%" value={fmt.ms(k.p90_response_ms)} current={k.p90_response_ms} previous={p.p90_response_ms} lowerIsBetter />
                        <StatCard icon={<Sparkles className="h-4 w-4" />} label="AI first word" value={fmt.ms(k.avg_llm_ttfb_ms)} current={k.avg_llm_ttfb_ms} previous={p.avg_llm_ttfb_ms} lowerIsBetter spark={spark("llm_ttfb_ms")} color={PALETTE[6]} />
                        <StatCard icon={<Bot className="h-4 w-4" />} label="Voice start" value={fmt.ms(k.avg_tts_ttfb_ms)} current={k.avg_tts_ttfb_ms} previous={p.avg_tts_ttfb_ms} lowerIsBetter spark={spark("tts_ttfb_ms")} color={PALETTE[1]} />
                        <StatCard icon={<PhoneCall className="h-4 w-4" />} label="Hearing the caller" value={fmt.ms(k.avg_asr_ms)} current={k.avg_asr_ms} previous={p.avg_asr_ms} lowerIsBetter spark={spark("asr_ms")} color={PALETTE[3]} />
                      </div>
                      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
                        <Card>
                          <CardHead title="Where the reply time goes" hint="Average per period: transcribing the caller, the AI's first word, and starting the voice. Whatever is left of the reply time is mostly waiting on integrations." />
                          <div className="px-2 pt-2">
                            <Columns
                              data={series}
                              series={[
                                { key: "asr_ms", label: "Hearing", color: PALETTE[3] },
                                { key: "llm_ttfb_ms", label: "AI thinking", color: PALETTE[6] },
                                { key: "tts_ttfb_ms", label: "Voice start", color: PALETTE[1] },
                              ]}
                              stacked
                              yFormat={(v) => fmt.ms(v)}
                              height={260}
                            />
                          </div>
                          <Legend series={[{ key: "a", label: "Hearing", color: PALETTE[3] }, { key: "b", label: "AI thinking", color: PALETTE[6] }, { key: "c", label: "Voice start", color: PALETTE[1] }]} />
                        </Card>
                        <Card>
                          <CardHead title="Reply time vs goal" figure={<span className="text-base">{fmt.ms(k.median_response_ms)}</span>} />
                          <div className="px-2 pb-4 pt-2">
                            <Columns data={series} series={[{ key: "response_ms", label: "Reply time", color: PALETTE[2] }]} yFormat={(v) => fmt.ms(v)} height={260} reference={{ value: 1000, label: "1 s goal" }} />
                          </div>
                        </Card>
                        <Card>
                          <CardHead title="AI model spend" figure={<span className="text-base">{fmt.usd(k.total_llm_cost, 2)}</span>} actions={<CsvButton name="ai-llm-cost" rows={series} series={[{ key: "llm_cost", label: "LLM cost" }]} />} />
                          <div className="px-2 pb-4 pt-2">
                            <Columns data={series} series={[{ key: "llm_cost", label: "AI spend", color: PALETTE[6] }]} yFormat={(v) => fmt.usd(v, 2)} height={220} />
                          </div>
                        </Card>
                        <Card>
                          <CardHead title="AI requests" figure={<span className="text-base">{fmt.num(k.llm_requests)}</span>} />
                          <div className="px-2 pb-4 pt-2">
                            <Columns data={series} series={[{ key: "llm_requests", label: "Requests", color: PALETTE[0] }]} integer height={220} />
                          </div>
                        </Card>
                        <Card>
                          <CardHead title="Speech minutes" figure={<span className="text-base">{k.tts_minutes} min agent · {k.asr_minutes} min caller</span>} />
                          <div className="px-2 pt-2">
                            <Columns
                              data={series}
                              series={[
                                { key: "agent_minutes", label: "Agent speaking", color: PALETTE[0] },
                                { key: "caller_minutes", label: "Caller speaking", color: PALETTE[1] },
                              ]}
                              yFormat={(v) => `${v.toFixed(1)}m`}
                              height={220}
                            />
                          </div>
                          <Legend series={[{ key: "a", label: "Agent speaking", color: PALETTE[0] }, { key: "b", label: "Caller speaking", color: PALETTE[1] }]} />
                        </Card>
                        <Card>
                          <CardHead title="Models used" />
                          <div className="px-5 pb-5 pt-3">
                            <RankBars items={Object.entries(data.llm.models).map(([name, n]) => ({ label: name, value: n }))} total={total} color={PALETTE[6]} />
                          </div>
                        </Card>
                      </div>
                    </>
                  )}

                  {/* =========================================== INTEGRATIONS */}
                  {section === "tools" && (
                    <>
                      <SectionTitle title="Integrations" sub="Every WindshieldHUB API and system action the agent called" />
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <StatCard icon={<Wrench className="h-4 w-4" />} label="Calls to integrations" value={fmt.num(k.tool_calls)} current={k.tool_calls} previous={p.tool_calls} spark={spark("tool_calls")} />
                        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Failed" value={fmt.num(k.tool_errors)} sub={fmt.pct(k.tool_error_rate, 1)} current={k.tool_errors} previous={p.tool_errors} lowerIsBetter spark={spark("tool_errors")} color={STATUS.critical} />
                        <StatCard icon={<Timer className="h-4 w-4" />} label="Average wait" value={fmt.ms(k.avg_tool_latency_ms)} current={k.avg_tool_latency_ms} previous={p.avg_tool_latency_ms} lowerIsBetter spark={spark("tool_latency_ms")} color={PALETTE[1]} />
                        <StatCard icon={<Activity className="h-4 w-4" />} label="Per call" value={total ? (k.tool_calls / total).toFixed(1) : "—"} sub="integration calls" />
                      </div>
                      <Card>
                        <CardHead title="By integration" hint="Red = fails 20%+ of the time. Amber wait = 3 s or more (the caller hears silence or filler)." />
                        <div className="overflow-x-auto px-5 pb-4 pt-3">
                          {data.tools.list.length === 0 ? (
                            <Empty height={120} />
                          ) : (
                            <table className="w-full min-w-[720px] text-sm">
                              <thead>
                                <tr className="text-left text-xs text-[#898781]">
                                  <th className="pb-2 font-normal">Integration</th>
                                  <th className="pb-2 text-right font-normal">Calls</th>
                                  <th className="w-1/4 pb-2 pl-6 font-normal">Failure rate</th>
                                  <th className="w-1/4 pb-2 pl-6 font-normal">Average wait</th>
                                </tr>
                              </thead>
                              <tbody>
                                {data.tools.list.map((t) => {
                                  const bad = t.error_rate >= 20;
                                  const slow = (t.avg_latency_ms ?? 0) >= 3000;
                                  return (
                                    <tr key={t.name} className="border-t border-black/[0.06]">
                                      <td className="py-2.5 font-mono text-xs text-[#0b0b0b]">{t.name}</td>
                                      <td className="py-2.5 text-right font-semibold tabular-nums">{t.calls}</td>
                                      <td className="py-2.5 pl-6">
                                        <div className="flex items-center gap-2">
                                          <Meter value={t.error_rate} color={bad ? STATUS.critical : "#b9b7ae"} />
                                          <span className={cn("w-14 text-right text-xs tabular-nums", bad ? "font-semibold text-[#b42323]" : "text-[#52514e]")}>
                                            {bad && <AlertTriangle className="mr-0.5 inline h-3 w-3" />}
                                            {fmt.pct(t.error_rate)}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="py-2.5 pl-6">
                                        <div className="flex items-center gap-2">
                                          <Meter value={t.avg_latency_ms} max={Math.max(...data.tools.list.map((x) => x.avg_latency_ms ?? 0), 1)} color={slow ? STATUS.serious : PALETTE[1]} />
                                          <span className={cn("w-16 text-right text-xs tabular-nums", slow ? "font-semibold text-[#9a4a1f]" : "text-[#52514e]")}>{fmt.ms(t.avg_latency_ms)}</span>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </Card>
                      <Card>
                        <CardHead title="Why integrations failed" icon={<AlertTriangle className="h-4 w-4" />} hint="Failed requests grouped by integration and error, from the most recent calls with failures." />
                        <div className="space-y-2 px-5 pb-5 pt-3">
                          {data.tools.failures.length === 0 ? (
                            <Empty height={100} text="No integration failures in this period" />
                          ) : (
                            data.tools.failures.map((f) => (
                              <details key={`${f.tool}|${f.error}`} className="group rounded-xl border border-black/[0.07] bg-[#fbfaf7] open:bg-white">
                                <summary className="flex cursor-pointer list-none flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3">
                                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: STATUS.critical }} />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-x-2">
                                      <span className="font-mono text-xs font-semibold text-[#0b0b0b]">{f.tool}</span>
                                      {f.error && <span className="truncate text-xs text-[#b42323]">{f.error}</span>}
                                    </div>
                                    <p className="mt-0.5 text-sm text-[#0b0b0b]">{f.reason}</p>
                                  </div>
                                  <div className="shrink-0 text-right text-xs text-[#52514e]">
                                    <div>
                                      <b className="text-[#0b0b0b]">{f.count}×</b> in {f.affected_calls} call{f.affected_calls === 1 ? "" : "s"}
                                    </div>
                                    {f.last_seen && <div className="text-[#898781]">last {new Date(f.last_seen).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>}
                                  </div>
                                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-[#898781] transition group-open:rotate-180" />
                                </summary>
                                <div className="grid gap-3 border-t border-black/[0.06] px-4 py-3 md:grid-cols-2">
                                  <div>
                                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#898781]">Example request</div>
                                    <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#f4f3ef] p-2 text-[11px] text-[#0b0b0b]">{f.example.request === null || f.example.request === undefined ? "—" : typeof f.example.request === "string" ? f.example.request : JSON.stringify(f.example.request, null, 2)}</pre>
                                  </div>
                                  <div>
                                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#898781]">Response received</div>
                                    <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#f4f3ef] p-2 text-[11px] text-[#0b0b0b]">{f.example.response === null || f.example.response === undefined ? "—" : typeof f.example.response === "string" ? f.example.response : JSON.stringify(f.example.response, null, 2)}</pre>
                                  </div>
                                  <Link href={`/ai-calls?call=${f.example.call_id}`} className="inline-flex items-center gap-1 text-xs font-medium text-[#1c5cab] hover:underline md:col-span-2">
                                    Open the call where this happened{f.example.call_title ? ` — ${f.example.call_title}` : ""} <CornerDownRight className="h-3 w-3" />
                                  </Link>
                                </div>
                              </details>
                            ))
                          )}
                        </div>
                      </Card>
                      <Card>
                        <CardHead
                          title="Busiest integrations over time"
                          actions={
                            <>
                              <Segmented
                                size="sm"
                                value={toolMetric}
                                onChange={setToolMetric}
                                options={[
                                  { value: "latency", label: "Wait" },
                                  { value: "calls", label: "Calls" },
                                  { value: "errors", label: "Failures" },
                                  { value: "error_rate", label: "Failure %" },
                                ]}
                              />
                              <CsvButton name={`ai-tools-${toolMetric}`} rows={data.tools.series[toolMetric]} series={toolSeries} />
                            </>
                          }
                        />
                        <div className="px-2 pt-2">
                          <Lines
                            data={data.tools.series[toolMetric]}
                            series={toolSeries}
                            yFormat={toolMetric === "latency" ? (v) => fmt.ms(v) : toolMetric === "error_rate" ? (v) => `${v.toFixed(0)}%` : (v) => fmt.num(v)}
                            integer={toolMetric === "calls" || toolMetric === "errors"}
                            height={280}
                          />
                        </div>
                        <Legend series={toolSeries} shape="line" />
                      </Card>
                    </>
                  )}

                  {/* =========================================== CALL FLOW */}
                  {section === "flow" && (
                    <>
                      <SectionTitle title="Call flow" sub={`Which steps of ${data.workflow.name ?? "the agent's workflow"} callers reached`} />
                      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
                        <Card className="p-4">
                          <WorkflowGraph graph={data.workflow} visits={Object.fromEntries(Object.entries(data.workflow.visits).map(([id, v]) => [id, v.conversations]))} unit="calls" />
                        </Card>
                        <Card>
                          <CardHead title="Step reach" />
                          <div className="px-5 pb-5 pt-3">
                            <RankBars
                              items={Object.entries(data.workflow.visits)
                                .sort((a, b) => b[1].conversations - a[1].conversations)
                                .map(([id, v]) => ({ label: data.workflow.nodes.find((n) => n.id === id)?.label ?? id, value: v.conversations, hint: `${v.turns} turns` }))}
                              total={total}
                              color={PALETTE[0]}
                            />
                          </div>
                        </Card>
                      </div>
                    </>
                  )}

                  {/* =========================================== OUTCOMES */}
                  {section === "outcomes" && (
                    <>
                      <SectionTitle title="Outcomes" sub="From first hello to a booked job" />
                      <Card>
                        <CardHead title="Booking funnel" icon={<CalendarCheck className="h-4 w-4" />} />
                        <div className="px-5 pb-5 pt-4">
                          {(() => {
                            const o = data.outcomes;
                            const engaged = total - (o.hang_up ?? 0);
                            const quoted = (o.quoted ?? 0) + (o.slot_held ?? 0) + (o.payment_pending ?? 0) + (o.booked ?? 0) + (o.transferred ?? 0);
                            const advanced = (o.slot_held ?? 0) + (o.payment_pending ?? 0) + (o.booked ?? 0);
                            return (
                              <Funnel
                                steps={[
                                  { label: "Calls answered", value: total },
                                  { label: "Real conversations", value: engaged },
                                  { label: "Got a price / handed off", value: quoted },
                                  { label: "Slot held or paying", value: advanced },
                                  { label: "Booked", value: o.booked ?? 0 },
                                ]}
                              />
                            );
                          })()}
                        </div>
                      </Card>
                      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                        <Card>
                          <CardHead title="Outcomes per period" actions={<CsvButton name="ai-outcomes" rows={series} series={["booked", "transferred", "quoted", "other", "hang_up"].map((key) => ({ key, label: key }))} />} />
                          <div className="px-2 pt-2">
                            <Columns
                              data={series}
                              series={[
                                { key: "booked", label: "Booked", color: OUTCOME_COLOR.booked },
                                { key: "transferred", label: "Transferred", color: OUTCOME_COLOR.transferred },
                                { key: "quoted", label: "Quoted", color: OUTCOME_COLOR.quoted },
                                { key: "other", label: "Other", color: OUTCOME_COLOR.other },
                                { key: "hang_up", label: "Hang-up", color: OUTCOME_COLOR.hang_up },
                              ]}
                              stacked
                              integer
                              height={280}
                            />
                          </div>
                          <Legend
                            series={[
                              { key: "a", label: "Booked", color: OUTCOME_COLOR.booked },
                              { key: "b", label: "Transferred", color: OUTCOME_COLOR.transferred },
                              { key: "c", label: "Quoted", color: OUTCOME_COLOR.quoted },
                              { key: "d", label: "Other", color: OUTCOME_COLOR.other },
                              { key: "e", label: "Hang-up", color: OUTCOME_COLOR.hang_up },
                            ]}
                          />
                        </Card>
                        <Card>
                          <CardHead title="All outcomes" />
                          <div className="space-y-2 px-5 pb-5 pt-3">
                            {Object.keys(data.outcomes).length === 0 && <Empty height={120} />}
                            {Object.entries(data.outcomes)
                              .sort((a, b) => b[1] - a[1])
                              .map(([o, n]) => (
                                <div key={o} className="flex items-center gap-3 text-sm">
                                  <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: OUTCOME_COLOR[o] ?? "#b9b7ae" }} />
                                  <span className="flex-1 text-[#0b0b0b]">{OUTCOME_META[o]?.label ?? o}</span>
                                  <span className="font-semibold tabular-nums">{n}</span>
                                  <span className="w-10 text-right text-xs tabular-nums text-[#898781]">{fmt.pct(total ? (n / total) * 100 : 0)}</span>
                                </div>
                              ))}
                          </div>
                        </Card>
                      </div>
                    </>
                  )}
                </div>
              )}
            </main>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
