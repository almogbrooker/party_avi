import React, { useState, useEffect, useMemo } from 'react';
import { GameState, GameStage, Player, Mission, QAPair } from './types';
import SetupPhase from './components/SetupPhase';
import GamePhase from './components/GamePhase';
import SummaryPhase from './components/SummaryPhase';
import PlayerMobileView from './components/PlayerMobileView';
import { initializePeer, connectToHost, setOnMessage, broadcastMessage, sendMessageToHost, disconnectAll } from './services/peerService';
import { Sparkles, Wifi, Share2, Crown, Copy, User, Loader2, LogOut, Bot } from 'lucide-react';

const generateGameCode = () => {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    stage: GameStage.SETUP,
    players: [],
    missions: [],
    questions: [],
    currentQuestionIndex: 0,
    videos: {}, // Map of VideoID -> File
    groomCorrectCount: 0,
    gameCode: null,
    isHost: false,
    isPaused: false,
    roundPhase: 'QUESTION',
    currentVotes: {},
    groomResult: null,
    roundLosers: [],
    activeMission: null,
    groomAnswer: null,
    selectedVictimId: null,
    pastVictims: []
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  
  const [initialJoinCode, setInitialJoinCode] = useState<string>('');
  const [initialRole, setInitialRole] = useState<'PLAYER' | 'GROOM'>('PLAYER');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const role = params.get('role');
    
    if (code) {
      setInitialJoinCode(code);
      if (role === 'groom') {
        setInitialRole('GROOM');
      }
    }
  }, []);

  useEffect(() => {
    setOnMessage((msg, conn) => {
      switch (msg.type) {
        case 'JOIN':
          if (gameState.isHost) {
            setGameState(prev => {
              // Check if player exists (reconnection)
              const existingPlayer = prev.players.find(p => p.id === msg.payload.id);
              
              const newPlayer: Player = {
                id: msg.payload.id,
                name: msg.payload.name,
                // Preserve score/drinks if exists, else 0
                score: existingPlayer ? existingPlayer.score : 0,
                drinks: existingPlayer ? existingPlayer.drinks : 0,
                isGroom: msg.payload.isGroom,
                photo: msg.payload.photo || existingPlayer?.photo, // Update photo if provided, or keep old
                isBot: false
              };

              const filtered = prev.players.filter(p => p.id !== newPlayer.id);
              
              // Ensure we don't have duplicate groom if someone reconnects as groom
              const finalPlayers = msg.payload.isGroom 
                ? filtered.filter(p => !p.isGroom) 
                : filtered;
              
              const newState = { ...prev, players: [...finalPlayers, newPlayer] };
              broadcastMessage({ type: 'STATE_UPDATE', payload: newState });
              return newState;
            });
          }
          break;
        case 'VOTE':
          if (gameState.isHost) {
            setGameState(prev => {
              const newState = {
                ...prev,
                currentVotes: { ...prev.currentVotes, [msg.payload.playerId]: msg.payload.vote }
              };
              broadcastMessage({ type: 'STATE_UPDATE', payload: newState });
              return newState;
            });
          }
          break;
        case 'GROOM_ANSWER':
          if (gameState.isHost) {
              setGameState(prev => {
                  const newState = { ...prev, groomAnswer: msg.payload.answer };
                  broadcastMessage({ type: 'STATE_UPDATE', payload: newState });
                  return newState;
              });
          }
          break;
        case 'GROOM_SELECT_VICTIM':
          if (gameState.isHost) {
              setGameState(prev => {
                  // Only update if we are in the correct phase or transitioning
                  const newState: GameState = { 
                      ...prev, 
                      selectedVictimId: msg.payload.victimId,
                      roundPhase: 'VICTIM_REVEAL',
                      pastVictims: prev.pastVictims.includes(msg.payload.victimId) 
                          ? prev.pastVictims 
                          : [...prev.pastVictims, msg.payload.victimId]
                  };
                  broadcastMessage({ type: 'STATE_UPDATE', payload: newState });
                  return newState;
              });
          }
          break;
        case 'STATE_UPDATE':
          if (!gameState.isHost) {
            setGameState(prev => ({ ...prev, ...msg.payload }));
          }
          break;
      }
    });
  }, [gameState.isHost]);

  // HOST: Create Game
  const handleHostGame = async (videos: Record<string, File>, missions: Mission[], questions: QAPair[]) => {
    setIsLoading(true);
    try {
      const code = generateGameCode();
      await initializePeer(code);
      
      // Add host as a player by default
      const hostPlayer: Player = {
          id: 'host-player',
          name: 'המארח',
          score: 0,
          drinks: 0,
          isGroom: false, // Will be set to groom if no one else joins as groom
          isBot: false
      };

      setMyPlayerId('host-player');
      setGameState(prev => ({
        ...prev,
        stage: GameStage.LOBBY,
        isHost: true,
        gameCode: code,
        videos: videos,
        questions,
        missions,
        roundPhase: 'QUESTION',
        groomAnswer: null,
        isPaused: false,
        selectedVictimId: null,
        roundLosers: [],
        currentVotes: {},
        activeMission: null,
        players: [hostPlayer]
      }));
      
      setConnectionStatus('connected');
    } catch (err: any) {
      setError("Failed to start game: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartRound = () => {
    // Ensure there's a groom when starting the game
    const hasGroom = gameState.players.some(p => p.isGroom);
    let updatedPlayers = gameState.players;

    if (!hasGroom && gameState.players.length > 0) {
        // If no groom exists, make the host the groom
        updatedPlayers = gameState.players.map(p =>
            p.id === myPlayerId ? { ...p, isGroom: true } : p
        );
    }

    const newState = {
        stage: GameStage.PLAYING,
        players: updatedPlayers
    };
    setGameState(prev => ({ ...prev, ...newState }));
    broadcastMessage({ type: 'STATE_UPDATE', payload: newState });
  };

  const handleJoinGame = async (name: string, code: string, isGroom: boolean = false, photo?: string, existingId?: string) => {
    // OPTIMISTIC UPDATE: Transition to LOBBY immediately
    const tempId = existingId || `temp-${Date.now()}`;
    const myPlayer: Player = {
        id: tempId,
        name: name,
        score: 0,
        drinks: 0,
        isGroom: isGroom,
        photo: photo,
        isBot: false
    };

    setMyPlayerId(tempId);
    setGameState(prev => ({
        ...prev,
        stage: GameStage.LOBBY,
        gameCode: code,
        players: [myPlayer]
    }));
    
    setConnectionStatus('connecting');

    try {
      const conn = await connectToHost(code, { name });
      
      const realId = conn.peer;
      setMyPlayerId(realId);
      
      // Replace temporary ID with real ID in state
      setGameState(prev => ({
          ...prev,
          players: prev.players.map(p => p.id === tempId ? { ...p, id: realId } : p)
      }));
      
      setConnectionStatus('connected');
      sendMessageToHost({ type: 'JOIN', payload: { name, id: realId, isGroom, photo } });

    } catch (err: any) {
      console.error(err);
      setError("לא הצלחנו להתחבר למשחק. וודא שהקוד נכון.");
      setConnectionStatus('disconnected');
    }
  };

  const handleHostUpdateState = (updates: Partial<GameState>) => {
    setGameState(prev => {
       const newState = { ...prev, ...updates };
       broadcastMessage({ type: 'STATE_UPDATE', payload: newState });
       return newState;
    });
  };

  const handleGameEnd = () => {
    handleHostUpdateState({ stage: GameStage.SUMMARY });
  };

  const handleRestart = () => {
    disconnectAll();
    window.location.href = window.location.origin + window.location.pathname; 
  };

  const ensureHttps = (url: string) => {
    // If it's a local IP without protocol, add https://
    if (url.startsWith('192.168.') || url.startsWith('10.') || url.startsWith('172.')) {
      return `https://${url}`;
    }
    return url;
  };

  const generateShareLink = (role: 'player' | 'groom') => {
    // Store the tunnel URL when first accessed from a tunnel
    const storageKey = 'tunnel_url';
    const currentHost = window.location.host;
    let baseUrl = window.location.origin + window.location.pathname;

    // If currently accessing through a tunnel, store it
    if (currentHost.includes('trycloudflare.com') || currentHost.includes('ngrok') || currentHost.includes('loca.lt') || !currentHost.includes('localhost')) {
      localStorage.setItem(storageKey, baseUrl);
    }
    // If accessing through localhost, try to get stored tunnel URL
    else if (currentHost.includes('localhost') || currentHost.includes('127.0.0.1')) {
      const storedTunnelUrl = localStorage.getItem(storageKey);
      if (storedTunnelUrl) {
        baseUrl = storedTunnelUrl;
      }
      // Fallback to known tunnel if none stored
      else {
        baseUrl = 'https://symptoms-prostores-basis-kidney.trycloudflare.com';
      }
    }

    let url = `${baseUrl}?code=${gameState.gameCode}`;
    if (role === 'groom') url += `&role=groom';
    return ensureHttps(url);
  };

  const shareToWhatsapp = (role: 'player' | 'groom') => {
    const url = generateShareLink(role);
    const text = role === 'groom'
      ? `היי חתן! 🎉\n\nכנס למשחק שלנו כאן:\n${url}`
      : `יאללה כולם להיכנס למשחק! 🎮\n\nהקוד הוא: ${gameState.gameCode}\n\nלחצו כאן להיכנס:\n${url}\n\nאו היכנסו ידנית עם הקוד`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const copyLink = (role: 'player' | 'groom') => {
      const url = generateShareLink(role);
      if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(() => alert('הקישור הועתק!'));
      } else {
          alert('העתק את הקישור: ' + url);
      }
  }

  const addBots = () => {
      setGameState(prev => {
          const bots: Player[] = [];
          
          // Add Groom Bot if needed
          const hasGroom = prev.players.some(p => p.isGroom);
          if (!hasGroom) {
              bots.push({
                  id: `bot-groom-${Date.now()}`,
                  name: 'חתן בוט',
                  score: 0,
                  drinks: 0,
                  isGroom: true,
                  isBot: true,
                  photo: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Felix' 
              });
          }

          // Add 1 regular bot
          bots.push({
              id: `bot-player-${Date.now()}`,
              name: `בוט ${Math.floor(Math.random()*100)}`,
              score: 0,
              drinks: 0,
              isGroom: false,
              isBot: true,
              photo: `https://api.dicebear.com/9.x/avataaars/svg?seed=${Date.now()}`
           });

          const newState = { ...prev, players: [...prev.players, ...bots] };
          broadcastMessage({ type: 'STATE_UPDATE', payload: newState });
          return newState;
      });
  };

  // Determine container classes based on stage
  const isPlaying = gameState.stage === GameStage.PLAYING;
  
  // Check if current player is the groom - memoize for performance
  const isCurrentPlayerGroom = useMemo(() =>
    gameState.players.find(p => p.id === myPlayerId)?.isGroom || false,
    [gameState.players, myPlayerId]
  );

  // Full screen for PLAYING, regular container for others
  const containerClasses = isPlaying
    ? "relative w-full h-screen overflow-hidden bg-black"
    : "relative z-10 container mx-auto px-4 py-6 min-h-screen flex flex-col";

  return (
    <div className={`min-h-screen bg-[#0f172a] text-slate-100 font-rubik selection:bg-purple-500 selection:text-white ${isPlaying ? 'overflow-hidden' : 'overflow-x-hidden'}`} dir="rtl">
      
      {!isPlaying && (
          <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
          </div>
      )}

      <div className={containerClasses}>
        
        {/* Only show Header if NOT playing */}
        {!isPlaying && (
            <header className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700/50">
            <div className="flex items-center gap-2 text-purple-400">
                <Sparkles className="w-5 h-5" />
                <span className="font-bold text-lg hidden md:inline">המשחק של החתן</span>
            </div>
            
            {gameState.stage !== GameStage.SETUP && (
                <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                <div className={`flex items-center gap-1 ${connectionStatus === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
                    <Wifi className="w-4 h-4" />
                    <span>{connectionStatus === 'connected' ? 'מחובר' : (connectionStatus === 'connecting' ? 'מתחבר...' : 'מנותק')}</span>
                </div>
                {gameState.gameCode && <div className="bg-slate-800 px-3 py-1 rounded-full border border-slate-700 font-mono">CODE: {gameState.gameCode}</div>}
                </div>
            )}
            </header>
        )}

        <main className={`flex-grow flex flex-col ${!isPlaying ? 'justify-center' : 'h-full'}`}>
          {error && (
            <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-center animate-shake z-50 flex items-center justify-between relative">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="underline text-sm hover:text-white">סגור</button>
            </div>
          )}

          {gameState.stage === GameStage.SETUP && (
            <SetupPhase 
              onHostGame={handleHostGame}
              onJoinGame={handleJoinGame}
              isLoading={isLoading}
              isJoining={isLoading}
              initialCode={initialJoinCode}
              initialRole={initialRole}
            />
          )}

          {gameState.stage === GameStage.LOBBY && (
             <div className="text-center space-y-8 animate-fade-in w-full max-w-4xl mx-auto my-auto">
                <div className="space-y-2">
                    <h1 className="text-4xl font-black text-white">לובי המתנה</h1>
                    <p className="text-slate-400">שתפו את הקישורים כדי להתחיל</p>
                </div>

                {gameState.isHost && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-yellow-500/30 flex flex-col items-center gap-4 shadow-lg">
                            <Crown className="w-10 h-10 text-yellow-400" />
                            <div className="text-center">
                                <h3 className="font-bold text-lg">קישור לחתן</h3>
                            </div>
                            <div className="flex gap-2 w-full">
                                <button onClick={() => shareToWhatsapp('groom')} className="flex-1 bg-[#25D366] hover:bg-[#20bd5a] text-white py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"><Share2 className="w-4 h-4" /> וואטסאפ</button>
                                <button onClick={() => copyLink('groom')} className="px-3 bg-slate-700 hover:bg-slate-600 rounded-xl"><Copy className="w-4 h-4 text-white" /></button>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-blue-500/30 flex flex-col items-center gap-4 shadow-lg">
                            <div className="flex -space-x-2">
                                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center border-2 border-slate-800 z-10">P1</div>
                                <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center border-2 border-slate-800">P2</div>
                            </div>
                            <div className="text-center">
                                <h3 className="font-bold text-lg">קישור לקבוצה</h3>
                            </div>
                             <div className="flex gap-2 w-full">
                                <button onClick={() => shareToWhatsapp('player')} className="flex-1 bg-[#25D366] hover:bg-[#20bd5a] text-white py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"><Share2 className="w-4 h-4" /> וואטסאפ</button>
                                <button onClick={() => copyLink('player')} className="px-3 bg-slate-700 hover:bg-slate-600 rounded-xl"><Copy className="w-4 h-4 text-white" /></button>
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 min-h-[200px]">
                   <h3 className="text-xl font-bold mb-4 flex items-center justify-center gap-2">מי כבר כאן? ({gameState.players.length})</h3>
                   <div className="flex flex-wrap justify-center gap-6">
                      {gameState.players.map(p => (
                        <div key={p.id} className="flex flex-col items-center gap-2 animate-pop">
                          <div className={`relative w-16 h-16 rounded-full border-2 overflow-hidden ${p.isGroom ? 'border-yellow-500' : 'border-slate-500'} ${p.isBot ? 'border-dashed opacity-70' : ''}`}>
                             {p.photo ? <img src={p.photo} className="w-full h-full object-cover" alt={p.name} /> : <div className={`w-full h-full flex items-center justify-center ${p.isGroom ? 'bg-yellow-900/50' : 'bg-slate-700'}`}>{p.isGroom ? <Crown className="w-8 h-8 text-yellow-400" /> : <User className="w-8 h-8 text-slate-400" />}</div>}
                          </div>
                          <span className={`text-sm font-medium ${p.isGroom ? 'text-yellow-400' : 'text-slate-300'}`}>{p.name}</span>
                          {p.isBot && <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded-full text-slate-400 uppercase">Bot</span>}
                        </div>
                      ))}
                      {gameState.players.length === 0 && <span className="text-slate-500 italic w-full">ממתין להצטרפות...</span>}
                   </div>
                </div>

                {gameState.isHost ? (
                    <div className="flex flex-col items-center gap-4">
                        <button onClick={handleStartRound} disabled={gameState.players.length === 0} className="w-full md:w-auto bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-12 rounded-full text-xl disabled:opacity-50 transition-all transform hover:scale-105 shadow-xl">התחל את המשחק!</button>
                        <button onClick={addBots} className="text-slate-500 hover:text-white text-sm flex items-center gap-2 hover:bg-white/5 px-4 py-2 rounded-full transition-colors border border-transparent hover:border-slate-600">
                            <Bot className="w-4 h-4" /> הוסף בוט לבדיקה
                        </button>
                    </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-4 animate-pulse mt-8">
                     {(connectionStatus === 'connected' || connectionStatus === 'connecting') ? (
                        <>
                            <div className="bg-blue-900/20 text-blue-300 py-3 px-6 rounded-full inline-flex items-center gap-3">
                                <Loader2 className="w-6 h-6 animate-spin" />
                                <span className="text-lg font-bold">מחכים למארח שיתחיל את המשחק...</span>
                            </div>
                            <p className="text-slate-500 text-sm">בינתיים אפשר לשתות משהו 🍺</p>
                        </>
                     ) : (
                        <div className="flex flex-col items-center gap-2">
                             <div className="text-red-400 font-bold mb-2">הקשר נותק או לא נוצר</div>
                             <button 
                                onClick={() => setGameState(prev => ({ ...prev, stage: GameStage.SETUP }))}
                                className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-full flex items-center gap-2"
                             >
                                 <LogOut className="w-4 h-4" /> חזור למסך הכניסה
                             </button>
                        </div>
                     )}
                  </div>
                )}
             </div>
          )}

          {gameState.stage === GameStage.PLAYING && (
            gameState.isHost || isCurrentPlayerGroom ? (
              <GamePhase
                gameState={gameState}
                onUpdateState={handleHostUpdateState}
                onGameEnd={handleGameEnd}
              />
            ) : (
              <PlayerMobileView
                gameState={gameState}
                playerId={myPlayerId}
                onVote={(vote) => sendMessageToHost({ type: 'VOTE', payload: { playerId: myPlayerId, vote } })}
                onGroomAnswer={(answer) => sendMessageToHost({ type: 'GROOM_ANSWER', payload: { answer } })}
                onSelectVictim={(victimId) => sendMessageToHost({ type: 'GROOM_SELECT_VICTIM', payload: { victimId } })}
              />
            )
          )}

          {gameState.stage === GameStage.SUMMARY && (
             <SummaryPhase 
               players={gameState.players}
               groomCorrectCount={gameState.groomCorrectCount}
               totalQuestions={gameState.questions.length}
               onRestart={handleRestart}
             />
          )}

        </main>
      </div>
    </div>
  );
};

export default App;