
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

export const assignDepartmentToUser = async (companyId: number, departmentId: number, userId: number): Promise<any> => {
    const response = await axios.post(`/api/companies/${companyId}/departments/${departmentId}/users`, {
        user_id: userId,
    });
    return response.data;
}

export const getUserAssignments = async (companyId: number): Promise<{data: Assignment[]}> => {
    const response = await axios.get(`/api/companies/${companyId}/assignments`);
    return response.data;
}

export const getAssignedDepartmentsForUser = async (): Promise<{departments: Department[]}> => {
    // This route seems to be missing from the new structure for a regular user to see their own departments.
    // Assuming a future endpoint or using a filtered company-level one for now.
    // This might need adjustment based on final API design for user-specific data.
    const response = await axios.get(`/api/departments/users`); // This endpoint fetches all assignments, might need filtering client-side for non-admins
    return response.data;
}

export const removeUserFromDepartment = async (companyId: number, departmentId: number, userId: number): Promise<void> => {
  await axios.delete(`/api/companies/${companyId}/departments/${departmentId}/users/${userId}`);
};
