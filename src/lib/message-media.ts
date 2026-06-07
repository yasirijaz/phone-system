import type { Communication } from '@/types';

const IMAGE_URL_PATTERN = /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i;

export const MAX_MESSAGE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_MESSAGE_IMAGES = 10;

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function validateMessageImage(file: File): string | null {
  if (!isImageFile(file)) return 'Only image files are supported.';
  if (file.size > MAX_MESSAGE_IMAGE_SIZE_BYTES) return 'Each image must be 5 MB or smaller.';
  return null;
}

export function getCommunicationMediaUrls(comm: Communication): string[] {
  const direct = (comm as Communication & { media_urls?: string[] }).media_urls;
  if (Array.isArray(direct) && direct.length) {
    return direct.filter((url): url is string => typeof url === 'string' && url.length > 0);
  }

  const meta = comm.meta_data;
  if (!meta || typeof meta !== 'object') return [];

  if (Array.isArray(meta.media_urls)) {
    return meta.media_urls.filter((url: unknown) => typeof url === 'string' && url.length > 0);
  }
  if (typeof meta.media_url === 'string' && meta.media_url) {
    return [meta.media_url];
  }

  const urls: string[] = [];
  const numMedia = Number(meta.NumMedia ?? meta.num_media ?? 0);
  for (let i = 0; i < numMedia; i++) {
    const url = meta[`MediaUrl${i}`] ?? meta[`media_url_${i}`];
    if (typeof url === 'string' && url) urls.push(url);
  }

  if (urls.length) return urls;

  if (typeof comm.body === 'string' && IMAGE_URL_PATTERN.test(comm.body.trim())) {
    return [comm.body.trim()];
  }

  return [];
}

export function isImageMediaUrl(url: string): boolean {
  return IMAGE_URL_PATTERN.test(url) || url.includes('/uploads/') || url.includes('image');
}
