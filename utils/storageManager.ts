// IndexedDB wrapper for storing large files
class StorageManager {
  private dbName = 'BachelorPartyGame';
  private version = 2;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`🗄️ Opening IndexedDB "${this.dbName}" version ${this.version}`);
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('❌ IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB opened successfully');
        console.log('📋 Available object stores:', Array.from(this.db.objectStoreNames));
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log('🔄 IndexedDB upgrade needed, current version:', event.oldVersion, 'new version:', event.newVersion);
        console.log('📋 Existing object stores:', Array.from(db.objectStoreNames));

        // Create stores for different file types
        if (!db.objectStoreNames.contains('music')) {
          console.log('➕ Creating "music" object store');
          db.createObjectStore('music', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('images')) {
          console.log('➕ Creating "images" object store');
          db.createObjectStore('images', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('videos')) {
          console.log('➕ Creating "videos" object store');
          db.createObjectStore('videos', { keyPath: 'key' });
        }

        console.log('📋 Final object stores after upgrade:', Array.from(db.objectStoreNames));
      };
    });
  }

  async storeFile(storeName: string, key: string, file: File): Promise<void> {
    if (!this.db) await this.init();

    // Check if the store exists
    if (!this.db.objectStoreNames.contains(storeName)) {
      throw new Error(`Object store "${storeName}" does not exist. Available stores: ${Array.from(this.db.objectStoreNames).join(', ')}`);
    }

    return new Promise((resolve, reject) => {
      console.log(`💾 Storing file "${key}" in "${storeName}" store`);
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      const request = store.put({
        key,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        timestamp: Date.now()
      });

      request.onerror = () => {
        console.error(`❌ Failed to store file "${key}" in "${storeName}":`, request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log(`✅ Successfully stored file "${key}" in "${storeName}"`);
        resolve();
      };
    });
  }

  async getFile(storeName: string, key: string): Promise<File | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);

      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        if (result && result.file) {
          resolve(result.file);
        } else {
          resolve(null);
        }
      };
    });
  }

  async removeFile(storeName: string, key: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clearStore(storeName: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

// Export singleton instance
export const storageManager = new StorageManager();