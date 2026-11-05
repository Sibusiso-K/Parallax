import { photoManifestSchema, type PhotoManifest } from '../../../../shared/world/manifest';

const open = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open('parallax-photo-worlds', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('worlds');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(new Error('Local storage is unavailable.'));
  request.onblocked = () => reject(new Error('Close another Parallax tab to save this world.'));
});
export async function cachedWorld(key: string): Promise<PhotoManifest | null> {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('worlds', 'readonly');
      const request = transaction.objectStore('worlds').get(key);
      request.onsuccess = () => { const result = photoManifestSchema.safeParse(request.result); resolve(result.success ? result.data : null); };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => db.close(); transaction.onabort = () => db.close();
    });
  } catch { return null; }
}
export async function saveWorld(key: string, manifest: PhotoManifest): Promise<boolean> {
  try {
    const db = await open();
    return await new Promise((resolve) => {
      const tx = db.transaction('worlds', 'readwrite'); const store = tx.objectStore('worlds');
      // Only keep the latest world: large base64 images otherwise exhaust mobile storage quickly.
      store.clear(); store.put(photoManifestSchema.parse(manifest), key);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = tx.onabort = () => { db.close(); resolve(false); };
    });
  } catch { return false; }
}
export async function forgetWorlds(): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('worlds', 'readwrite'); tx.objectStore('worlds').clear();
    tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => { db.close(); reject(new Error('Could not clear saved worlds.')); };
  });
}
