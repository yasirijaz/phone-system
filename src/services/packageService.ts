
import type { Package } from '@/types';

// This is a mock service. Replace with actual API calls.

const MOCK_PACKAGES: Package[] = [
  { id: 1, name: 'Basic', description: 'For small teams just getting started.', price: 29, status: 1 },
  { id: 2, name: 'Pro', description: 'For growing businesses that need more power.', price: 79, status: 1 },
  { id: 3, name: 'Enterprise', description: 'For large organizations with advanced needs.', price: 199, status: 0 },
];

let nextId = 4;

export const getPackages = async (): Promise<Package[]> => {
  // Replace with: const response = await axios.get('/api/packages');
  console.log("Fetching packages (mock)");
  return Promise.resolve(MOCK_PACKAGES);
};

export const createPackage = async (packageData: Omit<Package, 'id'>): Promise<Package> => {
  // Replace with: const response = await axios.post('/api/packages', packageData);
  console.log("Creating package (mock)", packageData);
  const newPackage: Package = { ...packageData, id: nextId++ };
  MOCK_PACKAGES.push(newPackage);
  return Promise.resolve(newPackage);
};

export const updatePackage = async (id: number, packageData: Partial<Omit<Package, 'id'>>): Promise<Package> => {
  // Replace with: const response = await axios.put(`/api/packages/${id}`, packageData);
  console.log("Updating package (mock)", id, packageData);
  const index = MOCK_PACKAGES.findIndex(p => p.id === id);
  if (index !== -1) {
    MOCK_PACKAGES[index] = { ...MOCK_PACKAGES[index], ...packageData };
    return Promise.resolve(MOCK_PACKAGES[index]);
  }
  return Promise.reject(new Error("Package not found"));
};

export const deletePackage = async (id: number): Promise<void> => {
  // Replace with: await axios.delete(`/api/packages/${id}`);
  console.log("Deleting package (mock)", id);
  const index = MOCK_PACKAGES.findIndex(p => p.id === id);
  if (index !== -1) {
    MOCK_PACKAGES.splice(index, 1);
    return Promise.resolve();
  }
  return Promise.reject(new Error("Package not found"));
};
