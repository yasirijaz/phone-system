
import axios from '@/lib/axios';
import type { Company, PaginatedResponse } from '@/types';

export const getAllCompanies = async (): Promise<Company[]> => {
  const response = await axios.get('/api/companies?all=1');
  return response.data.companies;
};

export const getCompanies = async (page: number = 1): Promise<PaginatedResponse<Company>> => {
  const response = await axios.get(`/api/companies?page=${page}`);
  return response.data.companies;
};

export const createCompany = async (companyData: { name: string, email: string, subdomain: string }): Promise<Company> => {
  const response = await axios.post('/api/companies', companyData);
  return response.data;
};

export const getCompany = async (id: number): Promise<Company> => {
  const response = await axios.get(`/api/companies/${id}`);
  return response.data;
};

export const updateCompany = async (id: number, companyData: { name: string, subdomain?: string }): Promise<Company> => {
  const response = await axios.put(`/api/companies/${id}`, companyData);
  return response.data;
};

export const deleteCompany = async (id: number): Promise<void> => {
  await axios.delete(`/api/companies/${id}`);
};

export const approveCompany = async (id: number): Promise<Company> => {
  const response = await axios.post(`/api/companies/${id}/approve`);
  return response.data;
};
