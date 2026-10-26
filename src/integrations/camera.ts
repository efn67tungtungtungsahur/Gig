import { Camera } from '@capacitor/camera';
import { isNative } from './http';

/** Picks screenshots and returns their local file paths (for on-device text recognition). */
export async function pickImagePaths(limit = 6): Promise<string[]> {
  if (!isNative) return [];
  const res = await Camera.pickImages({ quality: 100, limit });
  return res.photos.map((p) => p.path).filter((p): p is string => !!p);
}

/** Picks a text file (e.g. .ics export). */
export function pickTextFile(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? await file.text() : null);
    };
    input.click();
  });
}
