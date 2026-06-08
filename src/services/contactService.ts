
import axios from '@/lib/axios';
import type { Contact, PaginatedResponse } from '@/types';
import { normalizePhoneDigits, phonesMatch } from '@/lib/utils';
//import { cacheGet, cacheSet } from '@/lib/simpleCache';

export interface GetContactsParams {
  page?: number;
  per_page?: number;
  search?: string;
}

export const getContactsPaginated = async (
  companyId: number,
  params: GetContactsParams = {}
): Promise<PaginatedResponse<Contact>> => {
  const response = await axios.post(`/api/contacts/${companyId}`, null, {
    params: {
      page: params.page ?? 1,
      per_page: params.per_page ?? 10,
      ...(params.search ? { search: params.search } : {}),
    },
  });
  return response.data.contacts;
};

export const getContacts = async (companyId: number): Promise<Contact[]> => {
  // const cacheKey = `company:${companyId}:contacts`;
  // const cached = cacheGet<Contact[]>(cacheKey);
  // if (cached) return cached;

  const { data } = await getContactsPaginated(companyId, { page: 1, per_page: 500 });
  // Cache for 2 minutes
  //cacheSet(cacheKey, data, 2 * 60 * 1000);
  return data;
};

export const createContact = async (contactData: Omit<Contact, 'id'>): Promise<Contact> => {
  const response = await axios.post('/api/contacts', contactData);
  return response.data.contact;
};

export const updateContact = async (id: number, contactData: Partial<Omit<Contact, 'id'>>): Promise<Contact> => {
    const response = await axios.put(`/api/contacts/${id}`, contactData);
    return response.data.contact;
};

/** Look up a saved contact id by phone number (same list API as contacts page). */
export const findContactByPhone = async (
  companyId: number,
  phone: string
): Promise<Contact | null> => {
  const { data } = await getContactsPaginated(companyId, {
    page: 1,
    per_page: 500,
  });

  const directMatch = data.find((c) => phonesMatch(c.phone_no, phone));
  if (directMatch) return directMatch;

  const digits = normalizePhoneDigits(phone);
  if (!digits) return null;

  const { data: searched } = await getContactsPaginated(companyId, {
    page: 1,
    per_page: 50,
    search: digits,
  });

  return searched.find((c) => phonesMatch(c.phone_no, phone)) ?? null;
};

export function formatContactPhoneForApi(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return phone;
  if (phone.trim().startsWith('+')) return phone.trim();
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

export const deleteContact = async (id: number): Promise<void> => {
    await axios.delete(`/api/contacts/${id}`);
};

export const blockContact = async (id: number, block_action: 'voicemail' | 'spam' | 'hard'): Promise<void> => {
  await axios.post(`/api/contacts/${id}/block`, { block_action });
};

export const unblockContact = async (id: number): Promise<void> => {
  await axios.post(`/api/contacts/${id}/unblock`);
};
