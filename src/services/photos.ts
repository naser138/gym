/**
 * Exercise photos chosen by the user. Picked images live in a temporary cache, so we
 * copy them into the app's Documents folder and store only the FILE NAME in SQLite
 * (iOS changes the container path between installs/updates, so full paths go stale).
 * Photos never leave the device.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

const DIR_NAME = 'exercise-photos';

function photoDir(): Directory {
  const dir = new Directory(Paths.document, DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Full URI for a stored photo, or null if it is missing (e.g. after restoring a backup). */
export function photoUri(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  try {
    const f = new File(new Directory(Paths.document, DIR_NAME), fileName);
    return f.exists ? f.uri : null;
  } catch {
    return null;
  }
}

export function deletePhoto(fileName: string | null | undefined) {
  if (!fileName) return;
  try {
    const f = new File(photoDir(), fileName);
    if (f.exists) f.delete();
  } catch {
    // already gone
  }
}

/**
 * Opens the camera or photo library and saves a square-cropped copy.
 * Returns the stored file name, or null if cancelled / permission denied.
 */
export async function pickPhoto(source: 'camera' | 'library', prefix: string): Promise<{ fileName: string | null; denied?: boolean }> {
  const perm =
    source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { fileName: null, denied: true };

  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.length) return { fileName: null };

  const src = new File(res.assets[0].uri);
  const ext = (res.assets[0].uri.split('.').pop() || 'jpg').toLowerCase().slice(0, 4);
  const fileName = `${prefix}-${Date.now()}.${ext}`;
  await src.copy(new File(photoDir(), fileName));
  return { fileName };
}
