import type { Communication } from '@/types';

const IMAGE_URL_PATTERN = /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i;
const DATA_IMAGE_PATTERN = /^data:image\/[a-z0-9+.-]+;base64,/i;

export const MAX_MESSAGE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_MESSAGE_IMAGES = 10;

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function isDataImageUrl(value: string): boolean {
  return DATA_IMAGE_PATTERN.test(value.trim());
}

export function validateMessageImage(file: File): string | null {
  if (!isImageFile(file)) return 'Only image files are supported.';
  if (file.size > MAX_MESSAGE_IMAGE_SIZE_BYTES) return 'Each image must be 5 MB or smaller.';
  return null;
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image.'));
    };
    img.src = url;
  });
}

/** Resize and compress so the JSON body stays within typical API limits. */
export async function prepareImageForSms(
  file: File,
  maxDimension = 1280,
  quality = 0.82
): Promise<string> {
  const img = await loadImageElement(file);
  const largestSide = Math.max(img.width, img.height);
  const scale = largestSide > maxDimension ? maxDimension / largestSide : 1;
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare image for sending.');

  ctx.drawImage(img, 0, 0, width, height);

  const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const dataUrl = canvas.toDataURL(outputType, quality);

  // ~900 KB base64 keeps requests under common 1 MB body limits
  if (dataUrl.length > 900_000) {
    throw new Error('Image is too large after compression. Try a smaller image.');
  }

  return dataUrl;
}

export function fileToDataUrl(file: File): Promise<string> {
  return prepareImageForSms(file);
}

export async function filesToDataUrls(files: File[]): Promise<string[]> {
  return Promise.all(files.map((file) => fileToDataUrl(file)));
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
  if (Array.isArray(meta.media_base64)) {
    return meta.media_base64
      .filter((value: unknown) => typeof value === 'string' && value.length > 0)
      .map((value: string) => (isDataImageUrl(value) ? value : `data:image/jpeg;base64,${value}`));
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

  if (typeof comm.body === 'string') {
    const body = comm.body.trim();
    if (isDataImageUrl(body)) return [body];
    if (IMAGE_URL_PATTERN.test(body)) return [body];
  }

  return [];
}

export function isImageMediaUrl(url: string): boolean {
  return isDataImageUrl(url) || IMAGE_URL_PATTERN.test(url) || url.includes('/uploads/') || url.includes('image');
}

export function isInlineImageBody(body?: string | null): boolean {
  if (!body?.trim()) return false;
  const trimmed = body.trim();
  return isDataImageUrl(trimmed) || (IMAGE_URL_PATTERN.test(trimmed) && !trimmed.includes(' '));
}
