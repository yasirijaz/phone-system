import type { LiveCallAnalysis } from '@/services/liveCallService';

export type AnalysisWidgetFieldType = 'stars' | 'percent' | 'badge' | 'text';

export type AnalysisWidgetField = {
  key: string;
  label: string;
  type: AnalysisWidgetFieldType;
  value: string | number;
};

export type AnalysisProfileId =
  | 'dispatch'
  | 'billing'
  | 'warranty'
  | 'marketing'
  | 'recruiting'
  | 'technician'
  | 'support'
  | 'sales'
  | 'general';

const HIGH_SCORE_LABELS: Record<string, string> = {
  sales: 'High Intent',
  marketing: 'High Intent',
  recruiting: 'High Interest',
  dispatch: 'High Urgency',
  billing: 'High Urgency',
  warranty: 'High Urgency',
  technician: 'High Urgency',
  support: 'High Urgency',
  general: 'High Urgency',
};

export function resolveAnalysisProfile(analysis?: LiveCallAnalysis | null): AnalysisProfileId | string {
  return analysis?.profile || 'sales';
}

export function highScoreLabelForProfile(profile?: string | null): string {
  if (!profile) return 'High Intent';
  return HIGH_SCORE_LABELS[profile] || 'High Urgency';
}

function asWidgetField(
  key: string,
  label: string,
  type: AnalysisWidgetFieldType,
  value: string | number
): AnalysisWidgetField {
  return { key, label, type, value };
}

/**
 * Prefer analysis.widget_fields; fall back to legacy buying_intent / booking_probability / stage / objection.
 */
export function getAnalysisWidgetFields(analysis?: LiveCallAnalysis | null): AnalysisWidgetField[] {
  if (!analysis) return [];

  const raw = analysis.widget_fields;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .filter((field) => field && field.key && field.label && field.type)
      .map((field) => ({
        key: String(field.key),
        label: String(field.label),
        type: (['stars', 'percent', 'badge', 'text'].includes(String(field.type))
          ? field.type
          : 'text') as AnalysisWidgetFieldType,
        value: field.value ?? '—',
      }));
  }

  const legacy: AnalysisWidgetField[] = [];
  if (analysis.buying_intent != null) {
    legacy.push(asWidgetField('buying_intent', 'Buying Intent', 'stars', analysis.buying_intent));
  }
  if (analysis.stage) {
    legacy.push(asWidgetField('stage', 'Current Stage', 'text', analysis.stage));
  }
  if (analysis.objection) {
    legacy.push(
      asWidgetField(
        'objection',
        'Detected Objection',
        'badge',
        analysis.objection === 'none' ? 'None' : analysis.objection
      )
    );
  }
  if (analysis.booking_probability != null) {
    legacy.push(
      asWidgetField('booking_probability', 'Probability of Booking', 'percent', analysis.booking_probability)
    );
  }

  return legacy;
}

export function primaryStarsValue(analysis?: LiveCallAnalysis | null): number {
  const fields = getAnalysisWidgetFields(analysis);
  const stars = fields.find((field) => field.type === 'stars');
  if (stars) return Number(stars.value) || 0;
  return analysis?.buying_intent ?? 0;
}
