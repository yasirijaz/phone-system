
import axios from '@/lib/axios';
import type { PhoneNumber } from '@/types';

export const getPhoneNumbers = async (departmentId: number): Promise<PhoneNumber[]> => {
  const response = await axios.get(`/api/phone-numbers/${departmentId}`);
  return response.data.phoneNumbers;
};

export const createPhoneNumber = async (data: Omit<PhoneNumber, 'id'>): Promise<PhoneNumber> => {
  const response = await axios.post('/api/phone-numbers', data);
  return response.data.phoneNumber;
};

export const updatePhoneNumber = async (id: number, data: Partial<PhoneNumber>): Promise<PhoneNumber> => {
  const response = await axios.put(`/api/phone-numbers/${id}`, data);
  return response.data.phoneNumber;
};

export const deletePhoneNumber = async (id: number): Promise<void> => {
  await axios.delete(`/api/phone-numbers/${id}`);
};
