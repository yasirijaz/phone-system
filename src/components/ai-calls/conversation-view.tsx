"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Copy,
  FileText,
  GitBranch,
  Loader2,
  Pause,
  Phone,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Wrench,
  XCircle,
} from "lucide-react";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { cn, formatPhoneNumber } from "@/lib/utils";
import { getAiCall, getAiCallRecordingUrl, refreshAiCall, type AiCallShowResponse, type ConversationTurn } from "@/services/aiCallService";
import { Card, CardHead, DIVERGING, PALETTE, STATUS, Segmented, fmt, prettyId } from "./ai-charts";
import { WorkflowGraph } from "./workflow-graph";

export const OUTCOME_META: Record<string, { label: string; className: string }> = {
  booked: { label: "Booked", className: "bg-[#2a78d6]/10 text-[#1c5cab]" },
  transferred: { label: "Transferred", className: "bg-[#6250d6]/10 text-[#4a3aa7]" },
  payment_pending: { label: "Payment pending", className: "bg-[#eda100]/[0.15] text-[#7a5300]" },
  slot_held: { label: "Slot held", className: "bg-[#e87ba4]/[0.15] text-[#9b2c57]" },
  quoted: { label: "Quoted", className: "bg-[#1baf7a]/[0.12] text-[#0f6b4a]" },
  not_booked: { label: "Not booked", className: "bg-[#f0efea] text-[#52514e]" },
  hang_up: { label: "Hang-up", className: "bg-[#f0efea] text-[#898781]" },
  failed: { label: "Failed", className: "bg-[#d03b3b]/10 text-[#b42323]" },
};

export function SentimentBadge({ label, score }: { label: string | null | undefined; score?: number | null }) {
  if (!label) return <span className="text-xs text-[#898781]">—</span>;
  const color = label === "positive" ? DIVERGING.positive : label === "negative" ? DIVERGING.negative : "#b9b7ae";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs capitalize text-[#52514e]">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
      {score !== undefined && score !== null && <span className="tabular-nums text-[#898781]">{fmt.score(score)}</span>}
    </span>
  );
}

/** Small ring showing a 0–100 score. */
export function EvalBadge({ score, size = 30 }: { score: number | null | undefined; size?: number }) {
  if (score === null || score === undefined) return <span className="text-xs text-[#898781]">—</span>;
  const r = 12;
  const c = 2 * Math.PI * r;
  return (
    <span className="inline-flex items-center gap-1.5" title={`${score}% of checks passed`}>
      <svg viewBox="0 0 30 30" style={{ width: size, height: size }} aria-hidden>
        <circle cx="15" cy="15" r={r} fill="none" stroke="#efeee9" strokeWidth="4" />
        <circle cx="15" cy="15" r={r} fill="none" stroke={PALETTE[0]} strokeWidth="4" strokeDasharray={`${(score / 100) * c} ${c}`} strokeLinecap="round" transform="rotate(-90 15 15)" />
      </svg>
      <span className="text-xs font-semibold tabular-nums text-[#0b0b0b]">{score}%</span>
    </span>
  );
}

function frustrationLabel(v: number | null | undefined) {
  if (v === null || v === undefined) return null;
  return v >= 0.6 ? "high" : v >= 0.3 ? "moderate" : "low";
}

function pretty(value: unknown) {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function clock(secs: number | null | undefined) {
  if (secs === null || secs === undefined || Number.isNaN(secs)) return "0:00";
  return `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;
}

function CopyValue({ value, mono, children }: { value: string; mono?: boolean; children?: ReactNode }) {
  const { toast } = useToast();
  return (
    <button
      type="button"
      className={cn("group inline-flex max-w-full items-center gap-1 text-left text-[#0b0b0b]", mono && "font-mono text-xs")}
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        toast({ title: "Copied" });
      }}
    >
      <span className="truncate">{children ?? value}</span>
      <Copy className="h-3 w-3 shrink-0 text-[#898781] opacity-0 group-hover:opacity-100" />
    </button>
  );
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(110px,40%)_1fr] gap-x-3 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-[#898781]">{k}</dt>
          <dd className="min-w-0 break-words text-[#0b0b0b]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ transcript */

function FailureWhy({ reason, error, response }: { reason?: string | null; error?: string | null; response?: unknown }) {
  return (
    <div className="space-y-1.5 rounded-lg border border-[#d03b3b]/25 bg-white p-3 text-left">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#b42323]">Why it failed</div>
      <p className="text-xs leading-relaxed text-[#0b0b0b]">{reason ?? "The request failed. See the error and response below."}</p>
      {error && (
        <div className="text-[11px] text-[#52514e]">
          Error: <span className="font-mono">{error}</span>
        </div>
      )}
      {response !== undefined && response !== null && response !== "" && (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-[#fbfaf7] p-2 text-[11px] text-[#0b0b0b]">{pretty(response)}</pre>
      )}
    </div>
  );
}

function IntegrationRow({ tool, time }: { tool: ConversationTurn["tools"][number]; time: number | null }) {
  const failed = tool.ok === false;
  const [open, setOpen] = useState(false);
  const slow = (tool.latency_ms ?? 0) >= 3000;
  return (
    <div className="my-1 flex justify-center">
      <div className={cn("w-full max-w-[560px] rounded-xl border border-dashed text-xs", failed ? "border-[#d03b3b]/40 bg-[#d03b3b]/[0.04]" : "border-black/15 bg-[#fbfaf7]")}>
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left">
          <Wrench className="h-3.5 w-3.5 shrink-0 text-[#898781]" />
          <span className="font-mono text-[#0b0b0b]">{tool.name}</span>
          {failed ? (
            <span className="inline-flex items-center gap-0.5 font-medium text-[#b42323]">
              <XCircle className="h-3.5 w-3.5" /> failed
            </span>
          ) : tool.ok ? (
            <span className="inline-flex items-center gap-0.5 text-[#006300]">
              <BadgeCheck className="h-3.5 w-3.5" /> ok
            </span>
          ) : null}
          {tool.latency_ms !== null && <span className={cn("tabular-nums", slow ? "font-semibold text-[#9a4a1f]" : "text-[#52514e]")}>{fmt.ms(tool.latency_ms)}</span>}
          <span className="ml-auto tabular-nums text-[#898781]">{clock(time)}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 text-[#898781] transition", open && "rotate-180")} />
        </button>
        {/* failures always show the reason, without needing to expand */}
        {failed && (
          <div className="px-3 pb-2">
            <FailureWhy reason={tool.reason} error={tool.error} response={open ? undefined : tool.result} />
          </div>
        )}
        {open && (
          <div className="grid gap-2 border-t border-black/[0.06] p-3 md:grid-cols-2">
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#898781]">Sent</div>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-2 text-[11px] text-[#0b0b0b]">{pretty(tool.params) || "—"}</pre>
            </div>
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#898781]">Received</div>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-2 text-[11px] text-[#0b0b0b]">{pretty(tool.result) || "—"}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Bubble({ turn, step, active, onSeek }: { turn: ConversationTurn; step: string | null; active: boolean; onSeek: (t: number) => void }) {
  const [timing, setTiming] = useState(false);
  const agent = turn.role === "agent";
  const m = turn.metrics;
  return (
    <div className={cn("flex", agent ? "justify-start" : "justify-end")}>
      <div className={cn("max-w-[78%]", !agent && "text-right")}>
        <div className={cn("mb-0.5 flex items-center gap-2 text-[11px] text-[#898781]", !agent && "justify-end")}>
          <button type="button" onClick={() => turn.time !== null && onSeek(turn.time)} className="tabular-nums hover:text-[#0b0b0b]">
            {clock(turn.time)}
          </button>
          <span>{agent ? "Agent" : "Caller"}</span>
          {agent && step && <span className="rounded bg-[#f0efea] px-1.5 text-[10px] text-[#52514e]">{step}</span>}
          {turn.interrupted && <span className="rounded bg-[#eda100]/[0.15] px-1.5 text-[10px] text-[#7a5300]">cut off</span>}
        </div>
        <div
          className={cn(
            "inline-block whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-left text-sm leading-relaxed",
            agent ? "rounded-tl-md bg-[#f0efea] text-[#0b0b0b]" : "rounded-tr-md bg-[#2a78d6] text-white",
            active && "ring-2 ring-[#eda100] ring-offset-2",
          )}
        >
          {turn.message}
        </div>
        <div className={cn("mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-[#898781]", !agent && "justify-end")}>
          {agent && m.response_ms !== null && (turn.time ?? 0) > 0 && (
            <span className={cn("tabular-nums", m.response_ms >= 2000 && "font-semibold text-[#9a4a1f]")}>replied in {fmt.ms(m.response_ms)}</span>
          )}
          {!agent && turn.sentiment !== null && <span className="tabular-nums">mood {fmt.score(turn.sentiment)}</span>}
          {agent && (m.llm_ttfb_ms !== null || m.tts_ttfb_ms !== null) && (
            <button type="button" onClick={() => setTiming((t) => !t)} className="underline-offset-2 hover:underline">
              {timing ? "hide timing" : "timing"}
            </button>
          )}
        </div>
        {timing && (
          <div className="mt-1 inline-grid grid-cols-2 gap-x-4 gap-y-0.5 rounded-lg border border-black/[0.06] bg-white px-3 py-2 text-left text-[11px] text-[#52514e]">
            <span>Silence detected: {fmt.ms(m.silence_ms)}</span>
            <span>Transcript ready: {fmt.ms(m.asr_ms)}</span>
            <span>AI first token: {fmt.ms(m.llm_ttfb_ms)}</span>
            <span>AI first sentence: {fmt.ms(m.llm_ttf_sentence_ms)}</span>
            <span>AI finished: {fmt.ms(m.llm_last_sentence_ms)}</span>
            <span>Voice first byte: {fmt.ms(m.tts_ttfb_ms)}</span>
            {m.tool_request_ms !== null && <span>Integration request: {fmt.ms(m.tool_request_ms)}</span>}
            {turn.llm_cost !== null && <span>AI cost: {fmt.usd(turn.llm_cost, 4)}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ player with speaker lanes */

function Player({ callId, hasAudio, duration, turns, audioRef, onTime }: { callId: number; hasAudio: boolean; duration: number; turns: ConversationTurn[]; audioRef: React.RefObject<HTMLAudioElement | null>; onTime: (t: number) => void }) {
  const { toast } = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [rate, setRate] = useState(1);
  const [total, setTotal] = useState(duration);

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  const ensure = async () => {
    if (url) return true;
    try {
      setLoading(true);
      setUrl(await getAiCallRecordingUrl(callId));
      return true;
    } catch {
      toast({ title: "Recording not available", variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    if (!url) {
      if (await ensure()) window.setTimeout(() => void audioRef.current?.play(), 50);
      return;
    }
    const a = audioRef.current;
    if (a) (a.paused ? a.play() : (a.pause(), Promise.resolve())).catch(() => undefined);
  };

  const seekTo = async (t: number) => {
    if (!hasAudio) return;
    if (await ensure()) window.setTimeout(() => audioRef.current && (audioRef.current.currentTime = t), 60);
  };

  // Speaker segments: each turn runs until the next one starts.
  const lanes = useMemo(() => {
    const spoken = turns.filter((t) => t.time !== null && t.message);
    return spoken.map((t, i) => {
      const start = t.time as number;
      const end = Math.min(total || start + 2, spoken[i + 1]?.time ?? start + 3);
      return { role: t.role, start, end: Math.max(end, start + 0.8), failed: false };
    });
  }, [turns, total]);
  const failures = turns.filter((t) => t.tools.some((x) => x.ok === false) && t.time !== null).map((t) => t.time as number);
  const pct = (s: number) => `${Math.min(100, (s / Math.max(1, total)) * 100)}%`;

  return (
    <Card className="px-4 py-3">
      <audio
        ref={audioRef}
        src={url ?? undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          setTime(e.currentTarget.currentTime);
          onTime(e.currentTarget.currentTime);
        }}
        onLoadedMetadata={(e) => {
          e.currentTarget.playbackRate = rate;
          if (Number.isFinite(e.currentTarget.duration)) setTotal(e.currentTarget.duration);
        }}
        className="hidden"
      />
      <div className="flex items-center gap-4">
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={toggle} disabled={!hasAudio || loading} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0b0b0b] text-white disabled:opacity-30" aria-label={playing ? "Pause" : "Play"}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
          </button>
          <button type="button" disabled={!url} onClick={() => audioRef.current && (audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10))} className="rounded-lg p-1.5 text-[#52514e] hover:bg-[#f4f3ef] disabled:opacity-30" aria-label="Back 10 seconds">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button type="button" disabled={!url} onClick={() => audioRef.current && (audioRef.current.currentTime = Math.min(total, audioRef.current.currentTime + 10))} className="rounded-lg p-1.5 text-[#52514e] hover:bg-[#f4f3ef] disabled:opacity-30" aria-label="Forward 10 seconds">
            <RotateCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!hasAudio}
            onClick={() => {
              const next = rate === 1 ? 1.25 : rate === 1.25 ? 1.5 : rate === 1.5 ? 2 : 1;
              setRate(next);
              if (audioRef.current) audioRef.current.playbackRate = next;
            }}
            className="w-11 rounded-lg py-1 text-xs font-medium tabular-nums text-[#52514e] hover:bg-[#f4f3ef] disabled:opacity-30"
          >
            {rate}×
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={cn("relative space-y-1", hasAudio && "cursor-pointer")}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              void seekTo(((e.clientX - rect.left) / rect.width) * total);
            }}
          >
            {(["agent", "user"] as const).map((role) => (
              <div key={role} className="relative h-3.5 rounded-full bg-[#f4f3ef]">
                {lanes
                  .filter((l) => l.role === role)
                  .map((l, i) => (
                    <span key={i} className="absolute inset-y-0 rounded-full" style={{ left: pct(l.start), width: `calc(${pct(l.end - l.start)} - 2px)`, background: role === "agent" ? "#b9b7ae" : PALETTE[0] }} />
                  ))}
              </div>
            ))}
            {failures.map((t, i) => (
              <span key={i} title="Integration failed here" className="absolute -top-1 h-2 w-2 -translate-x-1/2 rotate-45" style={{ left: pct(t), background: STATUS.critical }} />
            ))}
            <span className="pointer-events-none absolute -bottom-1 -top-1 w-0.5 rounded bg-[#eda100]" style={{ left: pct(time) }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#898781]">
            <span className="inline-flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[#b9b7ae]" /> Agent
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: PALETTE[0] }} /> Caller
              </span>
              {failures.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rotate-45" style={{ background: STATUS.critical }} /> Integration failed
                </span>
              )}
            </span>
            <span className="tabular-nums">
              {clock(time)} / {clock(total)}
            </span>
          </div>
        </div>
      </div>
      {!hasAudio && <p className="mt-1 text-xs text-[#898781]">No recording was kept for this call.</p>}
    </Card>
  );
}

/* ------------------------------------------------------------------ main */

export { FailureWhy };

export function ConversationView({
  callId,
  position,
  onClose,
  onPrev,
  onNext,
  onChanged,
}: {
  callId: number;
  position?: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  const [data, setData] = useState<AiCallShowResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [panel, setPanel] = useState<"insights" | "details" | "path" | "integrations">("insights");
  const [playhead, setPlayhead] = useState(-1);
  const [showVars, setShowVars] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setData(await getAiCall(callId));
    } catch {
      setData(null);
      toast({ title: "Could not load this call", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [callId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const stepLabels = useMemo(() => Object.fromEntries((data?.workflow.nodes ?? []).map((n) => [n.id, n.label])), [data]);
  const seek = (t: number) => {
    const a = audioRef.current;
    if (a && a.src) {
      a.currentTime = t;
      void a.play();
    }
  };
  const activeIndex = useMemo(() => {
    if (!data || playhead < 0) return -1;
    let idx = -1;
    data.turns.forEach((t, i) => {
      if (t.time !== null && t.time <= playhead && t.message) idx = i;
    });
    return idx;
  }, [data, playhead]);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await refreshAiCall(callId);
      await load();
      onChanged?.();
    } catch {
      toast({ title: "Could not re-sync from ElevenLabs", variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  const call = data?.call;
  const moodRows = useMemo(() => (data?.turns ?? []).filter((t) => t.sentiment !== null).map((t) => ({ label: clock(t.time), value: t.sentiment })), [data]);
  const tools = useMemo(() => (data?.turns ?? []).flatMap((t) => t.tools.map((tool) => ({ tool, time: t.time }))), [data]);

  return (
    <div className="flex h-full flex-col bg-[#f9f9f7]">
      {/* top bar */}
      <div className="flex items-center gap-2 border-b border-black/[0.06] bg-white px-4 py-2.5 md:px-6">
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-[#52514e] hover:bg-[#f4f3ef]">
          <ArrowLeft className="h-4 w-4" /> Call log
        </button>
        <span className="mx-1 h-5 w-px bg-black/10" />
        <div className="min-w-0 flex-1 truncate text-sm font-semibold text-[#0b0b0b]">{call?.title ?? "Call"}</div>
        {position && <span className="text-xs tabular-nums text-[#898781]">{position}</span>}
        <button type="button" disabled={!onPrev} onClick={onPrev} className="rounded-lg p-1.5 text-[#52514e] hover:bg-[#f4f3ef] disabled:opacity-30" aria-label="Newer call">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" disabled={!onNext} onClick={onNext} className="rounded-lg p-1.5 text-[#52514e] hover:bg-[#f4f3ef] disabled:opacity-30" aria-label="Older call">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={onRefresh} disabled={refreshing || !call} className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1 text-xs font-medium text-[#0b0b0b] hover:bg-[#f4f3ef]">
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> Re-sync
        </button>
      </div>

      {loading && !data ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#898781]" />
        </div>
      ) : !data || !call ? (
        <div className="flex flex-1 items-center justify-center text-sm text-[#898781]">This call couldn&apos;t be found.</div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-4 px-4 py-4 md:px-6">
            {/* hero */}
            <Card className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2a78d6]/10 text-[#1c5cab]">
                  <Phone className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-base font-semibold text-[#0b0b0b]">{call.customer_number ? formatPhoneNumber(call.customer_number) : call.initiation_source === "react_sdk" ? "Web test call" : "Unknown caller"}</div>
                  <div className="text-xs text-[#898781]">
                    {call.started_at ? new Date(call.started_at).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}
                    {call.routing_reason && ` · ${call.routing_reason === "after_hours" ? "after hours" : "team didn't pick up"}`}
                  </div>
                </div>
              </div>
              {[
                ["Outcome", <span key="o" className={cn("rounded-md px-2 py-0.5 text-xs font-medium", OUTCOME_META[call.outcome ?? ""]?.className ?? "bg-[#f0efea]")}>{OUTCOME_META[call.outcome ?? ""]?.label ?? "—"}</span>],
                ["Checks passed", <EvalBadge key="e" score={data.evaluation_score} />],
                ["Mood", <span key="m" className="flex items-center gap-2"><SentimentBadge label={call.sentiment_label} score={call.sentiment_score} />{frustrationLabel(call.frustration_score) && <span className="text-xs text-[#898781]">· {frustrationLabel(call.frustration_score)} frustration</span>}</span>],
                ["Length", <span key="l" className="font-semibold tabular-nums">{fmt.duration(call.duration_secs)}</span>],
                ["Typical reply", <span key="r" className="font-semibold tabular-nums">{fmt.ms(call.median_response_ms)}</span>],
                ["Cost", <span key="c" className="font-semibold tabular-nums">{fmt.usd(call.cost, 2)}</span>],
              ].map(([label, node]) => (
                <div key={label as string}>
                  <div className="text-[11px] uppercase tracking-wide text-[#898781]">{label}</div>
                  <div className="mt-0.5">{node}</div>
                </div>
              ))}
            </Card>

            <Player key={call.id} callId={call.id} hasAudio={call.has_audio} duration={call.duration_secs ?? 0} turns={data.turns} audioRef={audioRef} onTime={setPlayhead} />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(380px,1fr)]">
              {/* conversation */}
              <Card className="flex min-h-[420px] flex-col">
                <CardHead title="Conversation" icon={<FileText className="h-4 w-4" />} actions={<span className="text-xs text-[#898781]">{call.message_count ?? data.turns.length} messages</span>} />
                <div className="space-y-3 px-5 pb-5 pt-4">
                  {data.turns.map((t, i) => (
                    <div key={i} className="space-y-1">
                      {t.message && <Bubble turn={t} step={t.node_id ? stepLabels[t.node_id] ?? null : null} active={i === activeIndex} onSeek={seek} />}
                      {t.tools.map((tool, j) => (
                        <IntegrationRow key={j} tool={tool} time={t.time} />
                      ))}
                    </div>
                  ))}
                  {call.termination_reason && <div className="pt-2 text-center text-xs text-[#898781]">— {call.termination_reason} —</div>}
                </div>
              </Card>

              {/* side panel */}
              <div className="space-y-4">
                <Segmented
                  value={panel}
                  onChange={setPanel}
                  options={[
                    { value: "insights", label: "Insights" },
                    { value: "details", label: "Details" },
                    { value: "path", label: "Path" },
                    { value: "integrations", label: `Integrations${tools.length ? ` (${tools.length})` : ""}` },
                  ]}
                />

                {panel === "insights" && (
                  <>
                    <Card>
                      <CardHead title="What happened" />
                      <p className="whitespace-pre-wrap px-5 pb-5 pt-2 text-sm leading-relaxed text-[#0b0b0b]">{call.summary || "The summary isn't ready yet — try Re-sync in a minute."}</p>
                    </Card>
                    {data.handoffs.length > 0 && (
                      <Card className="border-[#6250d6]/30">
                        <CardHead title="Handed to the team" />
                        <div className="space-y-2 px-5 pb-4 pt-2 text-sm">
                          {data.handoffs.map((h) => (
                            <div key={h.id}>
                              <span className="font-medium capitalize">{h.status}</span> · {h.reason ?? "—"}
                              {h.summary && <div className="text-xs text-[#52514e]">{h.summary}</div>}
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}
                    <Card>
                      <CardHead title="Scorecard" figure={<EvalBadge score={data.evaluation_score} size={34} />} />
                      <div className="divide-y divide-black/[0.06] px-5 pb-3 pt-2">
                        {call.evaluation && Object.keys(call.evaluation).length ? (
                          Object.entries(call.evaluation).map(([id, c]) => (
                            <details key={id} className="group py-2">
                              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm">
                                {c.result === "success" ? (
                                  <BadgeCheck className="h-4 w-4 shrink-0" style={{ color: STATUS.good }} />
                                ) : c.result === "failure" ? (
                                  <XCircle className="h-4 w-4 shrink-0" style={{ color: STATUS.critical }} />
                                ) : (
                                  <CircleDashed className="h-4 w-4 shrink-0 text-[#898781]" />
                                )}
                                <span className="flex-1 text-[#0b0b0b]">{prettyId(c.criteria_id ?? id)}</span>
                                <span className="text-xs text-[#898781]">{c.result === "success" ? "passed" : c.result === "failure" ? "missed" : "unclear"}</span>
                                <ChevronDown className="h-3.5 w-3.5 text-[#898781] transition group-open:rotate-180" />
                              </summary>
                              {c.rationale && <p className="mt-1 pl-6 text-xs leading-relaxed text-[#52514e]">{c.rationale}</p>}
                            </details>
                          ))
                        ) : (
                          <p className="py-2 text-sm text-[#898781]">No checks configured.</p>
                        )}
                      </div>
                    </Card>
                    <Card>
                      <CardHead title="Details captured" />
                      <div className="px-5 pb-4 pt-2">
                        {call.data_collection && Object.keys(call.data_collection).length ? (
                          <Facts
                            rows={Object.entries(call.data_collection).map(([id, f]) => {
                              const has = f.value !== null && f.value !== undefined && f.value !== "";
                              return [prettyId(f.data_collection_id ?? id), has ? <span title={f.rationale}>{pretty(f.value)}</span> : <span className="text-[#898781]">not captured</span>] as [string, ReactNode];
                            })}
                          />
                        ) : (
                          <p className="text-sm text-[#898781]">No fields configured.</p>
                        )}
                      </div>
                    </Card>
                    <Card>
                      <CardHead title="Caller mood through the call" hint="Score per caller turn: −1 very unhappy … +1 very happy." />
                      <div className="px-2 pb-3 pt-2">
                        {moodRows.length ? (
                          <ResponsiveContainer width="100%" height={150}>
                            <BarChart data={moodRows} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#898781" }} tickLine={false} axisLine={false} minTickGap={16} />
                              <YAxis domain={[-1, 1]} ticks={[-1, 0, 1]} tick={{ fontSize: 10, fill: "#898781" }} tickLine={false} axisLine={false} width={28} />
                              <ReferenceLine y={0} stroke="#c3c2b7" />
                              <Tooltip cursor={{ fill: "rgba(11,11,11,0.04)" }} formatter={(v) => [fmt.score(Number(v)), "Mood"]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                              <Bar dataKey="value" radius={4} isAnimationActive={false} maxBarSize={18}>
                                {moodRows.map((r, i) => (
                                  <Cell key={i} fill={(r.value ?? 0) >= 0 ? DIVERGING.positive : DIVERGING.negative} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <p className="px-3 text-sm text-[#898781]">No mood scores for this call.</p>
                        )}
                      </div>
                    </Card>
                  </>
                )}

                {panel === "details" && (
                  <>
                    <Card>
                      <CardHead title="Call" />
                      <div className="px-5 pb-4 pt-2">
                        <Facts
                          rows={[
                            ["Agent", data.details.agent_name ?? call.agent_id ?? "—"],
                            ["Channel", `${data.details.channel ?? "—"}${call.direction ? ` · ${call.direction}` : ""}`],
                            ["Environment", data.details.environment ?? "—"],
                            ["Caller", call.customer_number ? <CopyValue value={call.customer_number}>{formatPhoneNumber(call.customer_number)}</CopyValue> : "—"],
                            ["Agent line", call.agent_number ? formatPhoneNumber(call.agent_number) : "—"],
                            ["Appointment", call.appointment_id ? <CopyValue value={call.appointment_id} mono /> : "—"],
                            ["Messages", call.message_count ?? "—"],
                            ["Procedures", data.details.procedures_used ? "used" : "not used"],
                            ["Ended because", call.termination_reason ?? "—"],
                          ]}
                        />
                      </div>
                    </Card>
                    <Card>
                      <CardHead title="Speed" />
                      <div className="px-5 pb-4 pt-2">
                        <Facts
                          rows={[
                            ["Typical reply", fmt.ms(call.median_response_ms)],
                            ["Slowest 10%", fmt.ms(call.p90_response_ms)],
                            ["AI first token", fmt.ms(call.avg_llm_ttfb_ms)],
                            ["Voice start", fmt.ms(call.avg_tts_ttfb_ms)],
                            ["Hearing caller", fmt.ms(call.avg_asr_ms)],
                            ["Integrations", `${call.tool_call_count ?? 0} calls${call.tool_error_count ? `, ${call.tool_error_count} failed` : ""} · avg ${fmt.ms(call.avg_tool_latency_ms)}`],
                          ]}
                        />
                      </div>
                    </Card>
                    <Card>
                      <CardHead title="Cost" />
                      <div className="px-5 pb-4 pt-2">
                        <Facts
                          rows={[
                            ["Total", `${fmt.usd(call.cost, 2)}${call.cost_credits !== null ? ` · ${fmt.num(call.cost_credits)} credits` : ""}`],
                            ["Voice platform", call.call_credits !== null ? `${fmt.num(call.call_credits)} credits` : "—"],
                            ["AI model", `${fmt.usd(call.llm_cost, 2)}${call.llm_credits !== null ? ` · ${fmt.num(call.llm_credits)} credits` : ""}`],
                            ["AI per minute", call.llm_cost !== null && call.duration_secs ? fmt.usd(call.llm_cost / (call.duration_secs / 60), 2) : "—"],
                            ["Model", call.llm_model ?? "—"],
                            ["Voice", data.details.tts_model ?? "—"],
                          ]}
                        />
                      </div>
                    </Card>
                    <Card>
                      <CardHead title="Identifiers" />
                      <div className="px-5 pb-4 pt-2">
                        <Facts
                          rows={[
                            ["Conversation", <CopyValue key="c" value={call.conversation_id} mono />],
                            ["Twilio call", call.call_sid ? <CopyValue key="s" value={call.call_sid} mono /> : "—"],
                            ["Twilio stream", data.details.stream_sid ? <CopyValue key="t" value={data.details.stream_sid} mono /> : "—"],
                          ]}
                        />
                      </div>
                    </Card>
                    <Card>
                      <button type="button" onClick={() => setShowVars((v) => !v)} className="flex w-full items-center justify-between px-5 py-4 text-left">
                        <span className="text-[13px] font-semibold uppercase tracking-wide text-[#52514e]">Variables passed to the agent</span>
                        <ChevronDown className={cn("h-4 w-4 text-[#898781] transition", showVars && "rotate-180")} />
                      </button>
                      {showVars && (
                        <div className="space-y-3 px-5 pb-4">
                          {data.client_data.overrides && <pre className="overflow-auto rounded-lg bg-[#f4f3ef] p-3 text-xs">{pretty(data.client_data.overrides)}</pre>}
                          {data.client_data.dynamic_variables ? (
                            <Facts
                              rows={Object.entries(data.client_data.dynamic_variables)
                                .sort(([a], [b]) => Number(a.startsWith("system__")) - Number(b.startsWith("system__")) || a.localeCompare(b))
                                .map(([key, v]) => [key.replace(/^system__/, "system · "), <span key={key} className="break-all text-xs">{pretty(v) || "—"}</span>] as [string, ReactNode])}
                            />
                          ) : (
                            <p className="text-sm text-[#898781]">No variables were passed.</p>
                          )}
                        </div>
                      )}
                    </Card>
                  </>
                )}

                {panel === "path" && (
                  <Card className="p-4">
                    <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-[#52514e]">
                      <GitBranch className="h-4 w-4" /> Steps this call went through
                    </div>
                    <WorkflowGraph graph={data.workflow} visits={call.workflow_nodes ?? {}} />
                  </Card>
                )}

                {panel === "integrations" && (
                  <Card className="p-4">
                    {tools.length === 0 ? (
                      <p className="text-sm text-[#898781]">No integrations were called.</p>
                    ) : (
                      <div className="space-y-1">
                        {tools.map(({ tool, time }, i) => (
                          <IntegrationRow key={i} tool={tool} time={time} />
                        ))}
                      </div>
                    )}
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
