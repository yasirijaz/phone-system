
import axios from '@/lib/axios';
import type { User, ProfilePayload } from '@/types';


export const updateProfile = async (id: number, data: ProfilePayload): Promise<User> => {
    const response = await axios.put(`/api/users/${id}`, data);
    return response.data;
};
