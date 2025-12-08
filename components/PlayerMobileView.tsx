
import React, { useState, useEffect } from 'react';
import { GameState, Player } from '../types';
import { ThumbsUp, ThumbsDown, Wine, PartyPopper, Hourglass, Users, Crown, User, Sword, Send } from 'lucide-react';
import confetti from 'canvas-confetti';

interface PlayerMobileViewProps {
  gameState: GameState;
  playerId: string;
  onVote: (vote: boolean) => void;
  onGroomAnswer?: (answer: string) => void;
}

const PlayerMobileView: React.FC<PlayerMobileViewProps> = ({ gameState, playerId, onVote, onGroomAnswer }) => {
  const [showPlayers, setShowPlayers] = useState(false);
  const [localVote, setLocalVote] = useState<boolean | null>(null);
  const [showVoteConfirm, setShowVoteConfirm] = useState(false);
  const [groomInput, setGroomInput] = useState('');
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  
  const me = gameState.players.find(p => p.id === playerId);
  const isGroom = me?.isGroom;

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
  }, [gameState.roundPhase]);

  // Trigger confetti
  useEffect(() => {
    // Confetti for Players if they are safe
    if (gameState.roundPhase === 'CONSEQUENCE' && !isGroom && !roundLoser) {
       confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
    // Confetti for Groom if he is right
    if ((gameState.roundPhase === 'JUDGMENT' || gameState.roundPhase === 'CONSEQUENCE') && isGroom && groomWon) {
       confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 }, colors: ['#fbbf24', '#f59e0b'] }); // Gold confetti
    }
  }, [gameState.roundPhase, roundLoser, isGroom, groomWon]);

  const handleVote = (vote: boolean) => {
    if (hasVoted) return; // Already voted
    
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
          onGroomAnswer(groomInput);
          setAnswerSubmitted(true);
      }
  };

  const getPlayerStatus = (p: Player) => {
      if (p.isGroom) return 'החתן';
      if (gameState.roundPhase === 'VOTING') {
          return gameState.currentVotes[p.id] !== undefined ? 'הצביע' : 'חושב...';
      }
      if (gameState.roundPhase === 'JUDGMENT' || gameState.roundPhase === 'CONSEQUENCE' || gameState.roundPhase === 'MISSION_EXECUTION') {
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

  if (!me) return <div className="p-4 text-center">טוען...</div>;

  return (
    <div className={`min-h-screen ${isGroom ? 'bg-slate-900 border-x-4 border-yellow-600/30' : 'bg-slate-900'} text-white flex flex-col p-4`}>
      {/* Header */}
      <div className={`flex justify-between items-center mb-6 p-3 rounded-xl border shadow-lg relative z-20 ${isGroom ? 'bg-gradient-to-r from-slate-800 to-slate-900 border-yellow-500/50' : 'bg-slate-800 border-slate-700'}`}>
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
        overflow-hidden transition-all duration-300 ease-in-out bg-slate-800 rounded-xl border border-slate-700 mb-4
        ${showPlayers ? 'max-h-64 opacity-100 shadow-xl' : 'max-h-0 opacity-0 border-0'}
      `}>
          <div className="p-3 space-y-2 overflow-y-auto max-h-64 custom-scrollbar">
              <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">משתתפים ({gameState.players.length})</div>
              {gameState.players.filter(p => p.id !== playerId).map(p => {
                  const status = getPlayerStatus(p);
                  const playerVote = gameState.currentVotes[p.id];
                  
                  return (
                    <div key={p.id} className="flex justify-between items-center bg-slate-900/50 p-2 rounded-lg">
                        <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-700">
                                {p.photo ? (
                                    <img src={p.photo} alt={p.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <User className="w-4 h-4 text-slate-400" />
                                    </div>
                                )}
                            </div>
                            {p.isGroom && <Crown className="w-3 h-3 text-yellow-500" />}
                            <span className="text-sm">{p.name}</span>
                            
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

      <div className="flex-grow flex flex-col justify-center relative z-10">
        
        {/* GROOM VIEW - SPECIFIC */}
        {isGroom ? (
            <div className="space-y-8 text-center">
                {gameState.roundPhase === 'QUESTION' && (
                    <div className="animate-fade-in">
                        <div className="text-6xl mb-4">🤫</div>
                        <h2 className="text-2xl font-bold text-yellow-400 mb-2">הקשב לשאלה!</h2>
                        <p className="text-slate-400">תכף תצטרך לענות...</p>
                    </div>
                )}
                 {gameState.roundPhase === 'GROOM_ANSWERING' && (
                    <div className="animate-pulse w-full max-w-sm mx-auto">
                        <div className="text-6xl mb-4">🎤</div>
                        <h2 className="text-2xl font-bold text-yellow-400 mb-2">מה התשובה שלך?</h2>
                        <p className="text-slate-400 mb-6">הסבר לחברים וכתוב בקצרה:</p>
                        
                        {!answerSubmitted ? (
                            <div className="flex flex-col gap-3">
                                <input 
                                    type="text" 
                                    value={groomInput}
                                    onChange={(e) => setGroomInput(e.target.value)}
                                    placeholder="הקלד תשובה כאן..."
                                    className="w-full p-4 rounded-xl bg-slate-800 border border-slate-600 text-white focus:outline-none focus:border-yellow-500 text-center text-lg"
                                />
                                <button 
                                    onClick={handleGroomSubmit}
                                    disabled={!groomInput.trim()}
                                    className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <Send className="w-5 h-5" />
                                    שלח תשובה
                                </button>
                            </div>
                        ) : (
                            <div className="bg-yellow-500/20 border border-yellow-500 p-4 rounded-xl animate-pop">
                                <p className="text-yellow-200 font-bold mb-1">התשובה נשלחה!</p>
                                <p className="text-xl text-white">"{groomInput}"</p>
                                <p className="text-xs text-slate-400 mt-2">המתן להצבעת החברים...</p>
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
                 {(gameState.roundPhase === 'REVEAL' || gameState.roundPhase === 'JUDGMENT' || gameState.roundPhase === 'CONSEQUENCE') && (
                    <div className="animate-pop">
                        <h2 className="text-3xl font-black text-white mb-6">
                            {gameState.groomResult === true ? 'צדקת בענק!' : gameState.groomResult === false ? 'טעית...' : 'התשובה נחשפת'}
                        </h2>
                        
                        {gameState.groomResult === false && (
                            <div className="bg-red-900/20 border-2 border-red-500 p-8 rounded-3xl relative overflow-hidden animate-shake">
                                <Wine className="w-24 h-24 text-red-500 mx-auto mb-4" />
                                <h3 className="text-2xl font-bold text-red-200">תשתה משהו!</h3>
                            </div>
                        )}
                        
                        {gameState.groomResult === true && (
                            <div className="bg-green-900/20 border-2 border-green-500 p-8 rounded-3xl relative overflow-hidden">
                                <Crown className="w-24 h-24 text-yellow-400 mx-auto mb-4 animate-bounce" />
                                <h3 className="text-2xl font-bold text-green-200">מלך!</h3>
                            </div>
                        )}
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
            <>
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
                <div className="text-center space-y-6">
                    <div className="bg-slate-800/50 p-8 rounded-full inline-block">
                        <Crown className="w-16 h-16 text-yellow-400 animate-pulse" />
                    </div>
                    <h2 className="text-2xl font-bold text-yellow-400">החתן מדבר...</h2>
                    <p className="text-slate-400">תכף תצביע אם הוא צודק</p>
                </div>
                )}

                {gameState.roundPhase === 'VOTING' && (
                <div className="space-y-6 animate-fade-in">
                    <h2 className="text-2xl font-bold text-center mb-4">האם החתן צדק?</h2>
                    
                    <button 
                    onClick={() => handleVote(true)}
                    disabled={hasVoted}
                    className={`relative w-full p-6 rounded-2xl flex items-center justify-center gap-4 transition-all duration-300 transform overflow-hidden 
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
                    <ThumbsUp className={`w-8 h-8 relative z-10 transition-transform duration-300 ${myVote === true ? 'animate-bounce scale-125' : ''}`} />
                    <span className="text-xl font-bold relative z-10">כן! הוא יודע!</span>
                    </button>

                    <button 
                    onClick={() => handleVote(false)}
                    disabled={hasVoted}
                    className={`relative w-full p-6 rounded-2xl flex items-center justify-center gap-4 transition-all duration-300 transform overflow-hidden 
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
                    <ThumbsDown className={`w-8 h-8 relative z-10 transition-transform duration-300 ${myVote === false ? 'animate-bounce scale-125' : ''}`} />
                    <span className="text-xl font-bold relative z-10">אין לו מושג...</span>
                    </button>

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

                {(gameState.roundPhase === 'JUDGMENT' || gameState.roundPhase === 'CONSEQUENCE') && (
                <div className="text-center animate-pop">
                    {roundLoser ? (
                    <div className="bg-red-900/20 border-2 border-red-500 p-8 rounded-3xl relative overflow-hidden">
                        <div className="absolute inset-0 bg-red-500/10 animate-pulse"></div>
                        <Wine className="w-24 h-24 text-red-500 mx-auto mb-4" />
                        <h2 className="text-4xl font-black text-white mb-2">שתה!</h2>
                        <p className="text-red-300 text-xl">טעית בהימור</p>
                        {gameState.activeMission && gameState.roundPhase === 'CONSEQUENCE' && (
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
                                <h2 className="text-2xl font-bold text-white mb-2">תהנה מההצגה</h2>
                                <p className="text-blue-300">תצחק על החתן והמפסידים</p>
                            </div>
                        )}
                     </div>
                )}
            </>
        )}
      </div>
    </div>
  );
};

export default PlayerMobileView;
