'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getWindshieldHubLead,
  lookupWindshieldHubByCall,
  lookupWindshieldHubByPhone,
  type WindshieldHubLead,
  type WindshieldHubLeadSummary,
  type WindshieldHubLookup,
} from '@/services/windshieldHubService';

type Tab = 'notes' | 'activities' | 'messages';

interface WindshieldHubTimelineProps {
  companyId?: number | null;
  phone?: string | null;
  callLogId?: number | null;
  className?: string;
}

function formatWhen(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function noteHtml(value: string): string {
  const escaped = value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped.replace(/&lt;(\/?)(b|strong|i|em|br)\s*\/?&gt;/gi, '<$1$2>');
}

export default function WindshieldHubTimeline({
  companyId,
  phone,
  callLogId,
  className,
}: WindshieldHubTimelineProps) {
  const [lookup, setLookup] = useState<WindshieldHubLookup | null>(null);
  const [lead, setLead] = useState<WindshieldHubLead | null>(null);
  const [tab, setTab] = useState<Tab>('notes');
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!companyId || (!phone && !callLogId)) {
      setLookup(null);
      setLead(null);
      return;
    }

    let cancelled = false;
    setLookup(null);
    setLead(null);
    setTab('notes');

    const request = callLogId
      ? lookupWindshieldHubByCall(callLogId)
      : lookupWindshieldHubByPhone(companyId, phone as string);

    request
      .then((data) => {
        if (cancelled) return;
        setLookup(data);
        setLead(data.lead);
      })
      .catch(() => {
        if (cancelled) return;
        setLookup({ enabled: true, leads: [], lead: null, error: 'Could not reach WindshieldHUB.' });
        setLead(null);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, phone, callLogId]);

  const selectLead = async (leadId: string) => {
    if (!companyId || lead?.lead_id === leadId) return;
    setSwitching(true);
    try {
      const next = await getWindshieldHubLead(companyId, leadId);
      setLead(next);
      setTab('notes');
    } catch {
      setLookup((current) => current ? { ...current, error: 'Could not load that lead.' } : current);
    } finally {
      setSwitching(false);
    }
  };

  if (!companyId || (!phone && !callLogId)) return null;
  if (!lookup?.enabled) return null;

  const leads = lookup.leads ?? [];
  const notes = lead?.notes ?? [];
  const activities = lead?.activities ?? [];
  const messages = lead?.messages ?? [];
  const activeLeadId = lead?.lead_id;

  return (
    <div className={cn('border-b bg-muted/30 px-4 py-3', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">WindshieldHUB</p>
        {activeLeadId && (
          <a
            href={`https://adminpro.windshieldhub.com/dashboard/quotes-details/${activeLeadId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Quote {activeLeadId}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {leads.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {leads.map((item: WindshieldHubLeadSummary) => (
            <button
              key={item.lead_id}
              type="button"
              disabled={switching}
              onClick={() => selectLead(item.lead_id)}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs',
                item.lead_id === activeLeadId ? 'bg-green-600 text-white' : 'bg-background text-muted-foreground'
              )}
            >
              {item.label || `Quote ${item.lead_id}`}
            </button>
          ))}
        </div>
      )}

      {lookup.error && !lead && (
        <p className="text-sm text-muted-foreground">{lookup.error}</p>
      )}

      {!lookup.error && leads.length === 0 && (
        <p className="text-sm text-muted-foreground">No WindshieldHUB records for this number.</p>
      )}

      {lead && (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {([
              ['notes', `Notes (${notes.length})`],
              ['activities', `Activities (${activities.length})`],
              ['messages', `Messages (${messages.length})`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  'rounded-full px-3 py-1 text-sm',
                  tab === key ? 'bg-green-600 text-white' : 'bg-background text-muted-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {tab === 'notes' && notes.map((note) => (
              <article key={note.id} className="rounded-xl border bg-background p-3">
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="font-medium">{note.added_by_name || 'WindshieldHUB'}</span>
                  <span className="shrink-0 text-muted-foreground">{formatWhen(note.created_at)}</span>
                </div>
                <div
                  className="mt-2 text-right text-sm"
                  dangerouslySetInnerHTML={{ __html: noteHtml(note.notes || '') }}
                />
              </article>
            ))}
            {tab === 'activities' && activities.map((activity) => (
              <article key={activity.id} className="rounded-xl border bg-background p-3">
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="font-medium">{activity.name || 'WindshieldHUB'}</span>
                  <span className="shrink-0 text-muted-foreground">{formatWhen(activity.created_at)}</span>
                </div>
                <p className="mt-2 text-right text-sm">{activity.activity}</p>
              </article>
            ))}
            {tab === 'messages' && messages.map((message) => {
              const author = message.admin_name
                || (message.direction === 'incoming' ? (message.From || 'Customer') : 'WindshieldHUB');
              return (
                <article key={message.id} className="rounded-xl border bg-background p-3">
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <span className="font-medium">{author}</span>
                    <span className="shrink-0 text-muted-foreground">{formatWhen(message.created_at)}</span>
                  </div>
                  {message.Body && (
                    <p className="mt-2 whitespace-pre-wrap text-right text-sm">{message.Body}</p>
                  )}
                  {message.media && (
                    <img
                      src={message.media}
                      alt=""
                      className="mt-2 ml-auto max-h-40 rounded-md"
                    />
                  )}
                </article>
              );
            })}
            {tab === 'notes' && notes.length === 0 && <p className="text-sm text-muted-foreground">No notes.</p>}
            {tab === 'activities' && activities.length === 0 && <p className="text-sm text-muted-foreground">No activities.</p>}
            {tab === 'messages' && messages.length === 0 && <p className="text-sm text-muted-foreground">No messages.</p>}
          </div>
        </>
      )}
    </div>
  );
}
