
import axios from '@/lib/axios';
import type { Integration } from '@/types';

export const getIntegrations = async (): Promise<Integration[]> => {
  const response = await axios.get('/api/integrations');
  return response.data.data;
};

export const getIntegration = async (id: number): Promise<Integration> => {
    const response = await axios.get(`/api/integrations/${id}`);
    return response.data.data;
};

export const createIntegration = async (integrationData: Omit<Integration, 'id'>): Promise<Integration> => {
  const response = await axios.post('/api/integrations', integrationData);
  return response.data.data;
};

export const updateIntegration = async (id: number, integrationData: Partial<Omit<Integration, 'id'>>): Promise<Integration> => {
  const response = await axios.put(`/api/integrations/${id}`, integrationData);
  return response.data.data;
};

export const deleteIntegration = async (id: number): Promise<void> => {
  await axios.delete(`/api/integrations/${id}`);
};
