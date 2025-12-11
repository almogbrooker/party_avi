import React, { useState, useEffect } from 'react';
import { GameState, Player } from '../types';
import { ThumbsUp, ThumbsDown, Wine, PartyPopper, Hourglass, Users, Crown, User, Sword, Send, PauseCircle, Hand } from 'lucide-react';
import confetti from 'canvas-confetti';

interface PlayerMobileViewProps {
  gameState: GameState;
  playerId: string;
  onVote: (vote: boolean) => void;
  onGroomAnswer?: (answer: string) => void;
  onSelectVictim?: (victimId: string) => void;
}

const PlayerMobileView: React.FC<PlayerMobileViewProps> = ({ gameState, playerId, onVote, onGroomAnswer, onSelectVictim }) => {
  const [showPlayers, setShowPlayers] = useState(false);
  const [localVote, setLocalVote] = useState<boolean | null>(null);
  const [showVoteConfirm, setShowVoteConfirm] = useState(false);
  const [groomInput, setGroomInput] = useState('');
  const [answerSubmitted, setAnswerSubmitted] = useState(false);

  // Flashing State for Drama
  const [isFlashing, setIsFlashing] = useState(false);

  const me = gameState.players.find(p => p.id === playerId);
  const isGroom = me?.isGroom;

  // Debug logs
  console.log('📱 PlayerMobileView:', {
    stage: gameState.stage,
    roundPhase: gameState.roundPhase,
    playerId: playerId,
    playerName: me?.name || 'NOT FOUND',
    isGroom,
    isHost: gameState.isHost,
    playersCount: gameState.players.length,
    currentQuestionIndex: gameState.currentQuestionIndex,
    hasCurrentQuestion: !!gameState.currentQuestion,
    groomAnswer: gameState.groomAnswer ? '[SET]' : '[NOT SET]',
    answerSubmitted,
    localVote,
    currentVotes: Object.keys(gameState.currentVotes || {}),
    roundLosers: gameState.roundLosers,
    selectedVictim: gameState.selectedVictimId
  });

  // Alert if groom is detected
  if (isGroom) {
    console.warn('🔥 GROOM DETECTED! Round phase:', gameState.roundPhase);
    console.warn('🔥 Should show answering interface for phase GROOM_ANSWERING');
  }

  
  // Focus input when groom needs to answer
  useEffect(() => {
    if (isGroom && gameState.roundPhase === 'GROOM_ANSWERING' && !answerSubmitted) {
      const timer = setTimeout(() => {
        const input = document.querySelector('input[placeholder="הקלד תשובה כאן..."]') as HTMLInputElement;
        if (input) {
          input.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [gameState.roundPhase, isGroom, answerSubmitted]);

  // We prefer the server state, but fall back to local for immediate feedback
  const serverVote = gameState.currentVotes[playerId];
  const myVote = serverVote !== undefined ? serverVote : (localVote !== null ? localVote : undefined);
  const hasVoted = myVote !== undefined;
  
  // Is this player in the loser list for this round?
  const roundLoser = gameState.roundLosers.includes(playerId);
  // Groom "wins" if he is right (groomResult is true)
  const groomWon = gameState.groomResult === true;

  // Reset local vote and groom input when phase changes
  useEffect(() => {
    if (gameState.roundPhase !== 'VOTING') {
      setLocalVote(null);
      setShowVoteConfirm(false);
    }
    if (gameState.roundPhase !== 'GROOM_ANSWERING') {
        setGroomInput('');
        setAnswerSubmitted(false);
    }
    
    // Reset flashing
    setIsFlashing(false);

  }, [gameState.roundPhase]);

  // Trigger confetti or vibrate
  useEffect(() => {
    // Confetti for Players if they are safe
    if (gameState.roundPhase === 'CONSEQUENCE' && !isGroom && !roundLoser) {
       confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
    // Confetti for Groom if he is right
    if (gameState.roundPhase === 'CONSEQUENCE' && isGroom && groomWon) {
       confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 }, colors: ['#fbbf24', '#f59e0b'] }); // Gold confetti
    }
    
    // RED SCREEN FLASH / VIBRATE FOR VICTIM
    if (gameState.roundPhase === 'VICTIM_REVEAL' && gameState.selectedVictimId === playerId) {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);
    }

    // FLASHING FOR LOSERS WHO ARE NOT YET REVEALED
    // If I am a loser, and it's VICTIM_REVEAL, and I am NOT the victim: Flash for drama
    // (This simulates the roulette "passing over" them)
    if (gameState.roundPhase === 'VICTIM_REVEAL' && roundLoser && gameState.selectedVictimId !== playerId) {
        // Flash for 2 seconds then stop
        setIsFlashing(true);
        const timer = setTimeout(() => setIsFlashing(false), 2500);
        return () => clearTimeout(timer);
    }

  }, [gameState.roundPhase, roundLoser, isGroom, groomWon, gameState.selectedVictimId, playerId]);

  const handleVote = (vote: boolean) => {
    if (hasVoted) return; // Already voted

    console.log('🗳️ Player voting:', {
      playerId,
      playerName: me?.name,
      vote: vote ? 'AGREE' : 'DISAGREE',
      hasVoted: hasVoted
    });

    setLocalVote(vote);
    onVote(vote);
    setShowVoteConfirm(true);

    // Haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  const handleGroomSubmit = () => {
      if (groomInput.trim() && onGroomAnswer) {
          console.log('💒 Groom submitting answer:', {
            playerId,
            playerName: me?.name,
            answer: groomInput.trim(),
            questionIndex: gameState.currentQuestionIndex
          });

          onGroomAnswer(groomInput);
          setAnswerSubmitted(true);
      }
  };

  const getPlayerStatus = (p: Player) => {
      if (p.isGroom) return 'החתן';
      if (gameState.roundPhase === 'VOTING') {
          return gameState.currentVotes[p.id] !== undefined ? 'הצביע' : 'חושב...';
      }
      if (gameState.roundPhase === 'JUDGMENT' || gameState.roundPhase === 'CONSEQUENCE' || gameState.roundPhase === 'VICTIM_SELECTION' || gameState.roundPhase === 'VICTIM_REVEAL' || gameState.roundPhase === 'MISSION_EXECUTION') {
          return gameState.roundLosers.includes(p.id) ? 'שותה!' : 'ניצל';
      }
      return 'ממתין';
  };

  const getStatusColor = (status: string) => {
      if (status === 'הצביע') return 'text-green-400';
      if (status === 'חושב...') return 'text-yellow-400';
      if (status === 'שותה!') return 'text-red-500 font-bold';
      if (status === 'ניצל') return 'text-green-400';
      if (status === 'החתן') return 'text-yellow-500 font-bold';
      return 'text-slate-400';
  };

  if (!me) return <div className="p-4 text-center">טוען... (נסה לרענן אם נתקע)</div>;

  // Show waiting screen if still in lobby
  if (gameState.stage === 'LOBBY') {
    return (
      <div className="min-h-[100dvh] w-full bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-6 animate-pulse">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-700 border-4 border-yellow-500/50 mx-auto">
            {me.photo ? (
              <img src={me.photo} alt="You" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {isGroom ? <Crown className="w-12 h-12 text-yellow-400" /> : <User className="w-12 h-12 text-slate-400" />}
              </div>
            )}
          </div>
          <h2 className="text-3xl font-bold">
            {isGroom ? 'החתן' : 'שחקן'}: {me.name}
          </h2>
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
            <h3 className="text-xl font-bold text-yellow-400 mb-2">מחכה להתחלת המשחק...</h3>
            <p className="text-slate-400">המארח יתחיל את המשחק בקרוב</p>
            {isGroom && <p className="text-yellow-500 mt-2">אל תשכח לענות על השאלות! 😉</p>}
          </div>
          <div className="text-slate-500 text-sm">
            קוד המשחק: {gameState.gameCode}
          </div>
        </div>
      </div>
    );
  }

  // RED SCREEN EFFECT FOR VICTIM (IMMEDIATE)
  if (gameState.roundPhase === 'VICTIM_REVEAL' && gameState.selectedVictimId === playerId) {
      return (
          <div className="fixed inset-0 bg-red-600 flex flex-col items-center justify-center text-center p-6 animate-[pulse_0.1s_ease-in-out_infinite] z-50">
              <Sword className="w-32 h-32 text-black mb-8 animate-bounce" />
              <h1 className="text-6xl font-black text-black mb-4">זה אתה!</h1>
              <p className="text-2xl font-bold text-white">נבחרת לבצע את המשימה!</p>
              <div className="mt-8 text-black font-mono text-sm">בהצלחה...</div>
          </div>
      );
  }

  // SAFE MESSAGE FOR NON-VICTIMS DURING VICTIM_REVEAL
  if (gameState.roundPhase === 'VICTIM_REVEAL' && gameState.selectedVictimId !== playerId && gameState.roundLosers.includes(playerId)) {
      return (
          <div className="fixed inset-0 bg-green-600 flex flex-col items-center justify-center text-center p-6 z-50">
              <PartyPopper className="w-32 h-32 text-white mb-8 animate-bounce" />
              <h1 className="text-6xl font-black text-white mb-4">הצלחת!</h1>
              <p className="text-3xl font-bold text-white">ניצלת הפעם</p>
              <div className="mt-4 text-xl text-white">יש לך לחיות עוד יום...</div>
          </div>
      );
  }

  // FLASHING DRAMA EFFECT FOR OTHER LOSERS
  if (isFlashing) {
      return (
          <div className="fixed inset-0 z-50 flex items-center justify-center animate-[pulse_0.1s_ease-in-out_infinite] bg-white">
              <div className="text-center">
                   <h1 className="text-6xl font-black text-black">???</h1>
                   <p className="text-2xl font-bold text-black mt-4">מי נבחר?!</p>
              </div>
          </div>
      );
  }

  return (
    <div className={`min-h-[100dvh] w-full ${isGroom ? 'bg-slate-900 border-x-4 border-yellow-600/30' : 'bg-slate-900'} text-white flex flex-col p-4`}>
      
      {/* PAUSE OVERLAY FOR PLAYERS */}
      {gameState.isPaused && (
          <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
               <PauseCircle className="w-20 h-20 text-orange-500 mb-6 animate-pulse" />
               <h2 className="text-3xl font-black text-white mb-2">הפסקה!</h2>
               <p className="text-slate-400">המשחק נעצר כרגע.<br/>נחזור לשחק בקרוב...</p>
          </div>
      )}

      {/* Header */}
      <div className={`flex justify-between items-center mb-6 p-3 rounded-xl border shadow-lg relative z-20 shrink-0 ${isGroom ? 'bg-gradient-to-r from-slate-800 to-slate-900 border-yellow-500/50' : 'bg-slate-800 border-slate-700'}`}>
        <div className="flex items-center gap-3">
          {/* My Avatar */}
          <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-700 border border-slate-600">
             {me.photo ? (
                 <img src={me.photo} alt="Me" className="w-full h-full object-cover" />
             ) : (
                 <div className="w-full h-full flex items-center justify-center">
                     <User className="w-5 h-5 text-slate-400" />
                 </div>
             )}
          </div>
          <div>
            <div className="font-bold text-lg flex items-center gap-2">
                {isGroom && <Crown className="w-5 h-5 text-yellow-400 animate-pulse" />}
                {me.name}
                <span className="text-xs font-normal text-slate-400 bg-slate-700 px-2 py-0.5 rounded-full">אני</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">ניקוד: {me.score}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border ${me.drinks > 0 ? 'bg-red-900/30 border-red-500/30' : 'bg-slate-700/30 border-slate-600'}`}>
              <Wine className={`w-4 h-4 ${me.drinks > 0 ? 'text-red-400' : 'text-slate-500'}`} />
              <span className={`font-bold ${me.drinks > 0 ? 'text-red-400' : 'text-slate-400'}`}>{me.drinks}</span>
            </div>
            
            <button 
                onClick={() => setShowPlayers(!showPlayers)}
                className={`p-2 rounded-lg transition-colors ${showPlayers ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
                <Users className="w-5 h-5" />
            </button>
        </div>
      </div>

      {/* Collapsible Players List */}
      <div className={`
        overflow-hidden transition-all duration-300 ease-in-out bg-slate-800 rounded-xl border border-slate-700 mb-4 shrink-0
        ${showPlayers ? 'max-h-[60vh] opacity-100 shadow-xl' : 'max-h-0 opacity-0 border-0'}
      `}>
          <div className="p-3 space-y-2 overflow-y-auto max-h-[60vh] custom-scrollbar">
              <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">משתתפים ({gameState.players.length})</div>
              {gameState.players.filter(p => p.id !== playerId).map(p => {
                  const status = getPlayerStatus(p);
                  const playerVote = gameState.currentVotes[p.id];
                  
                  return (
                    <div key={p.id} className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg">
                        <div className="flex items-center gap-3">
                             <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-700 border border-slate-600">
                                {p.photo ? (
                                    <img src={p.photo} alt={p.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <User className="w-6 h-6 text-slate-400" />
                                    </div>
                                )}
                            </div>
                            {p.isGroom && <Crown className="w-4 h-4 text-yellow-500" />}
                            <span className="text-sm font-medium">{p.name}</span>
                            
                            {/* Vote Indicator */}
                            {playerVote !== undefined && !p.isGroom && gameState.roundPhase === 'VOTING' && (
                                <div className={`p-0.5 rounded-full animate-pop ${playerVote ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                    {playerVote ? (
                                        <ThumbsUp className="w-3 h-3 text-green-400" />
                                    ) : (
                                        <ThumbsDown className="w-3 h-3 text-red-400" />
                                    )}
                                </div>
                            )}
                        </div>
                        <span className={`text-xs ${getStatusColor(status)}`}>{status}</span>
                    </div>
                  );
              })}
          </div>
      </div>

      <div className="flex-grow flex flex-col justify-start relative z-10 w-full max-w-lg mx-auto overflow-y-auto pb-10 gap-6">

        {/* Global drink break banner */}
        {gameState.roundPhase === 'DRINK_BREAK' && (
            <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6 text-center animate-pop">
                <div className="text-7xl mb-4">🍻</div>
                <h2 className="text-4xl font-black text-white mb-2">כולם שותים עכשיו!</h2>
                <p className="text-slate-300 text-lg">לחיי החתן! חכו להנחיה של המארח להמשיך.</p>
            </div>
        )}
        
        {/* GROOM VIEW - SPECIFIC */}
        {isGroom ? (
            <div className="space-y-8 text-center w-full">
                {gameState.roundPhase === 'QUESTION' && (
                    <div className="animate-fade-in">
                        <div className="text-6xl mb-4">🤫</div>
                        <h2 className="text-2xl font-bold text-yellow-400 mb-2">הקשב לשאלה!</h2>
                        <p className="text-slate-400">תכף תצטרך לענות...</p>
                    </div>
                )}
                 {gameState.roundPhase === 'GROOM_ANSWERING' && (
                    <div key={`groom-answering-${gameState.currentQuestionIndex}`} className="w-full flex flex-col items-center">
                        <div className="text-6xl mb-4">🎤</div>
                        <h2 className="text-2xl font-bold text-yellow-400 mb-2">מה התשובה שלך?</h2>

                        {/* Show the current question */}
                        {gameState.questions && gameState.questions[gameState.currentQuestionIndex] && (
                            <div className="w-full bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-4">
                                <p className="text-xs text-slate-500 mb-1 text-center">השאלה:</p>
                                <p className="text-white text-lg text-center font-medium">
                                    {gameState.questions[gameState.currentQuestionIndex].question}
                                </p>
                            </div>
                        )}

                        <p className="text-slate-400 mb-4">כתוב את תשובתך:</p>
                        
                        {!answerSubmitted ? (
                            <div className="flex flex-col gap-3 w-full">
                                <textarea
                                    value={groomInput}
                                    onChange={(e) => setGroomInput(e.target.value)}
                                    placeholder="הקלד תשובה כאן..."
                                    className="w-full p-4 rounded-xl bg-slate-800 border border-slate-600 text-white focus:outline-none focus:border-yellow-500 text-center text-lg min-h-[100px] resize-none"
                                    autoFocus
                                    dir="rtl"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && e.ctrlKey) {
                                            handleGroomSubmit();
                                        }
                                    }}
                                />
                                <button 
                                    onClick={handleGroomSubmit}
                                    disabled={!groomInput.trim()}
                                    className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg active:scale-95 transition-transform"
                                >
                                    <Send className="w-5 h-5" />
                                    שלח תשובה
                                </button>
                                <p className="text-xs text-slate-500 text-center mt-2">
                                    {groomInput.length} תווים • Ctrl+Enter לשלוח מהר
                                </p>
                            </div>
                        ) : (
                            <div className="bg-yellow-500/20 border border-yellow-500 p-6 rounded-xl animate-pop w-full">
                                <p className="text-yellow-200 font-bold mb-2 text-lg">✓ התשובה נשלחה!</p>
                                <p className="text-xl text-white font-bold text-center">"{groomInput}"</p>
                                <p className="text-xs text-slate-400 mt-4 text-center">המתן להצבעת החברים...</p>
                            </div>
                        )}
                    </div>
                )}
                 {gameState.roundPhase === 'VOTING' && (
                    <div className="animate-pulse">
                        <div className="text-6xl mb-4">🗳️</div>
                        <h2 className="text-2xl font-bold text-blue-400 mb-2">החברים מצביעים עליך...</h2>
                        <p className="text-slate-400">האם הם מאמינים בך?</p>
                        <div className="mt-8 flex justify-center gap-8 text-slate-600">
                             <div className="flex flex-col items-center">
                                 <ThumbsUp className="w-8 h-8" />
                                 <span>בעד</span>
                             </div>
                             <div className="flex flex-col items-center">
                                 <ThumbsDown className="w-8 h-8" />
                                 <span>נגד</span>
                             </div>
                        </div>
                    </div>
                )}
                {gameState.roundPhase === 'JUDGMENT' && (
                    <div className="animate-pulse space-y-6">
                        <div className="text-6xl mb-4">⚖️</div>
                        <h2 className="text-2xl font-bold text-yellow-400 mb-2">מחכה להכרעת המארח...</h2>
                        <p className="text-slate-400">האם תשובתך נכונה?</p>
                        {groomInput && (
                            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                <p className="text-xs text-slate-500 mb-2 text-center">התשובה שלך:</p>
                                <p className="text-white text-lg text-center font-bold">"{groomInput}"</p>
                            </div>
                        )}
                    </div>
                )}
                 {gameState.roundPhase === 'CONSEQUENCE' && (
                    <div className="animate-pop">
                        {roundLoser ? (
                        <div className="bg-red-900/20 border-2 border-red-500 p-8 rounded-3xl relative overflow-hidden">
                            <div className="absolute inset-0 bg-red-500/10 animate-pulse"></div>
                            <Wine className="w-24 h-24 text-red-500 mx-auto mb-4" />
                            <h2 className="text-4xl font-black text-white mb-2">שתה!</h2>
                            <p className="text-red-300 text-xl">טעית בהימור</p>
                            {gameState.activeMission && (
                                <div className="mt-6 pt-6 border-t border-red-500/30">
                                <p className="text-sm text-slate-400 mb-2">משימת עונש ללוזרים:</p>
                                <p className="text-lg font-bold text-white bg-black/40 p-4 rounded-xl">
                                    {gameState.activeMission.text}
                                </p>
                                </div>
                            )}
                        </div>
                        ) : (
                        <div className="bg-green-900/20 border-2 border-green-500 p-8 rounded-3xl">
                            <PartyPopper className="w-24 h-24 text-green-500 mx-auto mb-4 animate-bounce" />
                            <h2 className="text-4xl font-black text-white mb-2">צדקת!</h2>
                            <p className="text-green-300 text-xl">ניצלת מצ'ייסר</p>
                        </div>
                        )}
                    </div>
                )}

                {/* GROOM SELECTION MODE */}
                {gameState.roundPhase === 'VICTIM_SELECTION' && (
                    <div className="animate-fade-in space-y-6">
                        {/* Show groom result first if it was just revealed */}
                        {gameState.groomResult !== undefined && !gameState.selectedVictimId && (
                            <div className="animate-pop mb-4">
                                {gameState.groomResult ? (
                                    <div className="bg-green-900/30 border-2 border-green-500 p-6 rounded-3xl relative overflow-hidden">
                                        <div className="absolute inset-0 bg-green-500/10 animate-pulse"></div>
                                        <PartyPopper className="w-20 h-20 text-green-500 mx-auto mb-3 animate-bounce" />
                                        <h2 className="text-3xl font-black text-white mb-2">צדקת!</h2>
                                        <p className="text-green-300 text-lg">התשובה שלך הייתה נכונה</p>
                                        {groomInput && (
                                            <div className="mt-4 p-3 bg-black/30 rounded-xl">
                                                <p className="text-xs text-green-400 mb-1">התשובה שלך:</p>
                                                <p className="text-white text-sm font-bold">"{groomInput}"</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-red-900/30 border-2 border-red-500 p-6 rounded-3xl relative overflow-hidden">
                                        <div className="absolute inset-0 bg-red-500/10 animate-pulse"></div>
                                        <Wine className="w-20 h-20 text-red-500 mx-auto mb-3" />
                                        <h2 className="text-3xl font-black text-white mb-2">טעית...</h2>
                                        <p className="text-red-300 text-lg">התשובה שלך לא הייתה נכונה</p>
                                        {groomInput && (
                                            <div className="mt-4 p-3 bg-black/30 rounded-xl">
                                                <p className="text-xs text-red-400 mb-1">התשובה שלך:</p>
                                                <p className="text-white text-sm font-bold">"{groomInput}"</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                         <div className="text-center">
                            <Hand className="w-16 h-16 text-red-500 mx-auto mb-2 animate-bounce" />
                            <h2 className="text-2xl font-bold text-white">בחר קורבן</h2>
                            <p className="text-slate-400">מי יבצע את המשימה איתך?</p>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
                             {gameState.roundLosers.map(loserId => {
                                 const p = gameState.players.find(pl => pl.id === loserId);
                                 if (!p) return null;
                                 const isAlreadyVictim = gameState.pastVictims.includes(loserId);
                                 
                                 return (
                                     <button
                                        key={loserId}
                                        onClick={() => onSelectVictim && onSelectVictim(loserId)}
                                        className="bg-slate-800 border-2 border-slate-700 hover:border-red-500 p-4 rounded-xl flex flex-col items-center gap-3 active:scale-95 transition-all"
                                     >
                                         <div className="relative w-20 h-20 rounded-full overflow-hidden bg-slate-700 border-2 border-slate-600">
                                            {p.photo ? <img src={p.photo} className="w-full h-full object-cover" /> : <User className="w-full h-full p-5 text-slate-400"/>}
                                            {isAlreadyVictim && (
                                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                    <span className="text-xs font-bold text-red-400">כבר<br/>נבחר</span>
                                                </div>
                                            )}
                                         </div>
                                         <span className="font-bold text-sm">{p.name}</span>
                                     </button>
                                 )
                             })}
                             {gameState.roundLosers.length === 0 && <p className="col-span-2 text-center text-slate-500">אין לוזרים בסיבוב הזה...</p>}
                         </div>
                    </div>
                )}

                {gameState.roundPhase === 'MISSION_EXECUTION' && (
                    <div className="animate-bounce">
                         <div className="text-6xl mb-4">⚔️</div>
                         <h2 className="text-3xl font-black text-red-500 mb-4">זמן ביצוע!</h2>
                         <p className="text-xl">אתה מבצע את המשימה עם הלוזרים!</p>
                    </div>
                )}
            </div>
        ) : (
            // REGULAR PLAYER VIEW
            <div className="w-full">
                {(gameState.roundPhase === 'QUESTION' || gameState.roundPhase === 'REVEAL') && (
                <div className="text-center space-y-6 animate-pulse">
                    <div className="bg-slate-800/50 p-8 rounded-full inline-block">
                    <Hourglass className="w-16 h-16 text-blue-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-blue-200">הקשב לוידאו...</h2>
                    <p className="text-slate-400">השאלה מוצגת על המסך הראשי</p>
                </div>
                )}
                
                {gameState.roundPhase === 'GROOM_ANSWERING' && (
                <div className="flex flex-col justify-center h-full space-y-6">
                    {gameState.groomAnswer && (
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                            <p className="text-xs text-slate-500 mb-2 text-center">תשובת החתן:</p>
                            <p className="text-white text-xl text-center font-bold">"{gameState.groomAnswer}"</p>
                        </div>
                    )}
                    <div className="text-center space-y-4">
                        <div className="text-6xl animate-pulse">⏳</div>
                        <p className="text-slate-400">ממתין להצבעה...</p>
                    </div>
                </div>
                )}

                {gameState.roundPhase === 'VOTING' && (
                <div className="flex flex-col h-full justify-center space-y-4 p-4">
                    <div className="grid grid-cols-2 gap-4 flex-1">
                        <button
                    onClick={() => handleVote(true)}
                    disabled={hasVoted}
                    className={`relative flex flex-col items-center justify-center p-6 rounded-2xl transition-all duration-300 transform flex-1
                    ${hasVoted ? 'cursor-default' : 'cursor-pointer'}
                    ${
                        myVote === true
                        ? 'bg-green-600 ring-4 ring-green-400 shadow-[0_0_30px_rgba(74,222,128,0.5)] scale-105'
                        : hasVoted
                            ? 'bg-slate-900 opacity-30 grayscale scale-95 pointer-events-none'
                            : 'bg-slate-800 hover:bg-green-600/20 border-2 border-green-500 text-green-400 active:scale-95'
                    }`}
                    >
                    {/* Ripple/Ping Effect */}
                    {myVote === true && (
                        <div className="absolute inset-0 bg-green-400/30 animate-ping rounded-2xl" style={{ animationDuration: '0.6s', animationIterationCount: 1 }}></div>
                    )}
                    <ThumbsUp className={`w-12 h-12 mb-2 transition-transform duration-300 ${myVote === true ? 'animate-bounce scale-125' : ''}`} />
                    <span className="text-2xl font-bold">כן</span>
                    <span className="text-xs opacity-80">הוא צודק!</span>
                    {gameState.groomAnswer && (
                        <div className="mt-3 pt-3 border-t border-green-400/30 w-full">
                            <p className="text-xs text-green-300 text-center leading-tight">"{gameState.groomAnswer.slice(0, 25)}{gameState.groomAnswer.length > 25 ? '...' : ''}"</p>
                        </div>
                    )}
                    </button>

                    <button
                    onClick={() => handleVote(false)}
                    disabled={hasVoted}
                    className={`relative flex flex-col items-center justify-center p-6 rounded-2xl transition-all duration-300 transform flex-1
                    ${hasVoted ? 'cursor-default' : 'cursor-pointer'}
                    ${
                        myVote === false
                        ? 'bg-red-600 ring-4 ring-red-400 shadow-[0_0_30px_rgba(248,113,113,0.5)] scale-105'
                        : hasVoted
                            ? 'bg-slate-900 opacity-30 grayscale scale-95 pointer-events-none'
                            : 'bg-slate-800 hover:bg-red-600/20 border-2 border-red-500 text-red-400 active:scale-95'
                    }`}
                    >
                    {/* Ripple/Ping Effect */}
                    {myVote === false && (
                        <div className="absolute inset-0 bg-red-400/30 animate-ping rounded-2xl" style={{ animationDuration: '0.6s', animationIterationCount: 1 }}></div>
                    )}
                    <ThumbsDown className={`w-12 h-12 mb-2 transition-transform duration-300 ${myVote === false ? 'animate-bounce scale-125' : ''}`} />
                    <span className="text-2xl font-bold">לא</span>
                    <span className="text-xs opacity-80">הוא טועה!</span>
                    {gameState.groomAnswer && (
                        <div className="mt-3 pt-3 border-t border-red-400/30 w-full">
                            <p className="text-xs text-red-300 text-center leading-tight">"{gameState.groomAnswer.slice(0, 25)}{gameState.groomAnswer.length > 25 ? '...' : ''}"</p>
                        </div>
                    )}
                    </button>
                    </div>

                    {showVoteConfirm && (
                    <div className="text-center mt-6 animate-pop">
                        <div className="bg-slate-800/80 backdrop-blur px-6 py-2 rounded-full inline-flex items-center gap-2 border border-slate-600 shadow-xl">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="font-bold text-white">ההצבעה נקלטה!</span>
                        </div>
                    </div>
                    )}
                </div>
                )}

                {gameState.roundPhase === 'VICTIM_SELECTION' && (
                    <div className="text-center p-8 bg-slate-800/50 rounded-3xl animate-pulse">
                        <Users className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-white">החתן בוחר קורבן...</h2>
                        <p className="text-slate-400">מתח...</p>
                    </div>
                )}

                {gameState.roundPhase === 'VICTIM_REVEAL' && gameState.selectedVictimId !== playerId && (
                     <div className="text-center p-8 bg-slate-800 rounded-3xl animate-pop border border-slate-700">
                        {isFlashing ? (
                            <div className="text-yellow-400 animate-pulse">
                                <h2 className="text-3xl font-black mb-2">???</h2>
                                <p>בודק תוצאות...</p>
                            </div>
                        ) : (
                            <>
                                <p className="text-red-300 font-bold mb-4 uppercase">הקורבן הנבחר הוא</p>
                                <h2 className="text-3xl font-black text-white mb-2">{gameState.players.find(p => p.id === gameState.selectedVictimId)?.name}</h2>
                                <div className="text-2xl font-bold text-green-400 mt-4 border-2 border-green-500 p-2 rounded-xl">ניצלת!</div>
                            </>
                        )}
                     </div>
                )}

                {gameState.roundPhase === 'MISSION_EXECUTION' && (
                     <div className="text-center animate-pop">
                        {roundLoser ? (
                            <div className="bg-red-900/20 border-4 border-red-500 p-6 rounded-3xl animate-shake">
                                <Sword className="w-16 h-16 text-red-500 mx-auto mb-4" />
                                <h2 className="text-3xl font-black text-white mb-2">לביצוע!</h2>
                                <p className="text-red-200">קום ותבצע את המשימה עם החתן!</p>
                            </div>
                        ) : (
                            <div className="bg-blue-900/20 border-2 border-blue-500 p-6 rounded-3xl">
                                <PartyPopper className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                                <h2 className="text-2xl font-bold text-white mb-2">תהנה מההצצגה</h2>
                                <p className="text-blue-300">תצחק על החתן והמפסידים</p>
                            </div>
                        )}
                     </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default PlayerMobileView;
