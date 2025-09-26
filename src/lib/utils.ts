
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhoneNumber(phoneNumberString: string | undefined | null) {
  if (!phoneNumberString) return phoneNumberString;
  const cleaned = ('' + phoneNumberString).replace(/\D/g, '');
  const match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    const a = match[2];
    const b = match[3];
    const c = match[4];
    return `(${a}) ${b}-${c}`;
  }
  return phoneNumberString;
}
