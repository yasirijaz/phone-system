
import axios from '@/lib/axios';
import type { PhoneNumber } from '@/types';
import { cacheGet, cacheSet } from '@/lib/simpleCache';

const PHONE_NUMBERS_CACHE_TTL = 5 * 60_000;

export const getPhoneNumbers = async (departmentId: number): Promise<PhoneNumber[]> => {
  const cacheKey = `phone-numbers:${departmentId}`;
  const cached = cacheGet<PhoneNumber[]>(cacheKey);
  if (cached) return cached;

  const response = await axios.get(`/api/phone-numbers/${departmentId}`);
  const numbers = response.data.phone_numbers ?? [];
  cacheSet(cacheKey, numbers, PHONE_NUMBERS_CACHE_TTL);
  return numbers;
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