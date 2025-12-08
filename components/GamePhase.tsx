
import React, { useState, useRef, useEffect } from 'react';
import { Player, Mission, QAPair, GameState } from '../types';
import confetti from 'canvas-confetti';
import { Play, Pause, CheckCircle, XCircle, Wine, Skull, ChevronRight, Volume2, VolumeX, Users, Crown, User, Sword, ShieldAlert, Timer, Music, Music2, AlertCircle } from 'lucide-react';

interface GamePhaseProps {
  gameState: GameState;
  onUpdateState: (updates: Partial<GameState>) => void;
  onGameEnd: () => void;
}

const SUSPENSE_MUSIC_URL = "https://assets.mixkit.co/music/preview/mixkit-game-show-suspense-942.mp3";

const GamePhase: React.FC<GamePhaseProps> = ({
  gameState,
  onUpdateState,
  onGameEnd
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  
  // Music State
  const [isMusicOn, setIsMusicOn] = useState(true);
  const musicRef = useRef<HTMLAudioElement | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const currentQ = gameState.questions[gameState.currentQuestionIndex];
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // VIDEO SOURCE MANAGEMENT
  const [currentVideoSrc, setCurrentVideoSrc] = useState<string | null>(null);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
      // Logic to switch video source if the Question changes videoId
      if (currentQ && gameState.videos[currentQ.videoId]) {
          const file = gameState.videos[currentQ.videoId];
          try {
            const url = URL.createObjectURL(file);
            setCurrentVideoSrc(url);
            setVideoError(false);
            // Revoke old URL cleanup
            return () => URL.revokeObjectURL(url);
          } catch (e) {
              console.error("Error creating video URL", e);
              setVideoError(true);
          }
      } else {
          setVideoError(true);
      }
  }, [currentQ.videoId, gameState.videos]); 

  // MUSIC MANAGEMENT
  useEffect(() => {
    // Initialize audio object
    musicRef.current = new Audio(SUSPENSE_MUSIC_URL);
    musicRef.current.loop = true;
    musicRef.current.volume = 0.3;

    return () => {
        if (musicRef.current) {
            musicRef.current.pause();
            musicRef.current.src = "";
        }
    };
  }, []);

  useEffect(() => {
      const isTimerPhase = ['GROOM_ANSWERING', 'VOTING'].includes(gameState.roundPhase);
      
      if (musicRef.current) {
          if (isMusicOn && isTimerPhase) {
              musicRef.current.play().catch(e => console.log("Music play failed", e));
          } else {
              musicRef.current.pause();
              musicRef.current.currentTime = 0;
          }
      }
  }, [gameState.roundPhase, isMusicOn]);

  const toggleMusic = () => {
      setIsMusicOn(!isMusicOn);
  };

  // TIMELINE MANAGEMENT
  useEffect(() => {
    if (!videoRef.current || !currentVideoSrc) return;

    if (gameState.roundPhase === 'QUESTION') {
        // Seek to question start if we are far away
        if (Math.abs(videoRef.current.currentTime - currentQ.qStart) > 1) {
            // Attempt seek only if readyState is sufficient
            if (videoRef.current.readyState >= 1) {
               videoRef.current.currentTime = currentQ.qStart;
            }
        }
    } else if (gameState.roundPhase === 'REVEAL') {
        // Seek to answer start
        if (Math.abs(videoRef.current.currentTime - currentQ.aStart) > 1) {
             if (videoRef.current.readyState >= 1) {
                videoRef.current.currentTime = currentQ.aStart;
                videoRef.current.play().catch(() => {});
                setIsPlaying(true);
             }
        }
    }
  }, [gameState.roundPhase, currentQ, currentVideoSrc]);

  // AUTO PAUSE AT END OF SEGMENT
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      setCurrentTime(t);

      if (gameState.roundPhase === 'QUESTION' && t >= currentQ.qEnd) {
          videoRef.current.pause();
          setIsPlaying(false);
          // Auto transition if needed, but usually we wait for Host to start timer
      }

      if (gameState.roundPhase === 'REVEAL' && t >= currentQ.aEnd) {
          videoRef.current.pause();
          setIsPlaying(false);
      }
    }
  };

  // Timer Logic (Same as before)
  useEffect(() => {
      if (gameState.roundPhase === 'GROOM_ANSWERING' && timeLeft === null) {
          setTimeLeft(60);
      } else if (gameState.roundPhase === 'VOTING' && timeLeft === null) {
          setTimeLeft(20);
      }

      if ((gameState.roundPhase === 'GROOM_ANSWERING' || gameState.roundPhase === 'VOTING') && timeLeft !== null && timeLeft > 0) {
          timerRef.current = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      } else if (timeLeft === 0) {
          if (gameState.roundPhase === 'GROOM_ANSWERING') {
              startVoting();
          } else if (gameState.roundPhase === 'VOTING') {
              handleAutoVoteAndReveal();
          }
      }
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [gameState.roundPhase, timeLeft]);


  const handleLoadedMetadata = () => {
    if (videoRef.current) {
        setDuration(videoRef.current.duration);
        // Initial seek when metadata loaded (for new video source)
        if (gameState.roundPhase === 'QUESTION') {
             videoRef.current.currentTime = currentQ.qStart;
        }
    }
  };

  const toggleVideo = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const startGroomTurn = () => {
      onUpdateState({ roundPhase: 'GROOM_ANSWERING' });
      setTimeLeft(60);
  };

  const startVoting = () => {
    onUpdateState({ roundPhase: 'VOTING' });
    setTimeLeft(20);
  };

  const handleAutoVoteAndReveal = () => {
      const newVotes = { ...gameState.currentVotes };
      const nonHostPlayers = gameState.players.filter(p => !p.isHost && !p.isGroom);
      nonHostPlayers.forEach(p => {
          if (newVotes[p.id] === undefined) newVotes[p.id] = Math.random() < 0.5;
      });
      onUpdateState({ currentVotes: newVotes });
      revealAnswer();
  };

  const revealAnswer = () => {
    onUpdateState({ roundPhase: 'REVEAL' });
    setTimeLeft(null);
  };

  const handleJudgment = (groomCorrect: boolean) => {
    const roundLosers: string[] = [];
    const newPlayers = gameState.players.map(p => {
      if (p.isHost || p.isGroom) return p; 
      const votedYes = gameState.currentVotes[p.id];
      const playerWon = groomCorrect ? (votedYes === true) : (votedYes === false);
      if (playerWon) {
        return { ...p, score: p.score + 10 };
      } else {
        roundLosers.push(p.id);
        return { ...p, drinks: p.drinks + 1 };
      }
    });

    onUpdateState({
      roundPhase: 'JUDGMENT',
      groomResult: groomCorrect,
      groomCorrectCount: groomCorrect ? gameState.groomCorrectCount + 1 : gameState.groomCorrectCount,
      players: newPlayers,
      roundLosers
    });
  };

  const spinMission = () => {
    if (gameState.missions.length === 0) return;
    setIsSpinning(true);
    let spins = 0;
    const interval = setInterval(() => {
      spins++;
      const randomMission = gameState.missions[Math.floor(Math.random() * gameState.missions.length)];
      onUpdateState({ activeMission: randomMission }); 
      if (spins > 15) { 
        clearInterval(interval);
        setIsSpinning(false);
        onUpdateState({ roundPhase: 'MISSION_EXECUTION', activeMission: randomMission });
      }
    }, 100);
  };

  const nextQuestion = () => {
    if (gameState.currentQuestionIndex < gameState.questions.length - 1) {
      onUpdateState({
        currentQuestionIndex: gameState.currentQuestionIndex + 1,
        roundPhase: 'QUESTION',
        currentVotes: {},
        groomResult: null,
        roundLosers: [],
        activeMission: null,
        groomAnswer: null
      });
      if (videoRef.current) videoRef.current.pause();
      setIsPlaying(false);
      setTimeLeft(null);
    } else {
      onGameEnd();
    }
  };

  const getVoteCounts = () => {
     const votes = Object.values(gameState.currentVotes);
     return { yes: votes.filter(v => v === true).length, no: votes.filter(v => v === false).length };
  };

  const getWaitingPlayers = () => {
      return gameState.players.filter(p => !p.isHost && !p.isGroom && gameState.currentVotes[p.id] === undefined);
  };

  const groom = gameState.players.find(p => p.isGroom);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full relative">
      {/* --- MUSIC TOGGLE --- */}
      <button 
        onClick={toggleMusic}
        className={`absolute top-0 left-0 z-40 p-3 rounded-full shadow-lg transition-colors ${isMusicOn ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-400'}`}
        title={isMusicOn ? "השתק מוזיקה" : "הפעל מוזיקה"}
      >
          {isMusicOn ? <Music className="w-6 h-6" /> : <Music2 className="w-6 h-6" />}
      </button>

      {/* --- MISSION ARENA OVERLAY (Same as before) --- */}
      {gameState.roundPhase === 'MISSION_EXECUTION' && gameState.activeMission && (
          <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center animate-fade-in p-8">
              <div className="flex items-center gap-8 mb-8 animate-bounce">
                  <Sword className="w-16 h-16 text-red-500 transform -scale-x-100" />
                  <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-500 to-red-500">VS</h1>
                  <Sword className="w-16 h-16 text-red-500" />
              </div>
              <div className="bg-gradient-to-br from-yellow-600 to-orange-700 p-1 rounded-3xl shadow-[0_0_50px_rgba(234,179,8,0.3)] w-full max-w-4xl transform hover:scale-105 transition-transform duration-500 mb-10">
                  <div className="bg-black/80 rounded-[22px] p-8 text-center border border-yellow-500/30">
                      <h2 className="text-yellow-400 text-xl font-bold uppercase tracking-[0.3em] mb-4">המשימה הנוכחית</h2>
                      <p className="text-4xl md:text-5xl font-black text-white leading-tight">"{gameState.activeMission.text}"</p>
                  </div>
              </div>
              <div className="flex flex-col md:flex-row items-center justify-center gap-12 w-full max-w-5xl">
                  <div className="flex flex-col items-center gap-4 group">
                      <div className="relative">
                          <Crown className="absolute -top-10 left-1/2 -translate-x-1/2 w-12 h-12 text-yellow-400 animate-pulse" />
                          <div className="w-40 h-40 rounded-full border-4 border-yellow-500 overflow-hidden shadow-[0_0_30px_rgba(234,179,8,0.5)] group-hover:scale-110 transition-transform">
                                {groom?.photo ? <img src={groom.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-yellow-900 flex items-center justify-center"><User className="w-20 h-20 text-yellow-200"/></div>}
                          </div>
                      </div>
                      <div className="text-center">
                          <span className="bg-yellow-500 text-black font-bold px-4 py-1 rounded-full text-sm">החתן</span>
                          <h3 className="text-2xl font-bold text-white mt-2">{groom?.name || 'החתן'}</h3>
                      </div>
                  </div>
                  <div className="text-slate-500 font-black text-2xl">מבצעים ביחד עם</div>
                  <div className="flex flex-col items-center gap-4">
                       <div className="flex -space-x-4">
                           {gameState.players.filter(p => gameState.roundLosers.includes(p.id)).map(loser => (
                               <div key={loser.id} className="w-24 h-24 rounded-full border-4 border-red-500 overflow-hidden shadow-lg relative">
                                   {loser.photo ? <img src={loser.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-red-900 flex items-center justify-center"><User className="w-10 h-10 text-red-200"/></div>}
                               </div>
                           ))}
                           {gameState.roundLosers.length === 0 && <div className="text-slate-500 italic">אף אחד! רק החתן סובל!</div>}
                       </div>
                       <div className="text-center">
                          <span className="bg-red-600 text-white font-bold px-4 py-1 rounded-full text-sm">צוות העונש</span>
                       </div>
                  </div>
              </div>
              <div className="mt-16 animate-pulse">
                  <button onClick={nextQuestion} className="bg-green-600 hover:bg-green-500 text-white text-2xl font-black py-4 px-12 rounded-full shadow-[0_0_20px_rgba(34,197,94,0.5)] transform hover:scale-105 transition-all flex items-center gap-3">
                      <CheckCircle className="w-8 h-8" /> המשימה בוצעה! לשאלה הבאה
                  </button>
              </div>
          </div>
      )}

      {/* Left Column: Video & Question */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-purple-600 text-white px-4 py-1 rounded-bl-xl font-bold">
            שאלה {gameState.currentQuestionIndex + 1} מתוך {gameState.questions.length}
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-4">{currentQ.question}</h2>
          
          <div className="flex items-center gap-4">
             {gameState.roundPhase === 'GROOM_ANSWERING' && (
                 <div className="flex-1 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center justify-between">
                    <p className="text-yellow-200 text-lg font-medium flex items-center gap-2"><Crown className="w-5 h-5 animate-bounce" /> {gameState.groomAnswer ? "התשובה התקבלה! ממתין..." : "החתן מסביר וכותב..."}</p>
                 </div>
             )}
             {gameState.roundPhase === 'VOTING' && (
                <div className="flex-1 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-between">
                  <p className="text-blue-200 text-lg animate-pulse font-medium">הקהל מצביע...</p>
                   <div className="flex items-center gap-4 text-slate-300">
                        <div className="flex items-center gap-1 text-green-400"><span className="font-bold">{getVoteCounts().yes}</span><span className="text-xs">בעד</span></div>
                        <div className="flex items-center gap-1 text-red-400"><span className="font-bold">{getVoteCounts().no}</span><span className="text-xs">נגד</span></div>
                   </div>
                </div>
             )}
          </div>

          {(gameState.roundPhase === 'REVEAL' || gameState.roundPhase === 'JUDGMENT' || gameState.roundPhase === 'CONSEQUENCE' || gameState.roundPhase === 'MISSION_EXECUTION') && (
             <div className="mt-4 grid grid-cols-2 gap-4">
                 <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-xl animate-pop">
                    <p className="text-slate-400 text-sm mb-1">התשובה שלה:</p>
                    <p className="text-2xl font-bold text-green-300">{currentQ.answer}</p>
                 </div>
                 <div className="p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl animate-pop">
                    <p className="text-slate-400 text-sm mb-1 flex items-center gap-1"><Crown className="w-3 h-3 text-yellow-500"/> תשובת החתן:</p>
                    <p className="text-2xl font-bold text-yellow-300">{gameState.groomAnswer || "לא התקבלה תשובה"}</p>
                 </div>
             </div>
          )}
        </div>

        {/* Video Player */}
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border border-slate-700 shadow-lg group">
          {videoError ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900">
                  <AlertCircle className="w-12 h-12 mb-2" />
                  <p>שגיאה בטעינת הוידאו</p>
                  <p className="text-xs">ודא שהקובץ הועלה כראוי</p>
              </div>
          ) : currentVideoSrc ? (
            <video 
              ref={videoRef}
              src={currentVideoSrc} 
              className="w-full h-full object-contain"
              playsInline
              muted={isMuted}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white">טוען נגן...</div>
          )}
          
          <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
            <button onClick={toggleVideo} className="p-4 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur-md transition-all transform hover:scale-110">
              {isPlaying ? <Pause className="w-12 h-12 text-white" /> : <Play className="w-12 h-12 text-white ml-1" />}
            </button>
          </div>
          
          <button onClick={() => setIsMuted(!isMuted)} className="absolute bottom-4 left-4 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 z-30">
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>

        {/* Host Controls */}
        <div className="flex justify-center gap-4">
            {gameState.roundPhase === 'QUESTION' && (
              <button onClick={startGroomTurn} className="bg-blue-600 hover:bg-blue-500 text-white text-xl font-bold py-4 px-12 rounded-full shadow-lg flex items-center gap-2">
                <Crown className="w-6 h-6" /> התחל תור חתן (60 שניות)
              </button>
            )}
            {gameState.roundPhase === 'GROOM_ANSWERING' && (
              <button onClick={startVoting} className="bg-yellow-600 hover:bg-yellow-500 text-white text-xl font-bold py-4 px-12 rounded-full shadow-lg">
                סיום הסבר - פתח הצבעה
              </button>
            )}
            {gameState.roundPhase === 'VOTING' && (
              <button onClick={handleAutoVoteAndReveal} className="bg-purple-600 hover:bg-purple-500 text-white text-xl font-bold py-4 px-12 rounded-full shadow-lg">
                חשוף תשובה (סגור הצבעה)
              </button>
            )}
        </div>
      </div>

      {/* Right Column: Status & Timer */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl text-center">
            <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">קוד משחק</p>
            <p className="text-4xl font-mono font-bold text-white tracking-widest">{gameState.gameCode}</p>
        </div>

        {(gameState.roundPhase === 'GROOM_ANSWERING' || gameState.roundPhase === 'VOTING') && timeLeft !== null && (
            <div className="relative aspect-square flex items-center justify-center">
                 <svg className="w-full h-full transform -rotate-90">
                    <circle cx="50%" cy="50%" r="45%" className="stroke-slate-800 fill-none" strokeWidth="10"/>
                    <circle cx="50%" cy="50%" r="45%" className={`fill-none transition-all duration-1000 ease-linear ${timeLeft < 10 ? 'stroke-red-500' : 'stroke-blue-500'}`} strokeWidth="10" strokeDasharray={2 * Math.PI * 45} strokeDashoffset={283 - (283 * (timeLeft / (gameState.roundPhase === 'GROOM_ANSWERING' ? 60 : 20)))} strokeLinecap="round"/>
                 </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center animate-pulse">
                     <span className={`text-6xl font-black ${timeLeft < 10 ? 'text-red-500' : 'text-white'}`}>{timeLeft}</span>
                 </div>
            </div>
        )}

        {gameState.roundPhase === 'VOTING' && (
            <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <h3 className="text-center text-slate-400 text-sm font-bold mb-3 uppercase">ממתין להצבעה</h3>
                <div className="grid grid-cols-4 gap-2">
                    {getWaitingPlayers().map(p => (
                        <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden bg-slate-700 border border-slate-600">
                             {p.photo ? <img src={p.photo} className="w-full h-full object-cover opacity-50" /> : <User className="w-full h-full p-2 text-slate-500"/>}
                             <div className="absolute inset-0 flex items-center justify-center"><span className="text-[10px] font-bold text-white bg-black/50 px-1 rounded truncate max-w-full">{p.name}</span></div>
                        </div>
                    ))}
                    {getWaitingPlayers().length === 0 && <div className="col-span-4 text-center text-green-400 font-bold py-4">כולם הצביעו!</div>}
                </div>
            </div>
        )}

        {gameState.roundPhase === 'REVEAL' && (
           <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 animate-fade-in">
             <h3 className="text-xl font-bold text-slate-200 mb-4 text-center">האם החתן צדק?</h3>
             <div className="flex gap-4">
               <button onClick={() => handleJudgment(true)} className="flex-1 bg-green-600/20 hover:bg-green-600/30 border-2 border-green-500 text-green-400 p-6 rounded-xl flex flex-col items-center gap-2"><CheckCircle className="w-10 h-10" /><span className="font-bold">צדק!</span></button>
               <button onClick={() => handleJudgment(false)} className="flex-1 bg-red-600/20 hover:bg-red-600/30 border-2 border-red-500 text-red-400 p-6 rounded-xl flex flex-col items-center gap-2"><XCircle className="w-10 h-10" /><span className="font-bold">טעה...</span></button>
             </div>
           </div>
        )}

        {(gameState.roundPhase === 'JUDGMENT' || gameState.roundPhase === 'CONSEQUENCE' || gameState.roundPhase === 'MISSION_EXECUTION') && (
          <div className={`border-4 p-6 rounded-3xl shadow-2xl relative overflow-hidden transition-all duration-500 transform ${gameState.groomResult ? 'bg-green-900/40 border-green-500' : 'bg-red-900/40 border-red-500'}`}>
             <div className="text-center mb-6 relative z-10">
                <div className="flex justify-center mb-4">
                     {gameState.groomResult ? <Crown className="w-20 h-20 text-yellow-400 animate-bounce" /> : <Skull className="w-20 h-20 text-red-200 animate-pulse" />}
                </div>
                <h3 className={`text-3xl font-black mb-1 ${gameState.groomResult ? 'text-green-300' : 'text-red-300'}`}>{gameState.groomResult ? "החתן צדק! 🎉" : "החתן טעה... 💀"}</h3>
             </div>
             {gameState.roundPhase === 'JUDGMENT' && gameState.roundLosers.length > 0 && (
                <button onClick={spinMission} className="relative z-10 w-full py-4 bg-gradient-to-r from-pink-600 to-red-600 text-white font-bold rounded-xl text-lg animate-pulse shadow-lg"><div className="flex items-center justify-center gap-2"><ShieldAlert className="w-6 h-6" /> הגרל משימה למפסידים</div></button>
             )}
             {gameState.roundPhase === 'JUDGMENT' && gameState.roundLosers.length === 0 && (
                <button onClick={nextQuestion} className="relative z-10 w-full py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl">לשאלה הבאה</button>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GamePhase;
