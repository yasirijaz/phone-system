import type { Communication } from '@/types';

const IMAGE_URL_PATTERN = /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i;
const VIDEO_URL_PATTERN = /\.(mp4|mov|webm|m4v)(\?|$)/i;
const AUDIO_URL_PATTERN = /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i;
const DATA_IMAGE_PATTERN = /^data:image\/[a-z0-9+.-]+;base64,/i;
const DATA_VIDEO_PATTERN = /^data:video\/[a-z0-9+.-]+;base64,/i;
const DATA_AUDIO_PATTERN = /^data:audio\/[a-z0-9+.-]+;base64,/i;

export const MAX_MESSAGE_MEDIA_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_MESSAGE_MEDIA = 5;

/** @deprecated Use MAX_MESSAGE_MEDIA */
export const MAX_MESSAGE_IMAGES = MAX_MESSAGE_MEDIA;

/** @deprecated Use MAX_MESSAGE_MEDIA_SIZE_BYTES */
export const MAX_MESSAGE_IMAGE_SIZE_BYTES = MAX_MESSAGE_MEDIA_SIZE_BYTES;

export type MessageMediaKind = 'image' | 'video' | 'audio' | 'file';

export function getMessageMediaKind(file: File): MessageMediaKind {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'file';
}

export function isImageFile(file: File): boolean {
  return getMessageMediaKind(file) === 'image';
}

export function isDataImageUrl(value: string): boolean {
  return DATA_IMAGE_PATTERN.test(value.trim());
}

export function isDataVideoUrl(value: string): boolean {
  return DATA_VIDEO_PATTERN.test(value.trim());
}

export function isDataAudioUrl(value: string): boolean {
  return DATA_AUDIO_PATTERN.test(value.trim());
}

export function validateMessageMedia(file: File): string | null {
  const kind = getMessageMediaKind(file);
  if (kind === 'file') {
    return 'Unsupported file type. Use images, video, or audio.';
  }
  if (file.size > MAX_MESSAGE_MEDIA_SIZE_BYTES) {
    return 'Each attachment must be 5 MB or smaller.';
  }
  return null;
}

/** @deprecated Use validateMessageMedia */
export function validateMessageImage(file: File): string | null {
  return validateMessageMedia(file);
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

/** Resize and compress images so JSON payloads stay within typical API limits. */
export async function prepareImageForMms(
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

  if (dataUrl.length > 900_000) {
    throw new Error('Image is too large after compression. Try a smaller image.');
  }

  return dataUrl;
}

/** @deprecated Use prepareImageForMms */
export const prepareImageForSms = prepareImageForMms;

export function fileToDataUrl(file: File): Promise<string> {
  return prepareImageForMms(file);
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
    if (isDataImageUrl(body) || isDataVideoUrl(body) || isDataAudioUrl(body)) return [body];
    if (IMAGE_URL_PATTERN.test(body) || VIDEO_URL_PATTERN.test(body) || AUDIO_URL_PATTERN.test(body)) {
      return [body];
    }
  }

  return [];
}

export function getCommunicationMediaContentTypes(comm: Communication): string[] {
  const meta = comm.meta_data;
  if (!meta || typeof meta !== 'object') return [];

  if (Array.isArray(meta.media_content_types)) {
    return meta.media_content_types.filter((value: unknown) => typeof value === 'string');
  }

  const types: string[] = [];
  const numMedia = Number(meta.NumMedia ?? meta.num_media ?? 0);
  for (let i = 0; i < numMedia; i++) {
    const type = meta[`MediaContentType${i}`] ?? meta[`media_content_type_${i}`];
    if (typeof type === 'string' && type) types.push(type);
  }

  return types;
}

export function isImageMediaUrl(url: string, contentType?: string): boolean {
  if (contentType?.startsWith('image/')) return true;
  if (url.includes('/api/twilio/mms/stream')) return false;
  return isDataImageUrl(url) || IMAGE_URL_PATTERN.test(url) || url.includes('/uploads/') || url.includes('/mms/') && IMAGE_URL_PATTERN.test(url);
}

export function isVideoMediaUrl(url: string, contentType?: string): boolean {
  if (contentType?.startsWith('video/')) return true;
  return isDataVideoUrl(url) || VIDEO_URL_PATTERN.test(url);
}

export function isAudioMediaUrl(url: string, contentType?: string): boolean {
  if (contentType?.startsWith('audio/')) return true;
  return isDataAudioUrl(url) || AUDIO_URL_PATTERN.test(url);
}

export function isInlineImageBody(body?: string | null): boolean {
  if (!body?.trim()) return false;
  const trimmed = body.trim();
  return isDataImageUrl(trimmed) || (IMAGE_URL_PATTERN.test(trimmed) && !trimmed.includes(' '));
}

export function getMessagePreviewText(comm: Communication): string {
  const body = comm.body?.trim();
  if (body && !isInlineImageBody(body)) {
    return body.slice(0, 40);
  }

  const mediaUrls = getCommunicationMediaUrls(comm);
  if (!mediaUrls.length) return '';

  const contentTypes = getCommunicationMediaContentTypes(comm);
  if (mediaUrls.some((url, index) => isImageMediaUrl(url, contentTypes[index]))) return 'Photo';
  if (mediaUrls.some((url, index) => isVideoMediaUrl(url, contentTypes[index]))) return 'Video';
  if (mediaUrls.some((url, index) => isAudioMediaUrl(url, contentTypes[index]))) return 'Audio';

  return 'Attachment';
}
