
import axios from '@/lib/axios';
import { cacheGet, cacheInvalidatePrefix, cacheSet } from '@/lib/simpleCache';
import type { Department, Operator, User } from '@/types';

const DEPARTMENT_SUMMARY_CACHE_TTL = 5_000;

export interface DepartmentSummaryItem {
  id: number;
  name: string;
  workflow_sid?: string | null;
  is_dnd: number | boolean;
  unread: {
    calls: number;
    sms: number;
    missed_calls: number;
    total: number;
  };
}

export interface DepartmentsSummaryResponse {
  overall_dnd: number;
  departments: DepartmentSummaryItem[];
}

export const getDepartmentsSummary = async (
  departmentIds?: number[],
  options?: { assignedOnly?: boolean }
): Promise<DepartmentsSummaryResponse> => {
  const scope = options?.assignedOnly ? 'assigned' : 'default';
  const cacheKey = departmentIds?.length
    ? `dept-summary:${scope}:${departmentIds.join(',')}`
    : `dept-summary:${scope}:all`;
  const cached = cacheGet<DepartmentsSummaryResponse>(cacheKey);
  if (cached) return cached;

  const response = await axios.get('/api/departments/summary', {
    params: {
      ...(departmentIds?.length ? { department_ids: departmentIds.join(',') } : {}),
      ...(options?.assignedOnly ? { scope: 'assigned' } : {}),
    },
  });
  const data = response.data.data as DepartmentsSummaryResponse;
  cacheSet(cacheKey, data, DEPARTMENT_SUMMARY_CACHE_TTL);
  return data;
};

export const invalidateDepartmentsSummaryCache = (): void => {
  cacheInvalidatePrefix('dept-summary:');
};

export const getDepartments = async (companyId: number): Promise<Department[]> => {
  const response = await axios.get(`/api/companies/${companyId}/departments`);
  return response.data.departments;
};

export const createDepartment = async (departmentData: { name: string, company_id: number }): Promise<Department> => {
  const response = await axios.post('/api/departments', departmentData);
  return response.data.department;
};

export const updateDepartment = async (id: number, departmentData: { name: string, company_id: number }): Promise<Department> => {
  const response = await axios.put(`/api/departments/${id}`, departmentData);
  return response.data.department;
};

export const deleteDepartment = async (id: number): Promise<void> => {
  await axios.delete(`/api/departments/${id}`);
};

export const leaveDepartment = async (departmentId: number): Promise<{ message?: string }> => {
  const response = await axios.post(`/api/departments/${departmentId}/leave`);
  invalidateDepartmentsSummaryCache();
  return response.data;
};

export interface DepartmentUserAssignment {
    id: number;
    user_id: number;
    department_id: number;
    role_id?: number;
    is_dnd?: boolean | number;
    user: User;
}

export const getDepartmentUsers = async (companyId: number, departmentId: number): Promise<{users: DepartmentUserAssignment[]}> => {
    const response = await axios.get(`/api/companies/${companyId}/departments/${departmentId}/users`);
    return response.data;
};

export const updateDndStatus = async (departmentId: number, userId: number, isDnd: boolean): Promise<any> => {
    const response = await axios.post('/api/departments/updateDnd', {
        department_id: departmentId,
        user_id: userId,
        is_dnd: isDnd ? 1 : 0,
    });
    return response.data;
};

export const getDndStatus = async (departmentId: number, userId: number): Promise<{ is_dnd: boolean }> => {
    const response = await axios.post('/api/departments/getDndStatus', {
        department_id: departmentId,
        user_id: userId,
    });
    return response.data.data;
}

export type OperatorsScope = 'department' | 'assigned_departments' | 'company';

export interface OperatorsResponse {
  status: string;
  scope: OperatorsScope;
  operators: Operator[];
}

export const getOperators = async (
  departmentId?: number,
  options?: { companyWide?: boolean }
): Promise<OperatorsResponse> => {
  const response = await axios.get('/api/operators', {
    params: {
      ...(departmentId ? { department_id: departmentId } : {}),
      ...(options?.companyWide ? { company_wide: 1 } : {}),
    },
  });
  return response.data;
};
