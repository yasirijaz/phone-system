
import type { Package } from '@/types';
import axios from '@/lib/axios';

export const getPackages = async (): Promise<Package[]> => {
  const response = await axios.get('/api/pricing');
  return response.data.packages;
};

export const createPackage = async (packageData: Omit<Package, 'id'>): Promise<Package> => {
  const response = await axios.post('/api/pricing', packageData);
  return response.data.package;
};

export const updatePackage = async (id: number, packageData: Partial<Omit<Package, 'id'>>): Promise<Package> => {
  const response = await axios.put(`/api/pricing/${id}`, packageData);
  return response.data.package;
};

export const deletePackage = async (id: number): Promise<void> => {
  await axios.delete(`/api/pricing/${id}`);
};