
import axios from '@/lib/axios';
import type { Contact, PaginatedResponse } from '@/types';
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

export const deleteContact = async (id: number): Promise<void> => {
    await axios.delete(`/api/contacts/${id}`);
};

export const blockContact = async (id: number, block_action: 'voicemail' | 'spam' | 'hard'): Promise<void> => {
  await axios.post(`/api/contacts/${id}/block`, { block_action });
};

export const unblockContact = async (id: number): Promise<void> => {
  await axios.post(`/api/contacts/${id}/unblock`);
};
