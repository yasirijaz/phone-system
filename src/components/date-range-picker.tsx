"use client";

import * as React from "react";
import { format, startOfDay, endOfDay, subDays, startOfMonth, subMonths } from "date-fns";
import { CalendarDays } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DateRangeValue = {
  from: Date;
  to: Date;
};

type PresetKey = "today" | "yesterday" | "7d" | "30d" | "this_month" | "12m";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "this_month", label: "This month" },
  { key: "12m", label: "Last 12 months" },
];

function resolvePreset(key: PresetKey): DateRangeValue {
  const today = startOfDay(new Date());

  switch (key) {
    case "yesterday": {
      const day = subDays(today, 1);
      return { from: day, to: endOfDay(day) };
    }
    case "7d":
      return { from: subDays(today, 6), to: endOfDay(today) };
    case "30d":
      return { from: subDays(today, 29), to: endOfDay(today) };
    case "this_month":
      return { from: startOfMonth(today), to: endOfDay(today) };
    case "12m":
      return { from: startOfMonth(subMonths(today, 11)), to: endOfDay(today) };
    case "today":
    default:
      return { from: today, to: endOfDay(today) };
  }
}

function sameDay(a?: Date, b?: Date): boolean {
  if (!a || !b) return false;
  return format(a, "yyyy-MM-dd") === format(b, "yyyy-MM-dd");
}

function matchingPreset(range?: DateRangeValue | null): PresetKey | null {
  if (!range?.from || !range?.to) return null;
  for (const preset of PRESETS) {
    const resolved = resolvePreset(preset.key);
    if (sameDay(range.from, resolved.from) && sameDay(range.to, resolved.to)) {
      return preset.key;
    }
  }
  return null;
}

function formatRangeLabel(range?: DateRangeValue | null): string {
  if (!range?.from) return "Pick a date range";
  if (!range.to || sameDay(range.from, range.to)) {
    return format(range.from, "LLL d, yyyy");
  }
  return `${format(range.from, "LLL d, yyyy")} – ${format(range.to, "LLL d, yyyy")}`;
}

type DateRangePickerProps = {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  className?: string;
  align?: "start" | "center" | "end";
  disabled?: boolean;
};

export function DateRangePicker({
  value,
  onChange,
  className,
  align = "end",
  disabled,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>({
    from: value.from,
    to: value.to,
  });

  React.useEffect(() => {
    if (open) {
      setDraft({ from: value.from, to: value.to });
    }
  }, [open, value.from, value.to]);

  const activePreset = matchingPreset(value);

  const applyRange = (next: DateRangeValue) => {
    onChange({
      from: startOfDay(next.from),
      to: endOfDay(next.to),
    });
    setOpen(false);
  };

  const applyPreset = (key: PresetKey) => {
    applyRange(resolvePreset(key));
  };

  const applyDraft = () => {
    if (!draft?.from) return;
    applyRange({
      from: draft.from,
      to: draft.to ?? draft.from,
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 justify-start gap-2 rounded-full border-slate-200 bg-white px-3 text-left font-normal",
            !value?.from && "text-muted-foreground",
            className
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="truncate">{formatRangeLabel(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-row gap-1 overflow-x-auto border-b p-3 sm:w-40 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r">
            {PRESETS.map((preset) => (
              <Button
                key={preset.key}
                type="button"
                variant={activePreset === preset.key ? "default" : "ghost"}
                size="sm"
                className="justify-start"
                onClick={() => applyPreset(preset.key)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="p-3">
            <Calendar
              mode="range"
              numberOfMonths={2}
              defaultMonth={draft?.from ?? value.from}
              selected={draft}
              onSelect={setDraft}
              disabled={{ after: new Date() }}
            />
            <div className="mt-3 flex items-center justify-end gap-2 border-t pt-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={!draft?.from} onClick={applyDraft}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function createDefaultDateRange(preset: PresetKey = "today"): DateRangeValue {
  return resolvePreset(preset);
}

export function toDateInputValue(date: Date): string {
  return format(date, "yyyy-MM-dd");
}
