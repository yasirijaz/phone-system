
import axios from '@/lib/axios';
import type { User, ProfilePayload } from '@/types';


export const updateProfile = async (id: number, data: ProfilePayload): Promise<User> => {
    let response;
    
    if (data.profile_picture) {
        const formData = new FormData();
        formData.append('profile_picture', data.profile_picture);
        // If other fields need to be sent, they must also be appended.
        // For now, assuming only the picture is updated this way.
        formData.append('_method', 'PUT'); // Spoof PUT request if backend requires it with multipart

        response = await axios.post(`/api/users/${id}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });

    } else {
        response = await axios.put(`/api/users/${id}`, data);
    }

    const payload = response.data as {
        user?: User;
        data?: { user?: User };
    };

    return payload.data?.user ?? payload.user ?? (response.data as User);
};

export const getUserDevices = async (): Promise<any[]> => {
    const response = await axios.get('/api/devices');
    return response.data;
}

export const logoutDevice = async (deviceId: number) => {
  const response = await axios.delete(`/api/devices/${deviceId}`);

  return response.data;
};