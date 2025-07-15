
import axios from '@/lib/axios';
import type { User, Assignment, Department } from '@/types';

export const getUsersByCompany = async (companyId: number): Promise<{data: User[]}> => {
  const response = await axios.get(`/api/companies/${companyId}/users`);
  return response.data;
};

export const addUserToCompany = async (companyId: number, userData: Omit<User, 'id' | 'company_id'>): Promise<User> => {
  const response = await axios.post(`/api/companies/${companyId}/users`, userData);
  return response.data;
};

export const assignUserToDepartment = async (companyId: number, departmentId: number, userId: number): Promise<any> => {
    const response = await axios.post(`/api/companies/${companyId}/departments/${departmentId}/users`, {
        user_id: userId,
    });
    return response.data;
}

export const getUserAssignments = async (companyId: number): Promise<{data: Assignment[]}> => {
    const response = await axios.get(`/api/companies/${companyId}/assignments`);
    return response.data;
}

export const removeUserFromDepartment = async (companyId: number, departmentId: number, userId: number): Promise<void> => {
  await axios.delete(`/api/companies/${companyId}/departments/${departmentId}/users/${userId}`);
};

export const getUserDepartments = async (userId: number): Promise<Department[]> => {
    const response = await axios.get(`/api/users/${userId}/departments`);
    return response.data.departments;
};

    