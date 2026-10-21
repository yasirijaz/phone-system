"use client";

import { useMemo } from "react";
import type { TopicRow } from "@/services/aiCallService";

const COLORS = ["#94a3a6", "#c0606e", "#b7798d", "#4f9d7e", "#8aa0c8", "#c9a15a", "#7d8fb0", "#a3b18a"];

type Circle = { r: number; x: number; y: number; topic: TopicRow; color: string };

/** Greedy circle packing: biggest in the middle, each next one as close to the centre as it fits. */
function pack(topics: TopicRow[], size: number): Circle[] {
  const items = topics.filter((t) => t.conversations > 0);
  if (!items.length) return [];
  const max = Math.max(...items.map((t) => t.conversations));
  const maxR = size * 0.3;
  const placed: Circle[] = [];
  items.forEach((topic, i) => {
    const r = Math.max(16, maxR * Math.sqrt(topic.conversations / max));
    const color = topic.non_engaged ? "#cbd5e1" : COLORS[i % COLORS.length];
    if (!placed.length) {
      placed.push({ r, x: 0, y: 0, topic, color });
      return;
    }
    let best: { x: number; y: number; d: number } | null = null;
    for (const c of placed) {
      for (let a = 0; a < 360; a += 10) {
        const rad = (a * Math.PI) / 180;
        const x = c.x + Math.cos(rad) * (c.r + r + 4);
        const y = c.y + Math.sin(rad) * (c.r + r + 4);
        if (placed.every((o) => Math.hypot(o.x - x, o.y - y) >= o.r + r + 3)) {
          const d = Math.hypot(x, y);
          if (!best || d < best.d) best = { x, y, d };
        }
      }
    }
    if (best) placed.push({ r, x: best.x, y: best.y, topic, color });
  });
  return placed;
}

export function TopicBubbles({ topics, height = 300 }: { topics: TopicRow[]; height?: number }) {
  const circles = useMemo(() => pack(topics.slice(0, 10), height), [topics, height]);
  if (!circles.length) {
    return <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>No topics yet</div>;
  }
  const minX = Math.min(...circles.map((c) => c.x - c.r));
  const maxX = Math.max(...circles.map((c) => c.x + c.r));
  const minY = Math.min(...circles.map((c) => c.y - c.r));
  const maxY = Math.max(...circles.map((c) => c.y + c.r));
  return (
    <svg viewBox={`${minX - 4} ${minY - 4} ${maxX - minX + 8} ${maxY - minY + 8}`} style={{ width: "100%", height }}>
      {circles.map((c) => (
        <g key={c.topic.label}>
          <title>{`${c.topic.label}: ${c.topic.conversations} conversations`}</title>
          <circle cx={c.x} cy={c.y} r={c.r} fill={c.color} />
          {c.r >= 30 && (
            <foreignObject x={c.x - c.r * 0.8} y={c.y - c.r * 0.45} width={c.r * 1.6} height={c.r * 0.9}>
              <div className="flex h-full flex-col items-center justify-center text-center leading-tight text-slate-900">
                <div className="line-clamp-2 font-medium" style={{ fontSize: Math.max(9, Math.min(15, c.r / 6)) }}>
                  {c.topic.label}
                </div>
                <div style={{ fontSize: Math.max(8, Math.min(12, c.r / 8)) }} className="opacity-70">
                  {c.topic.conversations}
                </div>
              </div>
            </foreignObject>
          )}
        </g>
      ))}
    </svg>
  );
}
