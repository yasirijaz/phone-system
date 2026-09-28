'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTwilio } from '@/context/TwilioContext';
import { events } from '@/lib/events';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  getPendingClassifications,
  saveCallClassification,
  type CallDispositionOption,
  type PendingCallClassification,
} from '@/services/callClassificationService';

const OTHER = 'other';

export default function CallClassificationSheet() {
  const { holdWorkerForClassification, releaseWorkerAfterClassification } = useTwilio();
  const { toast } = useToast();
  const [call, setCall] = useState<PendingCallClassification | null>(null);
  const [dispositions, setDispositions] = useState<CallDispositionOption[]>([]);
  const [selected, setSelected] = useState<number | typeof OTHER | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const applyPending = useCallback((pending: PendingCallClassification[], options: CallDispositionOption[]) => {
    const next = pending[0] ?? null;
    setDispositions(options);
    setCall(next);
    setSelected(null);
    setCustomLabel('');
    setNote('');
    setShowNote(false);
    setLoadError(false);
    if (next) {
      setBlocking(true);
      holdWorkerForClassification();
      return;
    }
    setBlocking(false);
    releaseWorkerAfterClassification();
  }, [holdWorkerForClassification, releaseWorkerAfterClassification]);

  const refresh = useCallback(async (afterCall: boolean) => {
    const attempts = afterCall ? 6 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const data = await getPendingClassifications();
        const pending = data.pending ?? [];
        if (pending.length > 0 || attempt === attempts - 1) {
          applyPending(pending, data.dispositions ?? []);
          return;
        }
      } catch (error) {
        console.warn('Failed to load call classification', error);
        if (afterCall) {
          setBlocking(true);
          setLoadError(true);
          holdWorkerForClassification();
        }
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }
  }, [applyPending, holdWorkerForClassification]);

  useEffect(() => {
    void refresh(false);
    const onRequired = () => {
      void refresh(true);
    };
    events.on('callClassificationRequired', onRequired);
    return () => events.off('callClassificationRequired', onRequired);
  }, [refresh]);

  useEffect(() => {
    if (!call && !loadError) return;
    const blockEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('keydown', blockEscape, true);
    return () => window.removeEventListener('keydown', blockEscape, true);
  }, [call, loadError]);

  const canSave = selected === OTHER
    ? customLabel.trim().length > 0
    : typeof selected === 'number';

  const onSave = async () => {
    if (!call || !canSave || saving) return;
    setSaving(true);
    try {
      await saveCallClassification({
        call_log_id: call.call_log_id,
        disposition_id: selected === OTHER ? null : selected,
        custom_label: selected === OTHER ? customLabel.trim() : null,
        note: note.trim() || null,
      });
      events.emit('refreshCalls');
      await refresh(true);
    } catch (error) {
      console.warn('Failed to save call classification', error);
      toast({
        title: 'Could not save',
        description: 'Try again. This call still needs an outcome.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!blocking || (!call && !loadError)) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="call-classification-title"
    >
      <div className="w-full max-w-lg rounded-xl bg-background p-5 shadow-xl">
        {loadError && !call ? (
          <div className="space-y-4">
            <h2 id="call-classification-title" className="text-lg font-semibold">Classify this call</h2>
            <p className="text-sm text-muted-foreground">The outcome list did not load. You can continue after it loads.</p>
            <Button onClick={() => void refresh(true)}>Try again</Button>
          </div>
        ) : call ? (
          <div className="space-y-4">
            <div>
              <h2 id="call-classification-title" className="text-lg font-semibold">How did this call go?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {call.caller_label}
                {' · '}
                {call.direction === 'outbound' ? 'Outbound' : 'Inbound'}
                {' · '}
                {call.duration_label}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {dispositions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelected(option.id)}
                  className={cn(
                    'rounded-full border px-3 py-2 text-sm font-medium transition-colors',
                    selected === option.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted'
                  )}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelected(OTHER)}
                className={cn(
                  'rounded-full border px-3 py-2 text-sm font-medium transition-colors',
                  selected === OTHER
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-muted'
                )}
              >
                Other
              </button>
            </div>
            {selected === OTHER && (
              <Input
                autoFocus
                maxLength={80}
                placeholder="Type what this call was"
                value={customLabel}
                onChange={(event) => setCustomLabel(event.target.value)}
              />
            )}
            {showNote ? (
              <Input
                maxLength={500}
                placeholder="Optional note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            ) : (
              <button
                type="button"
                className="text-sm text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setShowNote(true)}
              >
                Add a note
              </button>
            )}
            <Button className="w-full" disabled={!canSave || saving} onClick={() => void onSave()}>
              {saving ? 'Saving…' : 'Save and continue'}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
