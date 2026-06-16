
import axios from '@/lib/axios';
import type { PhoneNumber } from '@/types';
import { cacheGet, cacheSet, cacheDel } from '@/lib/simpleCache';

const PHONE_NUMBERS_CACHE_TTL = 5 * 60_000;

const belongsToDepartment = (num: PhoneNumber, departmentId: number) =>
  Number(num.department_id ?? num.department?.id) === Number(departmentId);

export const getCompanyPhoneNumbers = async (companyId: number): Promise<PhoneNumber[]> => {
  const cacheKey = `phone-numbers:company:${companyId}`;
  const cached = cacheGet<PhoneNumber[]>(cacheKey);
  if (cached) return cached;

  const response = await axios.get(`/api/phone-numbers/company/${companyId}`);
  const numbers = response.data.phone_numbers ?? [];
  cacheSet(cacheKey, numbers, PHONE_NUMBERS_CACHE_TTL);
  return numbers;
};

export const getDepartmentPhoneNumbers = async (departmentId: number): Promise<PhoneNumber[]> => {
  const cacheKey = `phone-numbers:department:v2:${departmentId}`;
  const cached = cacheGet<PhoneNumber[]>(cacheKey);
  if (cached) return cached;

  const response = await axios.get(`/api/phone-numbers/${departmentId}`);
  const numbers = (response.data.phone_numbers ?? []).filter((num: PhoneNumber) =>
    belongsToDepartment(num, departmentId)
  );
  cacheSet(cacheKey, numbers, PHONE_NUMBERS_CACHE_TTL);
  return numbers;
};

/** @deprecated Use getDepartmentPhoneNumbers for department pages or getCompanyPhoneNumbers for company-wide pickers */
export const getPhoneNumbers = async (departmentId: number): Promise<PhoneNumber[]> => {
  return getDepartmentPhoneNumbers(departmentId);
};

export const invalidateCompanyPhoneNumbersCache = (companyId: number) => {
  cacheDel(`phone-numbers:company:${companyId}`);
};

export const invalidateDepartmentPhoneNumbersCache = (departmentId: number) => {
  cacheDel(`phone-numbers:department:v2:${departmentId}`);
  cacheDel(`phone-numbers:department:${departmentId}`);
};

export const createPhoneNumber = async (
  data: Omit<PhoneNumber, 'id'> & { company_id?: number }
): Promise<PhoneNumber> => {
  const response = await axios.post('/api/phone-numbers', data);
  if (data.company_id) {
    invalidateCompanyPhoneNumbersCache(data.company_id);
  }
  if (data.department_id) {
    invalidateDepartmentPhoneNumbersCache(data.department_id);
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
  if (data.department_id) {
    invalidateDepartmentPhoneNumbersCache(data.department_id);
  }
  return response.data.phone_number;
};

export const deletePhoneNumber = async (
  id: number,
  options?: { companyId?: number; departmentId?: number }
): Promise<void> => {
  await axios.delete(`/api/phone-numbers/${id}`);
  if (options?.companyId) {
    invalidateCompanyPhoneNumbersCache(options.companyId);
  }
  if (options?.departmentId) {
    invalidateDepartmentPhoneNumbersCache(options.departmentId);
  }
};

export const getconferenceSid = async (callSid: string) => {
  const response = await axios.get(`/api/twilio/conference-sid/${callSid}`);
  return response.data;
};
