
import axios from '@/lib/axios';
import type { PhoneNumber } from '@/types';

export const getPhoneNumbers = async (departmentId: number): Promise<PhoneNumber[]> => {
  const response = await axios.get(`/api/phone-numbers/${departmentId}`);
  // The API response nests the array inside a `phone_numbers` key
  return response.data.phone_numbers;
};

export const createPhoneNumber = async (data: Omit<PhoneNumber, 'id'>): Promise<PhoneNumber> => {
  const response = await axios.post('/api/phone-numbers', data);
  return response.data.phone_number;
};

export const updatePhoneNumber = async (id: number, data: Partial<PhoneNumber>): Promise<PhoneNumber> => {
  const response = await axios.put(`/api/phone-numbers/${id}`, data);
  return response.data.phone_number;
};

export const deletePhoneNumber = async (id: number): Promise<void> => {
  await axios.delete(`/api/phone-numbers/${id}`);
};

export const getconferenceSid = async (callSid: string) => {
  const response = await axios.get(`/api/twilio/conference-sid/${callSid}`);
  return response.data;
};