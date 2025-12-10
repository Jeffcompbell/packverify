import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export const base64ToBlobUrl = (base64: string, mimeType: string): string => {
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], { type: mimeType });
  return URL.createObjectURL(blob);
};

export const createVirtualFile = (base64: string, mimeType: string, fileName: string): File => {
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new File([ab], fileName, { type: mimeType });
};

export const generateProductName = () => {
  const now = new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  return `产品-${month}${day}-${hour}${minute}`;
};

export const STORAGE_KEY = 'packverify_data';

// Tailwind merge utility (for shadcn components)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
