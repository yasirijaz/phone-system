import type { Communication, PhoneNumber } from '@/types';
import {
  applyOutboundContextSelection,
  resolveOutboundContextForDepartment,
  resolveOutboundContextFromCommunication,
  type OutboundContext,
} from '@/lib/outbound-context';

type DepartmentSource = {
  type?: string;
  created_at?: string;
  department_id?: number | null;
  department?: { id: number; name?: string } | null;
};

export function findLastUsedDepartmentId(
  communications: DepartmentSource[]
): string | null {
  const withDepartment = communications.filter(
    (entry) => entry.department?.id != null || entry.department_id != null
  );
  if (!withDepartment.length) return null;

  const sorted = [...withDepartment].sort(
    (a, b) =>
      new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  );

  const latestSms = sorted.find((entry) => entry.type === 'sms');
  const pick = latestSms ?? sorted[0];
  const departmentId = pick.department?.id ?? pick.department_id;

  return departmentId != null ? String(departmentId) : null;
}

export function resolveOutboundContextFromDepartmentId(
  departmentId: string,
  phoneNumbers: PhoneNumber[]
): OutboundContext {
  return applyOutboundContextSelection(
    resolveOutboundContextForDepartment(departmentId, phoneNumbers),
    phoneNumbers
  );
}

export function resolveOutboundContextFromLastActivity(
  communications: DepartmentSource[],
  phoneNumbers: PhoneNumber[]
): OutboundContext {
  const departmentId = findLastUsedDepartmentId(communications);
  if (!departmentId) return {};

  return resolveOutboundContextFromDepartmentId(departmentId, phoneNumbers);
}

export function resolveOutboundContextFromCommunicationEntry(
  communication: Communication,
  phoneNumbers: PhoneNumber[]
): OutboundContext {
  return applyOutboundContextSelection(
    resolveOutboundContextFromCommunication(communication, phoneNumbers),
    phoneNumbers
  );
}
