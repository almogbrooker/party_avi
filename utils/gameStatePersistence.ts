import { GameState, GameStage, Player, QAPair, Mission } from '../types';
import { storageManager } from './storageManager';

export interface PersistedGameState {
  // Basic game info
  gameCode: string | null;
  isHost: boolean;
  stage: GameStage;
  myPlayerId: string;

  // Host-specific data
  players?: Player[];
  currentQuestionIndex?: number;
  questions?: QAPair[];
  missions?: Mission[];
  groomCorrectCount?: number;
  roundPhase?: string;
  currentVotes?: Record<string, boolean>;
  voteTimestamps?: Record<string, number>;
  groomResult?: boolean | null;
  roundLosers?: string[];
  activeMission?: Mission | null;
  groomAnswer?: string | null;
  selectedVictimId?: string | null;
  pastVictims?: string[];

  // File references (stored separately in IndexedDB)
  videoIds?: string[];
  musicConfig?: { [key: string]: any };
  groomImageIds?: string[];

  // Timestamp
  savedAt: number;
}

const PERSISTED_STATE_KEY = 'bachelor-party-game-state';
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

export const saveGameState = async (
  gameState: GameState,
  myPlayerId: string,
  isHost: boolean
): Promise<void> => {
  try {
    // Only save if we're in an active game
    if (gameState.stage === GameStage.SETUP) {
      sessionStorage.removeItem(PERSISTED_STATE_KEY);
      return;
    }

    const persistedState: PersistedGameState = {
      gameCode: gameState.gameCode,
      isHost,
      stage: gameState.stage,
      myPlayerId,

      // Save host-specific data
      ...(isHost && {
        players: gameState.players,
        currentQuestionIndex: gameState.currentQuestionIndex,
        questions: gameState.questions,
        missions: gameState.missions,
        groomCorrectCount: gameState.groomCorrectCount,
        roundPhase: gameState.roundPhase,
        currentVotes: gameState.currentVotes,
        voteTimestamps: gameState.voteTimestamps,
        groomResult: gameState.groomResult,
        roundLosers: gameState.roundLosers,
        activeMission: gameState.activeMission,
        groomAnswer: gameState.groomAnswer,
        selectedVictimId: gameState.selectedVictimId,
        pastVictims: gameState.pastVictims,
      }),

      // Save file references
      videoIds: Object.keys(gameState.videos || {}),
      musicConfig: gameState.gameMusic || {},
      groomImageIds: gameState.groomImages?.images?.map((_: any, i: number) => `groom_image_${i}`) || [],

      savedAt: Date.now(),
    };

    // Save to sessionStorage (cleared when tab closes)
    sessionStorage.setItem(PERSISTED_STATE_KEY, JSON.stringify(persistedState));

    console.log('💾 Game state saved successfully');
  } catch (error) {
    console.error('❌ Error saving game state:', error);
  }
};

export const loadPersistedGameState = (): PersistedGameState | null => {
  try {
    const saved = sessionStorage.getItem(PERSISTED_STATE_KEY);
    if (!saved) return null;

    const persistedState = JSON.parse(saved) as PersistedGameState;

    // Check if state is too old
    if (Date.now() - persistedState.savedAt > MAX_AGE_MS) {
      console.log('⏰ Saved game state is too old, ignoring');
      sessionStorage.removeItem(PERSISTED_STATE_KEY);
      return null;
    }

    console.log('📂 Found persisted game state from', new Date(persistedState.savedAt).toLocaleTimeString());
    return persistedState;
  } catch (error) {
    console.error('❌ Error loading persisted game state:', error);
    sessionStorage.removeItem(PERSISTED_STATE_KEY);
    return null;
  }
};

export const clearPersistedGameState = (): void => {
  sessionStorage.removeItem(PERSISTED_STATE_KEY);
  console.log('🗑️ Cleared persisted game state');
};

export const hasPersistedGameState = (): boolean => {
  return sessionStorage.getItem(PERSISTED_STATE_KEY) !== null;
};

// Helper to restore full game state from persisted data
export const restoreGameState = async (
  persistedState: PersistedGameState
): Promise<Partial<GameState> & { myPlayerId: string; isHost: boolean }> => {
  const restored: Partial<GameState> & { myPlayerId: string; isHost: boolean } = {
    myPlayerId: persistedState.myPlayerId,
    isHost: persistedState.isHost,
    gameCode: persistedState.gameCode,
    stage: persistedState.stage,
  };

  // Restore host-specific data
  if (persistedState.isHost) {
    restored.players = persistedState.players || [];
    restored.currentQuestionIndex = persistedState.currentQuestionIndex || 0;
    restored.questions = persistedState.questions || [];
    restored.missions = persistedState.missions || [];
    restored.groomCorrectCount = persistedState.groomCorrectCount || 0;
    restored.roundPhase = persistedState.roundPhase as any || 'QUESTION';
    restored.currentVotes = persistedState.currentVotes || {};
    restored.voteTimestamps = persistedState.voteTimestamps || {};
    restored.groomResult = persistedState.groomResult || null;
    restored.roundLosers = persistedState.roundLosers || [];
    restored.activeMission = persistedState.activeMission || null;
    restored.groomAnswer = persistedState.groomAnswer || null;
    restored.selectedVictimId = persistedState.selectedVictimId || null;
    restored.pastVictims = persistedState.pastVictims || [];
  }

  // Load files from IndexedDB
  try {
    await storageManager.init();

    // Restore videos
    if (persistedState.videoIds && persistedState.videoIds.length > 0) {
      const videos: Record<string, File> = {};
      for (const videoId of persistedState.videoIds) {
        const file = await storageManager.getFile('videos', videoId);
        if (file) {
          videos[videoId] = file;
        }
      }
      restored.videos = videos;
    }

    // Restore music config
    if (persistedState.musicConfig) {
      const musicConfig: any = { ...persistedState.musicConfig };

      // Load music files from IndexedDB
      for (const [phase, musicData] of Object.entries(musicConfig)) {
        if (musicData) {
          const file = await storageManager.getFile('music', phase);
          if (file) {
            musicConfig[phase] = {
              ...musicData,
              file
            };
          }
        }
      }

      restored.gameMusic = musicConfig;
    }

    // Restore groom images
    if (persistedState.groomImageIds && persistedState.groomImageIds.length > 0) {
      const images: any[] = [];
      for (const imageId of persistedState.groomImageIds) {
        const file = await storageManager.getFile('images', imageId);
        if (file) {
          images.push(file);
        }
      }
      restored.groomImages = { images };
    }
  } catch (error) {
    console.error('❌ Error restoring files from IndexedDB:', error);
  }

  return restored;
};