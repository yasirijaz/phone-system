"use client";

import { useMemo, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { WorkflowGraph as Graph } from "@/services/aiCallService";

const NODE_W = 210;
const NODE_H = 64;
const COL_GAP = 90;
const ROW_GAP = 28;
const ACCENT = "#2a78d6";

type Placed = { id: string; label: string; type: string; x: number; y: number; depth: number };

/** Left-to-right layered layout: depth from the start node becomes the column. */
function layout(graph: Graph): Placed[] {
  const start = graph.nodes.find((n) => n.type === "start") ?? graph.nodes[0];
  const depth: Record<string, number> = {};
  if (start) {
    depth[start.id] = 0;
    const queue = [start.id];
    while (queue.length) {
      const id = queue.shift() as string;
      for (const e of graph.edges) {
        if (e.source === id && depth[e.target] === undefined) {
          depth[e.target] = depth[id] + 1;
          queue.push(e.target);
        }
      }
    }
  }
  const maxDepth = Math.max(0, ...Object.values(depth));
  const cols: Record<number, typeof graph.nodes> = {};
  // Keep ElevenLabs' vertical order inside a column when positions exist.
  [...graph.nodes]
    .sort((a, b) => (a.x ?? 0) - (b.x ?? 0))
    .forEach((n) => {
      const d = depth[n.id] ?? maxDepth + 1;
      (cols[d] ??= []).push(n);
    });
  const tallest = Math.max(...Object.values(cols).map((c) => c.length));
  const placed: Placed[] = [];
  Object.entries(cols).forEach(([d, nodes]) => {
    const offset = ((tallest - nodes.length) * (NODE_H + ROW_GAP)) / 2;
    nodes.forEach((n, i) => {
      placed.push({ id: n.id, label: n.label, type: n.type, depth: Number(d), x: Number(d) * (NODE_W + COL_GAP), y: offset + i * (NODE_H + ROW_GAP) });
    });
  });
  return placed;
}

/**
 * The agent's workflow, read left → right, with the steps a call (or a period of calls)
 * reached filled in. `visits` = step id → count; the bar inside each step shows its share.
 */
export function WorkflowGraph({ graph, visits, unit = "turns" }: { graph: Graph; visits: Record<string, number>; unit?: string }) {
  const [zoom, setZoom] = useState(1);
  const placed = useMemo(() => layout(graph), [graph]);
  const max = Math.max(1, ...Object.values(visits));

  if (!graph.nodes.length) {
    const entries = Object.entries(visits).sort((a, b) => b[1] - a[1]);
    return (
      <div className="space-y-2">
        <p className="text-xs text-[#898781]">The workflow layout couldn&apos;t be loaded (check ELEVENLABS_API_KEY). Step activity:</p>
        {entries.length === 0 && <p className="text-sm text-[#898781]">No workflow data.</p>}
        {entries.map(([id, n]) => (
          <div key={id} className="flex items-center justify-between rounded-lg bg-[#f4f3ef] px-3 py-2 text-xs">
            <span className="font-mono text-[#52514e]">{id}</span>
            <span className="text-[#0b0b0b]">
              {n} {unit}
            </span>
          </div>
        ))}
      </div>
    );
  }

  const width = Math.max(...placed.map((p) => p.x)) + NODE_W + 20;
  const height = Math.max(...placed.map((p) => p.y)) + NODE_H + 20;
  const byId = Object.fromEntries(placed.map((p) => [p.id, p]));

  return (
    <div className="relative rounded-xl bg-[#fbfaf7]">
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        {[
          { icon: Plus, label: "Zoom in", fn: () => setZoom((z) => Math.min(2.5, z + 0.25)) },
          { icon: Minus, label: "Zoom out", fn: () => setZoom((z) => Math.max(0.4, z - 0.25)) },
          { icon: Maximize2, label: "Fit", fn: () => setZoom(1) },
        ].map(({ icon: Icon, label, fn }) => (
          <button key={label} type="button" onClick={fn} aria-label={label} className="rounded-lg border border-black/10 bg-white p-1.5 text-[#52514e] hover:text-[#0b0b0b]">
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
      <div className="max-h-[560px] overflow-auto p-4">
        <svg width={`${zoom * 100}%`} viewBox={`-10 -10 ${width} ${height}`} style={{ minWidth: Math.min(width, 560) * zoom }}>
          {graph.edges.map((e) => {
            const a = byId[e.source];
            const b = byId[e.target];
            if (!a || !b) return null;
            const x1 = a.x + NODE_W;
            const y1 = a.y + NODE_H / 2;
            const x2 = b.x;
            const y2 = b.y + NODE_H / 2;
            const used = (visits[e.source] ?? 0) > 0 && (visits[e.target] ?? 0) > 0;
            const mid = (x1 + x2) / 2;
            const d = `M ${x1} ${y1} H ${mid - 8} Q ${mid} ${y1} ${mid} ${y1 + Math.sign(y2 - y1) * 8} V ${y2 - Math.sign(y2 - y1) * 8} Q ${mid} ${y2} ${mid + 8} ${y2} H ${x2}`;
            return (
              <g key={e.id}>
                {e.label && <title>{e.label}</title>}
                <path d={d} fill="none" stroke={used ? ACCENT : "#c3c2b7"} strokeWidth={used ? 2 : 1} />
                <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
                <circle cx={x2} cy={y2} r={3} fill={used ? ACCENT : "#c3c2b7"} />
              </g>
            );
          })}
          {placed.map((n) => {
            const v = visits[n.id] ?? 0;
            const share = v / max;
            return (
              <g key={n.id}>
                <title>{`${n.label}${v ? ` — ${v} ${unit}` : " — not reached"}`}</title>
                <rect x={n.x} y={n.y} width={NODE_W} height={NODE_H} rx={14} fill="#ffffff" stroke={v ? ACCENT : "#d6d4cd"} strokeWidth={v ? 1.5 : 1} />
                <circle cx={n.x + 18} cy={n.y + 20} r={9} fill={v ? ACCENT : "#efeee9"} />
                <text x={n.x + 18} y={n.y + 23.5} textAnchor="middle" style={{ fontSize: 10, fontWeight: 600 }} fill={v ? "#ffffff" : "#898781"}>
                  {n.depth + 1}
                </text>
                <foreignObject x={n.x + 34} y={n.y + 9} width={NODE_W - 44} height={24}>
                  <div className="truncate text-[12px] font-semibold text-[#0b0b0b]">{n.label}</div>
                </foreignObject>
                <text x={n.x + 14} y={n.y + 46} style={{ fontSize: 10 }} fill="#898781">
                  {v ? `${v} ${unit}` : n.type.replace(/_/g, " ")}
                </text>
                <rect x={n.x + 14} y={n.y + 52} width={NODE_W - 28} height={4} rx={2} fill="#efeee9" />
                {v > 0 && <rect x={n.x + 14} y={n.y + 52} width={(NODE_W - 28) * share} height={4} rx={2} fill={ACCENT} />}
              </g>
            );
          })}
        </svg>
      </div>
      {graph.edges.some((e) => e.label) && (
        <div className="border-t border-black/[0.06] px-4 py-2 text-[11px] text-[#898781]">Hover a connector to see the condition that moves the call to the next step.</div>
      )}
    </div>
  );
}
