
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

export const assignDepartmentToUser = async (userId: number, departmentId: number): Promise<any> => {
    const response = await axios.post('/api/departments/users', {
        user_id: userId,
        department_id: departmentId,
    });
    return response.data;
}

export const getUserAssignments = async (companyId: number): Promise<{data: Assignment[]}> => {
    const response = await axios.get(`/api/departments/users?company_id=${companyId}`);
    return response.data;
}

export const getAssignedDepartmentsForUser = async (): Promise<{departments: Department[]}> => {
    const response = await axios.get(`/api/departments/users`);
    return response.data;
}





