
import axios from '@/lib/axios';
import type { Department, User } from '@/types';

export const getDepartments = async (companyId: number): Promise<Department[]> => {
  const response = await axios.get(`/api/companies/departments?company_id=${companyId}`);
  return response.data.departments;
};

export const getDepartmentsByCompany = async (companyId: number): Promise<{departments: Department[]}> => {
    const response = await axios.get(`/api/companies/departments?company_id=${companyId}`);
    return response.data;
}

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

export const getDepartmentUsers = async (departmentId: number): Promise<{users: User[]}> => {
    const response = await axios.get(`/api/department/${departmentId}/users`);
    return response.data;
};
