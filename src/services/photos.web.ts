/**
 * Web version of photos.ts. Browsers have no app file system, so the picked image is
 * downscaled with a canvas and stored as a data: URL directly in SQLite. It stays in
 * this browser only (and is included in JSON backups).
 */
import * as ImagePicker from 'expo-image-picker';

const MAX = 512;

export function photoUri(fileName: string | null | undefined): string | null {
  return fileName && fileName.startsWith('data:') ? fileName : null;
}

export function deletePhoto(_fileName: string | null | undefined) {
  // Nothing to delete: the image lives in the database row.
}

function downscale(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Center square crop, then scale to MAX×MAX.
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2;
      const sy = (img.naturalHeight - side) / 2;
      const size = Math.min(MAX, side);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas'));
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

export async function pickPhoto(source: 'camera' | 'library', _prefix: string): Promise<{ fileName: string | null; denied?: boolean }> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9 };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.length) return { fileName: null };
  try {
    return { fileName: await downscale(res.assets[0].uri) };
  } catch {
    return { fileName: null };
  }
}
