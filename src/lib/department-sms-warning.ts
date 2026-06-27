import type { Department } from '@/types';

type DepartmentSource = {
  type?: string;
  department_id?: number | null;
  department?: { id: number; name?: string } | null;
};

export type UnusualDepartmentSmsWarning = {
  selectedDepartmentName: string;
  usualDepartmentNames: string[];
};

function resolveDepartmentId(entry: DepartmentSource): string | null {
  const id = entry.department?.id ?? entry.department_id;
  return id != null ? String(id) : null;
}

function resolveDepartmentName(
  departmentId: string,
  departments: Array<Pick<Department, 'id' | 'name'>>,
  communications: DepartmentSource[]
): string {
  const fromList = departments.find((dept) => String(dept.id) === departmentId)?.name;
  if (fromList) return fromList;

  for (const entry of communications) {
    if (resolveDepartmentId(entry) === departmentId && entry.department?.name) {
      return entry.department.name;
    }
  }

  return 'this department';
}

export function buildUnusualDepartmentSmsWarning(
  communications: DepartmentSource[],
  selectedDepartmentId: string,
  departments: Array<Pick<Department, 'id' | 'name'>> = []
): UnusualDepartmentSmsWarning | null {
  if (!selectedDepartmentId) return null;

  const smsWithDepartment = communications.filter(
    (entry) => entry.type === 'sms' && resolveDepartmentId(entry) != null
  );
  if (!smsWithDepartment.length) return null;

  const usedDepartmentIds = new Set<string>();
  for (const entry of smsWithDepartment) {
    const departmentId = resolveDepartmentId(entry);
    if (departmentId) usedDepartmentIds.add(departmentId);
  }

  if (usedDepartmentIds.has(selectedDepartmentId)) return null;

  const usualDepartmentNames = [...usedDepartmentIds]
    .map((departmentId) => resolveDepartmentName(departmentId, departments, communications))
    .filter((name, index, names) => names.indexOf(name) === index);

  if (!usualDepartmentNames.length) return null;

  return {
    selectedDepartmentName: resolveDepartmentName(
      selectedDepartmentId,
      departments,
      communications
    ),
    usualDepartmentNames,
  };
}

export function formatUnusualDepartmentSmsWarningMessage(
  warning: UnusualDepartmentSmsWarning
): string {
  const usualLabel =
    warning.usualDepartmentNames.length === 1
      ? warning.usualDepartmentNames[0]
      : warning.usualDepartmentNames.slice(0, -1).join(', ') +
        ' and ' +
        warning.usualDepartmentNames[warning.usualDepartmentNames.length - 1];

  return `You're sending this SMS from ${warning.selectedDepartmentName}, but previous messages with this contact were sent from ${usualLabel}. Are you sure you want to continue?`;
}
