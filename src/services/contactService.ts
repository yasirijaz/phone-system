
import axios from '@/lib/axios';
import type { Contact } from '@/types';

export const getContacts = async (companyId: number): Promise<Contact[]> => {
  const response = await axios.post(`/api/contacts/${companyId}`);
  return response.data.contacts.data;
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
