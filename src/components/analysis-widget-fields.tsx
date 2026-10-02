'use client';

import { Check, Flame, Star } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import {
  getAnalysisWidgetFields,
  highScoreLabelForProfile,
  primaryStarsValue,
  type AnalysisWidgetField,
} from '@/lib/analysis-profiles';
import { cn } from '@/lib/utils';
import type { LiveCallAnalysis } from '@/services/liveCallService';

export function StarRating({ value }: { value: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i < filled ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
          )}
        />
      ))}
    </div>
  );
}

export function IntentTag({ analysis }: { analysis?: LiveCallAnalysis | null }) {
  const intent = primaryStarsValue(analysis);
  const risk = analysis?.risk_level;
  const sentiment = analysis?.sentiment;
  const highLabel = highScoreLabelForProfile(analysis?.profile);

  if (risk === 'high' || sentiment === 'negative') {
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
        {highLabel}
      </span>
    );
  }
  if (risk === 'low' && sentiment === 'positive') {
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

function WidgetFieldRow({ field }: { field: AnalysisWidgetField }) {
  if (field.type === 'stars') {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-500">{field.label}</span>
        <StarRating value={Number(field.value) || 0} />
      </div>
    );
  }

  if (field.type === 'percent') {
    const pct = Number(field.value) || 0;
    return (
      <div className="pt-1">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-slate-500">{field.label}</span>
          <span className="font-semibold text-violet-700">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2 bg-violet-100" />
      </div>
    );
  }

  if (field.type === 'badge') {
    const text = String(field.value ?? '—');
    const isNone = text.toLowerCase() === 'none' || text === '—';
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-500">{field.label}</span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-semibold',
            !isNone ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'
          )}
        >
          {text}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500">{field.label}</span>
      <span className="font-medium text-slate-800">{String(field.value ?? '—')}</span>
    </div>
  );
}

/** Renders profile/AI widget fields (or legacy buying_intent fallbacks). */
export function AnalysisWidgetFields({
  analysis,
  showRisk = true,
}: {
  analysis: LiveCallAnalysis;
  showRisk?: boolean;
}) {
  const fields = getAnalysisWidgetFields(analysis);

  return (
    <>
      {fields.map((field) => (
        <WidgetFieldRow key={field.key} field={field} />
      ))}
      {showRisk && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500">Risk Level</span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-semibold capitalize',
              analysis.risk_level === 'high' && 'bg-red-50 text-red-600',
              analysis.risk_level === 'medium' && 'bg-orange-50 text-orange-600',
              analysis.risk_level === 'low' && 'bg-emerald-50 text-emerald-600'
            )}
          >
            {analysis.risk_level || '—'}
          </span>
        </div>
      )}
    </>
  );
}
