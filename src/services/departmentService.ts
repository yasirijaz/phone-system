
import axios from '@/lib/axios';
import type { Department } from '@/types';

export const getDepartments = async (companyId: number): Promise<Department[]> => {
  const response = await axios.get(`/api/departments/${companyId}`);
  return response.data;
};

export const createDepartment = async (departmentData: { name: string, company_id: number }): Promise<Department> => {
  const response = await axios.post('/api/departments', departmentData);
  return response.data;
};

export const updateDepartment = async (id: number, departmentData: { name: string, company_id: number }): Promise<Department> => {
  const response = await axios.put(`/api/departments/${id}`, departmentData);
  return response.data;
};

export const deleteDepartment = async (id: number): Promise<void> => {
  await axios.delete(`/api/departments/${id}`);
};
