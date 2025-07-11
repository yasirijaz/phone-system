
import axios from '@/lib/axios';
import type { User } from '@/types';

export const getUsersByCompany = async (companyId: number): Promise<User[]> => {
  const response = await axios.get(`/api/companies/${companyId}/users`);
  return response.data.data;
};

export const addUserToCompany = async (companyId: number, userData: Omit<User, 'id' | 'company_id'>): Promise<User> => {
  const response = await axios.post(`/api/companies/${companyId}/users`, userData);
  return response.data;
};
