'use client';

import { useEffect, useState } from 'react';
import {
  isPhoneLikeDisplayName,
  resolveSavedContactName,
} from '@/lib/live-contact-name';

export function useResolvedContactName(
  companyId: number | null | undefined,
  phone: string | null | undefined,
  hintName?: string | null
): string | null {
  const hint = hintName?.trim() || null;
  const hintIsReal = Boolean(hint && !isPhoneLikeDisplayName(hint));
  const [resolved, setResolved] = useState<string | null>(hintIsReal ? hint : null);

  useEffect(() => {
    if (hintIsReal) {
      setResolved(hint);
      return;
    }

    if (!companyId || !phone) {
      setResolved(null);
      return;
    }

    let cancelled = false;
    void resolveSavedContactName(companyId, phone, hint).then((name) => {
      if (!cancelled) {
        setResolved(name && !isPhoneLikeDisplayName(name) ? name : null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [companyId, phone, hint, hintIsReal]);

  return resolved || (hintIsReal ? hint : null);
}
