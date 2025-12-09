
export interface Mission {
  id: string;
  text: string;
}

export interface Player {
  id: string;
  name: string;
  photo?: string; // Base64 data URL of the player's selfie
  score: number;
  drinks: number;
  isHost?: boolean;
  isGroom?: boolean; // New flag to identify the groom
}

export interface VideoAsset {
  id: string;
  file: File;
  name: string;
}

export interface QAPair {
  id: string;
  videoId: string; // Links this question to a specific video file
  question: string;
  answer: string;
  // Timestamps in seconds
  qStart: number;
  qEnd: number;
  aStart: number;
  aEnd: number;
  
  // Legacy support for display string if needed, but we use numbers for logic
  timestampStr?: string; 
}

export enum GameStage {
  SETUP = 'SETUP',
  LOBBY = 'LOBBY',
  PLAYING = 'PLAYING',
  SUMMARY = 'SUMMARY',
}

export interface GameState {
  stage: GameStage;
  players: Player[];
  missions: Mission[];
  questions: QAPair[];
  currentQuestionIndex: number;
  
  // Changed from single file to a map of ID -> File
  videos: Record<string, File>; 
  
  groomCorrectCount: number;
  gameCode: string | null;
  isHost: boolean;
  isPaused: boolean; // Global pause state
  
  // Real-time round state
  roundPhase: 'QUESTION' | 'GROOM_ANSWERING' | 'GROOM_WRITING' | 'VOTING' | 'REVEAL' | 'JUDGMENT' | 'CONSEQUENCE' | 'MISSION_EXECUTION' | 'VICTIM_SELECTION' | 'VICTIM_REVEAL';
  currentVotes: Record<string, boolean>; // playerId -> true (He's Right) / false (He's Wrong)
  groomResult: boolean | null; // Did the groom get it right?
  roundLosers: string[]; // IDs of players who lost this round
  activeMission: Mission | null;
  groomAnswer: string | null; // The text answer provided by the groom
  selectedVictimId: string | null;
  pastVictims: string[];
}

// Network Messages
export type NetworkMessage = 
  | { type: 'JOIN'; payload: { name: string; id: string; isGroom?: boolean; photo?: string } }
  | { type: 'STATE_UPDATE'; payload: Partial<GameState> }
  | { type: 'VOTE'; payload: { playerId: string; vote: boolean } }
  | { type: 'GROOM_ANSWER'; payload: { answer: string } }
  | { type: 'GROOM_SELECT_VICTIM'; payload: { victimId: string } }
  | { type: 'KICK'; payload: { playerId: string } };
