"use client";

import { type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Download, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ formatters */

export const fmt = {
  usd(v: number | null | undefined, digits?: number) {
    if (v === null || v === undefined || Number.isNaN(v)) return "—";
    const d = digits ?? (Math.abs(v) < 1 ? 3 : 2);
    return `$${v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })}`;
  },
  ms(v: number | null | undefined) {
    if (v === null || v === undefined) return "—";
    return v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`;
  },
  duration(secs: number | null | undefined) {
    if (!secs) return "0:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.round(secs % 60);
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  },
  hours(secs: number | null | undefined) {
    if (!secs) return "0 min";
    return secs >= 3600 ? `${(secs / 3600).toFixed(1)} h` : `${Math.round(secs / 60)} min`;
  },
  pct(v: number | null | undefined, digits = 0) {
    if (v === null || v === undefined) return "—";
    return `${v.toFixed(digits)}%`;
  },
  compact(v: number | null | undefined) {
    if (v === null || v === undefined) return "—";
    return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(v);
  },
  num(v: number | null | undefined) {
    if (v === null || v === undefined) return "—";
    return v.toLocaleString();
  },
  score(v: number | null | undefined) {
    if (v === null || v === undefined) return "—";
    return v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2);
  },
};

/** Validated categorical order (CVD-checked). Assign in this order, never cycle past it. */
export const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
/** Status colours are reserved for state and always paired with an icon/label. */
export const STATUS = { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" };
/** Diverging poles for sentiment: negative ↔ positive with a neutral grey midpoint. */
export const DIVERGING = { negative: "#e34948", neutral: "#d6d4cd", positive: "#2a78d6" };
export const INK = { primary: "#0b0b0b", secondary: "#52514e", muted: "#898781", grid: "#e1e0d9", axis: "#c3c2b7" };

export function prettyId(id: string) {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------ layout */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-black/[0.07] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]", className)}>{children}</section>;
}

export function CardHead({
  title,
  hint,
  icon,
  actions,
  figure,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  /** headline number shown under the title */
  figure?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-[#52514e]">
          {icon}
          <span>{title}</span>
          {hint && (
            <span title={hint} className="cursor-help text-[#898781]">
              <Info className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        {figure !== undefined && <div className="mt-1 text-2xl font-semibold text-[#0b0b0b]">{figure}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-lg font-semibold text-[#0b0b0b]">{title}</h2>
        {sub && <p className="text-sm text-[#52514e]">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/* ------------------------------------------------------------------ delta + stat card */

export function Delta({ current, previous, lowerIsBetter }: { current?: number | null; previous?: number | null; lowerIsBetter?: boolean }) {
  if (current === null || current === undefined || previous === null || previous === undefined || previous === 0) {
    return <span className="text-xs text-[#898781]">no earlier data to compare</span>;
  }
  const change = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(change) < 0.5) return <span className="text-xs text-[#898781]">same as prior period</span>;
  const good = lowerIsBetter ? change < 0 : change > 0;
  const Icon = change > 0 ? ArrowUpRight : ArrowDownRight;
  // Big jumps read better as a multiple ("×4.1") than as "+310%".
  const text = change >= 200 ? `×${(current / previous).toFixed(current / previous >= 10 ? 0 : 1)}` : `${Math.abs(change).toFixed(0)}%`;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium", good ? "bg-[#0ca30c]/10 text-[#006300]" : "bg-[#d03b3b]/10 text-[#b42323]")}>
      <Icon className="h-3 w-3" />
      {text}
      <span className="font-normal opacity-70">vs prior</span>
    </span>
  );
}

/** Tiny column sparkline (no axes) for stat cards. */
export function SparkColumns({ values, color = PALETTE[0], height = 32 }: { values: (number | null)[]; color?: string; height?: number }) {
  const v = values.map((x) => x ?? 0);
  const max = Math.max(...v, 0);
  if (!v.length || max === 0) return <div style={{ height }} className="flex items-end text-[10px] text-[#898781]">no activity</div>;
  const w = 100 / v.length;
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden>
      {v.map((x, i) => {
        const h = x ? Math.max(1.5, (x / max) * (height - 2)) : 0;
        return <rect key={i} x={i * w + w * 0.15} y={height - h} width={Math.max(0.6, w * 0.7)} height={h} rx={Math.min(1, w * 0.3)} fill={color} opacity={0.85} />;
      })}
    </svg>
  );
}

export function StatCard({
  icon,
  label,
  value,
  sub,
  current,
  previous,
  lowerIsBetter,
  spark,
  color,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  current?: number | null;
  previous?: number | null;
  lowerIsBetter?: boolean;
  spark?: (number | null)[];
  color?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex flex-col gap-2 rounded-2xl border bg-white p-4 text-left transition",
        active ? "border-[#0b0b0b] shadow-[0_0_0_1px_#0b0b0b]" : "border-black/[0.07] hover:border-black/20",
      )}
    >
      <span className="flex items-center gap-2 text-sm text-[#52514e]">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f4f3ef] text-[#0b0b0b]">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[26px] font-semibold leading-none text-[#0b0b0b]">{value}</span>
        {sub && <span className="text-xs text-[#898781]">{sub}</span>}
      </div>
      <div>
        <Delta current={current} previous={previous} lowerIsBetter={lowerIsBetter} />
      </div>
      {spark && <SparkColumns values={spark} color={color} />}
    </Comp>
  );
}

/* ------------------------------------------------------------------ charts */

export type ChartSeries = { key: string; label: string; color?: string };
type Row = Record<string, unknown> & { label?: string; t?: string };

export function downloadCsv(filename: string, rows: readonly object[], series: ChartSeries[]) {
  const header = ["period", ...series.map((s) => s.label)];
  const lines = (rows as Row[]).map((r) =>
    [String(r.t ?? r.label ?? ""), ...series.map((s) => (r[s.key] === null || r[s.key] === undefined ? "" : String(r[s.key])))]
      .map((v) => `"${v.replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function CsvButton({ name, rows, series }: { name: string; rows: readonly object[]; series: ChartSeries[] }) {
  return (
    <button type="button" title="Export CSV" onClick={() => downloadCsv(name, rows, series)} className="rounded-lg p-1.5 text-[#898781] hover:bg-[#f4f3ef] hover:text-[#0b0b0b]">
      <Download className="h-4 w-4" />
    </button>
  );
}

export function Legend({ series, shape = "rect" }: { series: ChartSeries[]; shape?: "rect" | "line" }) {
  if (series.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 pb-4 text-xs text-[#52514e]">
      {series.map((s, i) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          {shape === "rect" ? (
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color ?? PALETTE[i] }} />
          ) : (
            <span className="h-0.5 w-3 rounded" style={{ background: s.color ?? PALETTE[i] }} />
          )}
          {s.label}
        </span>
      ))}
    </div>
  );
}

function TipBox({ active, payload, label, yFormat }: { active?: boolean; payload?: { name?: string; value?: number | null; color?: string }[]; label?: string; yFormat: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 text-[#898781]">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-0.5 w-3 rounded" style={{ background: p.color }} />
          <span className="font-semibold text-[#0b0b0b]">{p.value === null || p.value === undefined ? "—" : yFormat(Number(p.value))}</span>
          <span className="text-[#52514e]">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

function axes(yFormat: (v: number) => string, integer: boolean, yMax?: number) {
  return [
    <CartesianGrid key="g" vertical={false} stroke={INK.grid} />,
    <XAxis key="x" dataKey="label" tickLine={false} axisLine={{ stroke: INK.axis }} tick={{ fontSize: 11, fill: INK.muted }} interval="preserveStartEnd" minTickGap={28} />,
    <YAxis
      key="y"
      tickLine={false}
      axisLine={false}
      width={56}
      allowDecimals={!integer}
      tick={{ fontSize: 11, fill: INK.muted }}
      tickFormatter={(v) => yFormat(Number(v))}
      domain={[0, yMax ?? "auto"]}
    />,
  ];
}

/** Vertical columns per period — single, grouped or stacked. Optional reference line (avg / target). */
export function Columns({
  data,
  series,
  stacked = false,
  height = 240,
  yFormat = (v: number) => fmt.compact(v),
  integer = false,
  yMax,
  reference,
}: {
  data: readonly object[];
  series: ChartSeries[];
  stacked?: boolean;
  height?: number;
  yFormat?: (v: number) => string;
  integer?: boolean;
  yMax?: number;
  reference?: { value: number; label: string } | null;
}) {
  const rows = data as Row[];
  const has = rows.some((r) => series.some((s) => typeof r[s.key] === "number" && (r[s.key] as number) !== 0));
  if (!has) return <Empty height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 12, right: 16, left: 0, bottom: 0 }} barCategoryGap={rows.length > 60 ? 1 : "18%"}>
        {axes(yFormat, integer, yMax)}
        <Tooltip cursor={{ fill: "rgba(11,11,11,0.04)" }} content={<TipBox yFormat={yFormat} />} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color ?? PALETTE[i]}
            stackId={stacked ? "s" : undefined}
            radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]}
            stroke="#ffffff"
            strokeWidth={stacked ? 1 : 0}
            isAnimationActive={false}
            maxBarSize={36}
          />
        ))}
        {reference && (
          <ReferenceLine y={reference.value} stroke={INK.secondary} strokeWidth={1} label={{ value: reference.label, position: "insideTopRight", fill: INK.secondary, fontSize: 11 }} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Multi-series trend lines (used where several entities share one axis, e.g. tools, criteria). */
export function Lines({
  data,
  series,
  height = 240,
  yFormat = (v: number) => fmt.compact(v),
  integer = false,
  yMax,
}: {
  data: readonly object[];
  series: ChartSeries[];
  height?: number;
  yFormat?: (v: number) => string;
  integer?: boolean;
  yMax?: number;
}) {
  const rows = data as Row[];
  const has = rows.some((r) => series.some((s) => typeof r[s.key] === "number"));
  if (!has) return <Empty height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
        {axes(yFormat, integer, yMax)}
        <Tooltip cursor={{ stroke: INK.axis }} content={<TipBox yFormat={yFormat} />} />
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? PALETTE[i]} strokeWidth={2} dot={rows.length <= 31 ? { r: 3, strokeWidth: 0, fill: s.color ?? PALETTE[i] } : false} connectNulls isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Empty({ height = 200, text = "Nothing recorded in this period" }: { height?: number; text?: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl bg-[repeating-linear-gradient(135deg,#f7f6f2,#f7f6f2_6px,#fbfaf7_6px,#fbfaf7_12px)] text-sm text-[#898781]" style={{ height }}>
      {text}
    </div>
  );
}

/** Semicircle gauge for a single rate (0–100). */
export function Gauge({ value, label, color = PALETTE[0], size = 180 }: { value: number | null; label: string; color?: string; size?: number }) {
  const r = 70;
  const c = Math.PI * r;
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 180 100" style={{ width: size }} role="img" aria-label={`${label}: ${value === null ? "no data" : `${v.toFixed(0)}%`}`}>
        <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="#efeee9" strokeWidth={16} strokeLinecap="round" />
        {value !== null && (
          <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke={color} strokeWidth={16} strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} />
        )}
        <text x="90" y="80" textAnchor="middle" className="fill-[#0b0b0b]" style={{ fontSize: 28, fontWeight: 600 }}>
          {value === null ? "—" : `${v.toFixed(0)}%`}
        </text>
      </svg>
      <div className="-mt-1 text-xs text-[#52514e]">{label}</div>
    </div>
  );
}

/** Horizontal 100% bar made of labelled segments (part-to-whole, ≤ 6 parts). */
export function SegmentBar({ segments, height = 12 }: { segments: { label: string; value: number; color: string }[]; height?: number }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (!total) return <Empty height={48} />;
  return (
    <div>
      <div className="flex w-full gap-[2px] overflow-hidden rounded-full" style={{ height }}>
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div key={s.label} title={`${s.label}: ${s.value} (${((s.value / total) * 100).toFixed(0)}%)`} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
          ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {segments.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-[#52514e]">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
            {s.label}
            <span className="font-semibold text-[#0b0b0b]">{((s.value / total) * 100).toFixed(0)}%</span>
            <span className="text-[#898781]">({s.value})</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Inline meter for table cells. */
export function Meter({ value, max = 100, color = PALETTE[0] }: { value: number | null; max?: number; color?: string }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className="h-1.5 w-full min-w-[60px] rounded-full bg-[#efeee9]">
      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/** Ranked horizontal bars with value labels (categorical breakdowns). */
export function RankBars({ items, total, format = fmt.num, color = PALETTE[0] }: { items: { label: string; value: number; hint?: string }[]; total?: number; format?: (v: number) => string; color?: string }) {
  if (!items.length) return <Empty height={100} />;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2.5">
      {items.map((i) => (
        <div key={i.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
          <span className="truncate text-sm text-[#0b0b0b]" title={i.label}>
            {i.label}
          </span>
          <span className="text-right text-sm font-semibold tabular-nums text-[#0b0b0b]">
            {format(i.value)}
            {total ? <span className="ml-1 text-xs font-normal text-[#898781]">{((i.value / total) * 100).toFixed(0)}%</span> : null}
            {i.hint && <span className="ml-1 text-xs font-normal text-[#898781]">{i.hint}</span>}
          </span>
          <div className="col-span-2 h-2 rounded-full bg-[#efeee9]">
            <div className="h-2 rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Small segmented control. */
export function Segmented<T extends string>({ value, onChange, options, size = "md" }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; size?: "sm" | "md" }) {
  return (
    <div className="inline-flex rounded-xl bg-[#f0efea] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg font-medium transition",
            size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
            value === o.value ? "bg-white text-[#0b0b0b] shadow-sm" : "text-[#52514e] hover:text-[#0b0b0b]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
