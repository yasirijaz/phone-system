
import axios from '@/lib/axios';
import type { PhoneNumber } from '@/types';
import { cacheGet, cacheSet, cacheDel } from '@/lib/simpleCache';

const PHONE_NUMBERS_CACHE_TTL = 5 * 60_000;

export const getCompanyPhoneNumbers = async (companyId: number): Promise<PhoneNumber[]> => {
  const cacheKey = `phone-numbers:company:${companyId}`;
  const cached = cacheGet<PhoneNumber[]>(cacheKey);
  if (cached) return cached;

  const response = await axios.get(`/api/phone-numbers/company/${companyId}`);
  const numbers = response.data.phone_numbers ?? [];
  cacheSet(cacheKey, numbers, PHONE_NUMBERS_CACHE_TTL);
  return numbers;
};

/** @deprecated Use getCompanyPhoneNumbers instead */
export const getPhoneNumbers = async (companyOrDepartmentId: number): Promise<PhoneNumber[]> => {
  return getCompanyPhoneNumbers(companyOrDepartmentId);
};

export const invalidateCompanyPhoneNumbersCache = (companyId: number) => {
  cacheDel(`phone-numbers:company:${companyId}`);
};

export const createPhoneNumber = async (
  data: Omit<PhoneNumber, 'id'> & { company_id?: number }
): Promise<PhoneNumber> => {
  const response = await axios.post('/api/phone-numbers', data);
  if (data.company_id) {
    invalidateCompanyPhoneNumbersCache(data.company_id);
  }
  return response.data.phone_number;
};

export const updatePhoneNumber = async (
  id: number,
  data: Partial<PhoneNumber> & { company_id?: number }
): Promise<PhoneNumber> => {
  const response = await axios.put(`/api/phone-numbers/${id}`, data);
  if (data.company_id) {
    invalidateCompanyPhoneNumbersCache(data.company_id);
  }
  return response.data.phone_number;
};

export const deletePhoneNumber = async (id: number, companyId?: number): Promise<void> => {
  await axios.delete(`/api/phone-numbers/${id}`);
  if (companyId) {
    invalidateCompanyPhoneNumbersCache(companyId);
  }
};

export const getconferenceSid = async (callSid: string) => {
  const response = await axios.get(`/api/twilio/conference-sid/${callSid}`);
  return response.data;
};
