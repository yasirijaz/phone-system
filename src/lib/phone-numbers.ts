import type { PhoneNumber } from '@/types';

export function getPhoneNumbersForDepartment(
  phoneNumbers: PhoneNumber[],
  departmentId: string | number
): PhoneNumber[] {
  const deptId = String(departmentId);
  return phoneNumbers.filter(
    (num) => num.department_id != null && String(num.department_id) === deptId
  );
}

export function resolveDefaultPhoneNumberForDepartment(
  phoneNumbers: PhoneNumber[],
  departmentId: string | number
): PhoneNumber | null {
  const numbersForDept = getPhoneNumbersForDepartment(phoneNumbers, departmentId);
  if (!numbersForDept.length) return null;

  return numbersForDept.find((num) => num.is_default) ?? numbersForDept[0];
}

export function resolveDefaultFromNumberForDepartment(
  phoneNumbers: PhoneNumber[],
  departmentId: string | number
): string {
  return resolveDefaultPhoneNumberForDepartment(phoneNumbers, departmentId)?.phone_no ?? '';
}
