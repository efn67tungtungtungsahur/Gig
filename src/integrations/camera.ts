import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { isNative } from './http';

export interface ImageInput {
  base64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
}

/** Longest edge kept for on-device analysis – enough detail, little memory. */
const MAX_EDGE = 1568;

async function downscale(dataUrl: string): Promise<ImageInput> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const out = canvas.toDataURL('image/jpeg', 0.85);
  return { base64: out.split(',')[1], mediaType: 'image/jpeg' };
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** Browser fallback: a hidden file input. */
function pickFiles(multiple: boolean, capture: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = multiple;
    if (capture) input.setAttribute('capture', 'environment');
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}

/** Takes a photo with the camera. Returns the image for the AI plus a preview URL. */
export async function takePhoto(): Promise<{ image: ImageInput; preview: string } | null> {
  if (isNative) {
    const photo = await Camera.getPhoto({
      source: CameraSource.Camera,
      resultType: CameraResultType.DataUrl,
      quality: 85,
      width: MAX_EDGE,
      correctOrientation: true,
    });
    if (!photo.dataUrl) return null;
    const image = await downscale(photo.dataUrl);
    return { image, preview: `data:image/jpeg;base64,${image.base64}` };
  }
  const [file] = await pickFiles(false, true);
  if (!file) return null;
  const image = await downscale(await readFile(file));
  return { image, preview: `data:image/jpeg;base64,${image.base64}` };
}

/** Picks screenshots from the gallery. */
export async function pickImages(limit = 6): Promise<ImageInput[]> {
  if (isNative) {
    const res = await Camera.pickImages({ quality: 90, limit });
    const out: ImageInput[] = [];
    for (const p of res.photos) {
      if (!p.webPath) continue;
      const blob = await (await fetch(p.webPath)).blob();
      const dataUrl = await readFile(new File([blob], 'img', { type: blob.type }));
      out.push(await downscale(dataUrl));
    }
    return out;
  }
  const files = await pickFiles(true, false);
  return Promise.all(files.slice(0, limit).map(async (f) => downscale(await readFile(f))));
}

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
