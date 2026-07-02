
import axios from '@/lib/axios';
import type { User, Assignment, Department } from '@/types';
import { cacheGet, cacheSet } from '@/lib/simpleCache';

const COMPANY_USERS_CACHE_TTL = 5 * 60_000;

export const getUsersByCompany = async (
  companyId: number,
  options?: { all?: boolean }
): Promise<{ data: User[] }> => {
  const cacheKey = options?.all ? `company:${companyId}:users:all` : `company:${companyId}:users`;
  const cached = cacheGet<User[]>(cacheKey);
  if (cached) return { data: cached };

  const response = await axios.get(`/api/companies/${companyId}/users`, {
    params: options?.all ? { all: 1 } : undefined,
  });
  const users = Array.isArray(response.data?.data) ? response.data.data : [];
  cacheSet(cacheKey, users, COMPANY_USERS_CACHE_TTL);
  return { data: users };
};

export interface UserImportPayload {
  name: string;
  email: string;
  password: string;
  role_id: number;
}

export interface UserImportResult {
  success: UserImportPayload[];
  failed: { row: number; email: string; error: string }[];
}

export const addUserToCompany = async (companyId: number, userData: Omit<User, 'id' | 'company_id'>): Promise<User> => {
  const response = await axios.post(`/api/companies/${companyId}/users`, userData);
  return response.data;
};

export const importUsersToCompany = async (
  companyId: number,
  users: UserImportPayload[]
): Promise<UserImportResult> => {
  const success: UserImportPayload[] = [];
  const failed: UserImportResult['failed'] = [];

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    try {
      await addUserToCompany(companyId, user);
      success.push(user);
    } catch (error: any) {
      failed.push({
        row: i + 2,
        email: user.email,
        error: error.response?.data?.message || 'Failed to create user.',
      });
    }
  }

  return { success, failed };
};

export const updateUser = async (id: number, userData: Partial<Omit<User, 'id' | 'company_id'>>): Promise<User> => {
  const response = await axios.put(`/api/users/${id}`, userData);
  return response.data;
};

export const deleteUser = async (id: number): Promise<void> => {
  await axios.delete(`/api/users/${id}`);
};

export const assignUserToDepartment = async (
  companyId: number,
  departmentId: number,
  userId: number,
  roleId?: number
): Promise<any> => {
    const response = await axios.post(`/api/companies/${companyId}/departments/${departmentId}/users`, {
        user_id: userId,
        role_id: roleId,
    });
    return response.data;
};

export const updateDepartmentUserRole = async (
  companyId: number,
  departmentId: number,
  userId: number,
  roleId: number
): Promise<any> => {
  return assignUserToDepartment(companyId, departmentId, userId, roleId);
};

export interface BulkAssignResult {
  success: number[];
  failed: { userId: number; error: string }[];
}

export const assignUsersToDepartment = async (
  companyId: number,
  departmentId: number,
  userIds: number[],
  roleId?: number
): Promise<BulkAssignResult> => {
  const success: number[] = [];
  const failed: BulkAssignResult['failed'] = [];

  for (const userId of userIds) {
    try {
      await assignUserToDepartment(companyId, departmentId, userId, roleId);
      success.push(userId);
    } catch (error: any) {
      failed.push({
        userId,
        error: error.response?.data?.message || 'Failed to assign user.',
      });
    }
  }

  return { success, failed };
};

export const getUserAssignments = async (companyId: number): Promise<{data: Assignment[]}> => {
    const response = await axios.get(`/api/companies/${companyId}/assignments`);
    return response.data;
}

export const removeUserFromDepartment = async (companyId: number, departmentId: number, userId: number): Promise<void> => {
  await axios.delete(`/api/companies/${companyId}/departments/${departmentId}/users/${userId}`);
};

export const getUserDepartments = async (userId: number): Promise<Department[]> => {
    const cacheKey = `user:${userId}:departments`;
    // const cached = cacheGet<Department[]>(cacheKey);
    // if (cached) return cached;

    const response = await axios.get(`/api/users/${userId}/departments`);
    const departments: Department[] = response.data.departments;
    
    // Cache for 2 minutes
    // cacheSet(cacheKey, departments, 2 * 60 * 1000);
    return departments;
};

export const impersonateUser = async (userId: number): Promise<any> => {
    const response = await axios.post(
      `/api/users/${userId}/impersonate`
    );

  return response.data;
};

export const stopImpersonation = async (impersonationId: string): Promise<any> => {
  const response = await axios.post(`/api/impersonation/${impersonationId}/stop`, {});

  return response.data;
};

    
