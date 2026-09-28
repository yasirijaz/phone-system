'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  createCallDisposition,
  getCallDispositions,
  reorderCallDispositions,
  updateCallDisposition,
  type CallDispositionOption,
} from '@/services/callClassificationService';

export default function CallOutcomesSettings({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<CallDispositionOption[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await getCallDispositions(companyId);
    setRows(data.dispositions ?? []);
  }, [companyId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .catch(() => {
        if (!cancelled) {
          toast({ title: 'Could not load call outcomes', variant: 'destructive' });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load, toast]);

  const persistOrder = async (next: CallDispositionOption[]) => {
    setRows(next);
    try {
      await reorderCallDispositions(companyId, next.map((row) => row.id));
    } catch {
      toast({ title: 'Could not reorder outcomes', variant: 'destructive' });
      await load();
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = rows.slice();
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    void persistOrder(next);
  };

  const rename = async (row: CallDispositionOption, label: string) => {
    const trimmed = label.trim();
    if (!trimmed || trimmed === row.label) return;
    try {
      await updateCallDisposition(companyId, row.id, { label: trimmed });
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, label: trimmed } : item));
    } catch {
      toast({ title: 'Could not rename outcome', variant: 'destructive' });
    }
  };

  const toggle = async (row: CallDispositionOption, isActive: boolean) => {
    setRows((current) => current.map((item) => item.id === row.id ? { ...item, is_active: isActive } : item));
    try {
      await updateCallDisposition(companyId, row.id, { is_active: isActive });
    } catch {
      toast({ title: 'Could not update outcome', variant: 'destructive' });
      await load();
    }
  };

  const add = async () => {
    const label = draft.trim();
    if (!label) return;
    try {
      await createCallDisposition(companyId, label);
      setDraft('');
      await load();
    } catch {
      toast({ title: 'Could not add outcome', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Call outcomes</CardTitle>
        <CardDescription>
          Agents pick one of these after every connected call. Other is always available so they can type their own.
          Hidden outcomes stay on old calls and disappear from the list.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <p className="text-sm text-muted-foreground">Loading outcomes…</p> : null}
        {rows.map((row, index) => (
          <div key={row.id} className="flex items-center gap-2">
            <Input
              defaultValue={row.label}
              key={`${row.id}-${row.label}`}
              onBlur={(event) => void rename(row, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
            />
            <Button type="button" variant="outline" size="icon" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up">
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" disabled={index === rows.length - 1} onClick={() => move(index, 1)} aria-label="Move down">
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Switch checked={row.is_active !== false} onCheckedChange={(checked) => void toggle(row, checked)} aria-label="Show to agents" />
          </div>
        ))}
        <div className="flex items-center gap-2 pt-2">
          <Input
            value={draft}
            placeholder="New outcome"
            maxLength={80}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void add();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={() => void add()}>
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
