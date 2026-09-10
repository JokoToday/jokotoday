export type PrototypeLibraryAssetKind = 'Character' | 'Scene' | 'Setting' | 'Activity' | 'Object' | 'Reference';

export type PrototypeLibraryAssetRole =
  | 'Character master'
  | 'Character identity reference'
  | 'Style reference'
  | 'Pose / activity reference'
  | 'Setting reference'
  | 'Object / prop reference'
  | 'Supporting reference';

export interface PrototypeLibraryAsset {
  id: string;
  name: string;
  kind: PrototypeLibraryAssetKind;
  subjectName?: string;
  role: PrototypeLibraryAssetRole;
  styleProfileId?: string;
  notes?: string;
  source: 'external-upload';
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  blob: Blob;
}

const DB_NAME = 'joko-creative-lab-prototype';
const DB_VERSION = 1;
const STORE_NAME = 'library-assets';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Browser storage is unavailable.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Could not open Creative Lab browser storage.'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function listPrototypeLibraryAssets(): Promise<PrototypeLibraryAsset[]> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).getAll();
      request.onerror = () => reject(request.error ?? new Error('Could not read Creative Lab assets.'));
      request.onsuccess = () => {
        const assets = (request.result as PrototypeLibraryAsset[])
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        resolve(assets);
      };
    });
  } finally {
    database.close();
  }
}

export async function savePrototypeLibraryAsset(asset: PrototypeLibraryAsset): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not save Creative Lab asset.'));
      transaction.oncomplete = () => resolve();
      transaction.objectStore(STORE_NAME).put(asset);
    });
  } finally {
    database.close();
  }
}

export async function deletePrototypeLibraryAsset(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not remove Creative Lab asset.'));
      transaction.oncomplete = () => resolve();
      transaction.objectStore(STORE_NAME).delete(id);
    });
  } finally {
    database.close();
  }
}
