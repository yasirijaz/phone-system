
import axios from '@/lib/axios';
import type { Contact } from '@/types';

export const getContacts = async (companyId: number): Promise<Contact[]> => {
  const response = await axios.get(`/api/contacts/${companyId}`);
  return response.data.contacts;
};

export const createContact = async (contactData: Omit<Contact, 'id'>): Promise<Contact> => {
  const response = await axios.post('/api/contacts', contactData);
  return response.data.contact;
};
