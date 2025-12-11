import { AudioClipConfig } from '../components/AudioEditor';
import { storageManager } from './storageManager';

export interface SavedGameConfig {
  gameCode?: string;
  gameSettings: any; // TimerSettings
  musicConfig: {
    [key: string]: AudioClipConfig | null;
  };
  groomImages: {
    [key: string]: { name?: string; url?: string; saved?: boolean; id?: string } | null;
    images?: { id: string; name?: string; saved?: boolean }[];
  };
  videoUrl?: string;
  customQuestions: string[];
  savedAt: string;
  version: string;
}

const CONFIG_VERSION = '1.0.0';
const CONFIG_KEY = 'bachelor-party-game-config';

// Local storage for configuration metadata (not actual files)
export const saveGameConfig = async (
  gameCode: string,
  gameSettings: any,
  gameMusic: any,
  groomImages: any,
  videoUrl?: string,
  customQuestions: string[] = []
): Promise<void> => {
  try {
    // Initialize storage manager
    await storageManager.init();

    // Prepare music config for serialization (extract metadata only)
    const musicConfig: { [key: string]: AudioClipConfig | null } = {};

    // Save music files to IndexedDB
    for (const [key, music] of Object.entries(gameMusic)) {
      if (music && music instanceof File) {
        // Store file in IndexedDB
        await storageManager.storeFile('music', key, music);

        // Keep only metadata in localStorage config
        musicConfig[key] = {
          name: music.name,
          startTime: 0,
          endTime: 0,
          duration: 30,
          volume: 0.7
        };
        console.log(`🎵 Saved music file: ${music.name} for ${key}`);
      } else if (music && typeof music === 'object') {
        // Already a config object
        musicConfig[key] = music;
      } else {
        musicConfig[key] = null;
      }
    }

  // Prepare groom images for serialization and save to IndexedDB
    const groomImagesConfig: { [key: string]: any; images?: { id: string; name?: string; saved?: boolean }[] } = {};

    // Support shape { images: File[] }
    if (groomImages?.images && Array.isArray(groomImages.images)) {
      groomImagesConfig.images = [];
      for (let i = 0; i < groomImages.images.length; i++) {
        const image = groomImages.images[i];
        if (image instanceof File) {
          const id = `groom-img-${i}-${Date.now()}`;
          await storageManager.storeFile('images', id, image);
          groomImagesConfig.images.push({ id, name: image.name, saved: true });
          console.log(`🖼️ Saved groom image: ${image.name} as ${id}`);
        }
      }
    } else {
      // Fallback to key/value map behavior
      for (const [key, image] of Object.entries(groomImages || {})) {
        if (image instanceof File) {
          await storageManager.storeFile('images', key, image);
          groomImagesConfig[key] = {
            name: image.name,
            saved: true
          };
          console.log(`🖼️ Saved groom image: ${image.name} for ${key}`);
        } else if (image && typeof image === 'object') {
          groomImagesConfig[key] = image;
        } else {
          groomImagesConfig[key] = null;
        }
      }
    }

    const config: SavedGameConfig = {
      gameCode,
      gameSettings,
      musicConfig,
      groomImages: groomImagesConfig,
      videoUrl,
      customQuestions,
      savedAt: new Date().toISOString(),
      version: CONFIG_VERSION
    };

    // Save configuration metadata to localStorage
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));

    console.log('✅ Game configuration saved successfully');
    return Promise.resolve();
  } catch (error) {
      console.error('❌ Error saving game configuration:', error);
      return Promise.reject(error);
    }
};

export const loadGameConfig = (): SavedGameConfig | null => {
  try {
    const savedConfig = localStorage.getItem(CONFIG_KEY);

    if (!savedConfig) {
      console.log('No saved game configuration found');
      return null;
    }

    const config = JSON.parse(savedConfig) as SavedGameConfig;

    // Check version compatibility
    if (config.version !== CONFIG_VERSION) {
      console.warn('Configuration version mismatch, using defaults');
      return null;
    }

    console.log('✅ Game configuration loaded successfully');
    return config;
  } catch (error) {
    console.error('❌ Error loading game configuration:', error);
    return null;
  }
};

// Helper to convert base64 back to File object
export const base64ToFile = (base64: string, filename: string, mimeType: string): File => {
  const byteString = atob(base64.split(',')[1]);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);

  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }

  return new File([uint8Array], filename, { type: mimeType });
};

// Load music files from IndexedDB
export const loadMusicFiles = async (musicConfig: { [key: string]: AudioClipConfig | null }): Promise<any> => {
  const loadedMusic: any = {};

  // Initialize storage manager
  await storageManager.init();

  for (const [key, config] of Object.entries(musicConfig)) {
    if (config && config.name) {
      try {
        // Try to load file from IndexedDB
        const file = await storageManager.getFile('music', key);
        if (file) {
          loadedMusic[key] = file;
          console.log(`🎵 Loaded music file: ${file.name} for ${key}`);
        } else {
          console.log(`⚠️ Music file not found for ${key}, using config only`);
          // Create a dummy file with just the metadata
          const blob = new Blob([], { type: config.type || 'audio/mpeg' });
          const dummyFile = new File([blob], config.name, { type: config.type || 'audio/mpeg' });
          loadedMusic[key] = dummyFile;
        }
      } catch (error) {
        console.error(`Failed to load music file for ${key}:`, error);
      }
    }
  }

  return loadedMusic;
};

// Load groom images from IndexedDB
export const loadGroomImages = async (groomImagesConfig: { [key: string]: any }): Promise<any> => {
  // Initialize storage manager
  await storageManager.init();

  // If saved as array of IDs
  if (Array.isArray(groomImagesConfig?.images)) {
    const files: File[] = [];
    for (const imgMeta of groomImagesConfig.images) {
      if (imgMeta?.id) {
        const file = await storageManager.getFile('images', imgMeta.id);
        if (file) {
          files.push(file);
          console.log(`🖼️ Loaded groom image: ${file.name} for ${imgMeta.id}`);
        }
      }
    }
    return { images: files };
  }

  const loadedImages: any = {};

  for (const [key, config] of Object.entries(groomImagesConfig || {})) {
    if (config && (config.name || config.url)) {
      if (config.saved) {
        try {
          const file = await storageManager.getFile('images', key);
          if (file) {
            loadedImages[key] = file;
            console.log(`🖼️ Loaded groom image: ${file.name} for ${key}`);
          }
        } catch (error) {
          console.error(`Failed to load groom image for ${key}:`, error);
        }
      } else if (config.url) {
        loadedImages[key] = config;
      }
    }
  }

  return loadedImages;
};

// Clear saved configuration
export const clearSavedConfig = async (): Promise<void> => {
  // Clear configuration metadata from localStorage
  localStorage.removeItem(CONFIG_KEY);

  // Clear old localStorage keys for migration
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('music_') || key?.startsWith('groom_image_')) {
      localStorage.removeItem(key);
    }
  }

  // Clear IndexedDB stores
  try {
    await storageManager.init();
    await storageManager.clearStore('music');
    await storageManager.clearStore('images');
    console.log('🗑️ IndexedDB stores cleared');
  } catch (error) {
    console.error('❌ Error clearing IndexedDB stores:', error);
  }

  console.log('🗑️ Saved configuration cleared');
};

export const hasSavedConfig = (): boolean => {
  return localStorage.getItem(CONFIG_KEY) !== null;
};
