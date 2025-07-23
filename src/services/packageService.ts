
import type { Package } from '@/types';
import axios from '@/lib/axios';

export const getPackages = async (): Promise<Package[]> => {
  const response = await axios.get('/api/pricing');
<<<<<<< HEAD
  return response.data.packages; 
=======
  return response.data.packages;
>>>>>>> 71e1f4c612c33c0021fc1fe8cc47709a6078d906
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
<<<<<<< HEAD
};
=======
};
>>>>>>> 71e1f4c612c33c0021fc1fe8cc47709a6078d906
