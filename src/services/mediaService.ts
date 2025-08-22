
import axios from '@/lib/axios';
import type { MediaFile } from '@/types';

export const getMediaFiles = async (): Promise<MediaFile[]> => {
  const response = await axios.get('/api/uploads');
  return response.data.data;
};

export const uploadMedia = async (file: File, title: string): Promise<MediaFile> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', title);

  const response = await axios.post('/api/uploads', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data.media;
};

export const deleteMediaFile = async (id: number): Promise<void> => {
  await axios.delete(`/api/uploads/${id}`);
};
