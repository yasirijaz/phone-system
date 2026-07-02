'use client';

import { useCallback, useRef, useState } from 'react';
import type { Department } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getPhoneCommunicationHistory } from '@/services/callLogService';
import {
  buildUnusualDepartmentSmsWarning,
  formatUnusualDepartmentSmsWarningMessage,
  type UnusualDepartmentSmsWarning,
} from '@/lib/department-sms-warning';

type DepartmentCommunication = {
  type?: string;
  department_id?: number | null;
  department?: { id: number; name?: string } | null;
};

type ConfirmUnusualDepartmentSmsParams = {
  recipientPhone: string;
  selectedDepartmentId: string;
  communications?: DepartmentCommunication[];
};

function hasSmsDepartmentHistory(communications: DepartmentCommunication[]): boolean {
  return communications.some(
    (entry) =>
      entry.type === 'sms' &&
      (entry.department?.id != null || entry.department_id != null)
  );
}

export function useUnusualDepartmentSmsGuard(departments: Array<Pick<Department, 'id' | 'name'>>) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [warning, setWarning] = useState<UnusualDepartmentSmsWarning | null>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const closeDialog = useCallback((confirmed: boolean) => {
    setDialogOpen(false);
    setWarning(null);
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
  }, []);

  const confirmIfNeeded = useCallback(
    async ({
      recipientPhone,
      selectedDepartmentId,
      communications,
    }: ConfirmUnusualDepartmentSmsParams): Promise<boolean> => {
      let history = communications ?? [];

      if (recipientPhone && (!history.length || !hasSmsDepartmentHistory(history))) {
        try {
          const details = await getPhoneCommunicationHistory(recipientPhone, { perPage: 100 });
          history = details.communications;
        } catch {
          if (!history.length) return true;
        }
      }

      const unusualWarning = buildUnusualDepartmentSmsWarning(
        history,
        selectedDepartmentId,
        departments
      );

      if (!unusualWarning) return true;

      return new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setWarning(unusualWarning);
        setDialogOpen(true);
      });
    },
    [departments]
  );

  const dialog = (
    <AlertDialog
      open={dialogOpen}
      onOpenChange={(open) => {
        if (!open) closeDialog(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unusual department for this contact</AlertDialogTitle>
          <AlertDialogDescription>
            {warning ? formatUnusualDepartmentSmsWarningMessage(warning) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => closeDialog(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => closeDialog(true)}>Send anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirmIfNeeded, dialog };
}
