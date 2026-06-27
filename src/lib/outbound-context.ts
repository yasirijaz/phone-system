import type { Communication, PhoneNumber } from '@/types';

export type OutboundContext = {
  departmentId?: string;
  fromNumber?: string;
};

export function resolveOurNumberFromCommunication(comm: Communication): string {
  return comm.direction === 'inbound' ? comm.to : comm.from;
}

export function resolveContactNumberFromCommunication(comm: Communication): string {
  return comm.direction === 'inbound' ? comm.from : comm.to;
}

export function resolveOutboundContextForDepartment(
  departmentId: string | number,
  phoneNumbers: PhoneNumber[]
): OutboundContext {
  const deptId = String(departmentId);
  const numbersForDept = phoneNumbers.filter(
    (num) => num.department_id != null && String(num.department_id) === deptId
  );

  return {
    departmentId: deptId,
    fromNumber: numbersForDept[0]?.phone_no,
  };
}

export function resolveOutboundContextFromCommunication(
  comm: Communication,
  phoneNumbers: PhoneNumber[],
  fallbackDepartmentId?: string
): OutboundContext {
  const ourNumber = resolveOurNumberFromCommunication(comm);
  const matchedNumber = phoneNumbers.find((num) => num.phone_no === ourNumber);

  let departmentId: string | undefined;
  if (comm.department_id != null) {
    departmentId = String(comm.department_id);
  } else if (matchedNumber?.department_id != null) {
    departmentId = String(matchedNumber.department_id);
  } else if (fallbackDepartmentId) {
    departmentId = fallbackDepartmentId;
  }

  let fromNumber: string | undefined;
  if (ourNumber && phoneNumbers.some((num) => num.phone_no === ourNumber)) {
    fromNumber = ourNumber;
  } else if (departmentId) {
    fromNumber = resolveOutboundContextForDepartment(departmentId, phoneNumbers).fromNumber;
  }

  return { departmentId, fromNumber };
}

export function applyOutboundContextSelection(
  context: OutboundContext | undefined,
  phoneNumbers: PhoneNumber[]
): OutboundContext {
  if (!context?.departmentId) {
    return context ?? {};
  }

  const resolved = resolveOutboundContextForDepartment(context.departmentId, phoneNumbers);

  return {
    departmentId: context.departmentId,
    fromNumber: context.fromNumber ?? resolved.fromNumber,
  };
}
