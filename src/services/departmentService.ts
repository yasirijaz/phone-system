
import axios from '@/lib/axios';
import type { Department, Operator, User } from '@/types';

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

export const getOperators = async (departmentId?: number): Promise<OperatorsResponse> => {
  const response = await axios.get('/api/operators', {
    params: departmentId ? { department_id: departmentId } : undefined,
  });
  return response.data;
};
