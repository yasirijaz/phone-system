
import axios from '@/lib/axios';
import type { Contact } from '@/types';
//import { cacheGet, cacheSet } from '@/lib/simpleCache';

export const getContacts = async (companyId: number): Promise<Contact[]> => {
  // const cacheKey = `company:${companyId}:contacts`;
  // const cached = cacheGet<Contact[]>(cacheKey);
  // if (cached) return cached;

  const response = await axios.post(`/api/contacts/${companyId}`);
  const contacts: Contact[] = response.data.contacts.data;
  // Cache for 2 minutes
  //cacheSet(cacheKey, contacts, 2 * 60 * 1000);
  return contacts;
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

export const blockContact = async (id: number, block_type: 'voicemail' | 'spam' | 'block'): Promise<void> => {
  await axios.post(`/api/contacts/${id}/block`, { block_type });
};

export const unblockContact = async (id: number): Promise<void> => {
  await axios.post(`/api/contacts/${id}/unblock`);
};
