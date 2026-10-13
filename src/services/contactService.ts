
import axios from '@/lib/axios';
import type { Contact, PaginatedResponse } from '@/types';
import { normalizePhoneDigits, phonesMatch } from '@/lib/utils';
import { cacheDel, cacheGet, cacheInvalidatePrefix, cacheSet } from '@/lib/simpleCache';
import { events } from '@/lib/events';
import { invalidateAllCommunicationThreadCaches } from '@/services/callLogService';

export interface GetContactsParams {
  page?: number;
  per_page?: number;
  search?: string;
}

const contactsCacheKey = (companyId: number) => `company:${companyId}:contacts`;
const headerInitCachePrefix = 'header-init:';

export const invalidateContactsCache = (companyId: number) => {
  cacheDel(contactsCacheKey(companyId));
  cacheInvalidatePrefix(headerInitCachePrefix);
  invalidateAllCommunicationThreadCaches();
  events.emit('contactsChanged', companyId);
};

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

export const searchContacts = async (
  companyId: number,
  query: string,
  limit = 25
): Promise<Contact[]> => {
  const q = query.trim();
  if (!q) return [];

  const response = await axios.post(`/api/contacts/${companyId}/search`, { q, limit });
  return Array.isArray(response.data.contacts) ? response.data.contacts : [];
};

export const getAllContacts = async (companyId: number): Promise<Contact[]> => {
  // Boot paths (header, inbox, sidebar) must not page the entire directory.
  // Typeahead uses searchContacts; the contacts page uses getContactsPaginated.
  const batch = await getContactsPaginated(companyId, { page: 1, per_page: 100 });
  return batch.data ?? [];
};

export const getContacts = async (companyId: number): Promise<Contact[]> => {
  const cacheKey = contactsCacheKey(companyId);
  const cached = cacheGet<Contact[]>(cacheKey);
  if (cached) return cached;

  const contacts = await getAllContacts(companyId);
  cacheSet(cacheKey, contacts, 5 * 60 * 1000);
  return contacts;
};

export const createContact = async (contactData: Omit<Contact, 'id'>): Promise<Contact> => {
  const response = await axios.post('/api/contacts', contactData);
  invalidateContactsCache(contactData.company_id);
  return response.data.contact;
};

export const updateContact = async (id: number, contactData: Partial<Omit<Contact, 'id'>>): Promise<Contact> => {
    const response = await axios.put(`/api/contacts/${id}`, contactData);
    const companyId = contactData.company_id ?? response.data.contact?.company_id;
    if (companyId) {
      invalidateContactsCache(companyId);
    }
    return response.data.contact;
};

/** Look up a saved contact by phone number (format-agnostic). */
export const findContactByPhone = async (
  companyId: number,
  phone: string
): Promise<Contact | null> => {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return null;

  const matches = await searchContacts(companyId, digits, 50);
  return matches.find((contact) => phonesMatch(contact.phone_no, phone)) ?? null;
};

export function formatContactPhoneForApi(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return phone;
  if (phone.trim().startsWith('+')) return phone.trim();
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

export const deleteContact = async (id: number, companyId?: number): Promise<void> => {
    await axios.delete(`/api/contacts/${id}`);
    if (companyId) {
      invalidateContactsCache(companyId);
    }
};

export const blockContact = async (id: number, block_action: 'voicemail' | 'spam' | 'hard'): Promise<void> => {
  await axios.post(`/api/contacts/${id}/block`, { block_action });
};

export const unblockContact = async (id: number): Promise<void> => {
  await axios.post(`/api/contacts/${id}/unblock`);
};
