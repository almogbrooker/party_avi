
import React, { useState, useRef, useEffect } from 'react';
import { Player, Mission, QAPair, GameState } from '../types';
import confetti from 'canvas-confetti';
import { Play, Pause, CheckCircle, XCircle, Wine, Skull, ChevronRight, Volume2, VolumeX, Music, Clock, ThumbsUp, ThumbsDown, User, Crown, Sword, Loader2 } from 'lucide-react';

interface GamePhaseProps {
  gameState: GameState;
  onUpdateState: (updates: Partial<GameState>) => void;
  onGameEnd: () => void;
}

const AMBIENT_MUSIC_URL = "https://assets.mixkit.co/music/preview/mixkit-game-show-suspense-942.mp3"; // Placeholder
const SUSPENSE_MUSIC_URL = "https://assets.mixkit.co/music/preview/mixkit-ticking-clock-suspense-2775.mp3"; // Placeholder

const GamePhase: React.FC<GamePhaseProps> = ({ gameState, onUpdateState, onGameEnd }) => {
  const { 
    players, 
    questions, 
    currentQuestionIndex, 
    roundPhase, 
    currentVotes, 
    groomResult, 
    roundLosers,
    videos,
    isPaused,
    groomAnswer,
    selectedVictimId,
    pastVictims
  } = gameState;

  const currentQ = questions[currentQuestionIndex];
  
  // Audio Refs
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const suspenseAudioRef = useRef<HTMLAudioElement | null>(null);
  const tickAudioRef = useRef<HTMLAudioElement | null>(null);
  const boomAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const [isMusicOn, setIsMusicOn] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Roulette State
  const [rouletteIndex, setRouletteIndex] = useState(0);
  const [isRouletteSpinning, setIsRouletteSpinning] = useState(false);

  // --- AUDIO MANAGEMENT ---
  useEffect(() => {
      // Initialize Audio Objects
      if (!ambientAudioRef.current) {
          ambientAudioRef.current = new Audio(AMBIENT_MUSIC_URL);
          ambientAudioRef.current.loop = true;
          ambientAudioRef.current.volume = 0.1; // Low volume for ambient
      }
      if (!suspenseAudioRef.current) {
          suspenseAudioRef.current = new Audio(SUSPENSE_MUSIC_URL);
          suspenseAudioRef.current.loop = true;
          suspenseAudioRef.current.volume = 0.3; // Higher volume for suspense
      }
      if (!tickAudioRef.current) tickAudioRef.current = new Audio("https://assets.mixkit.co/sfx/preview/mixkit-game-ball-tap-2073.mp3");
      if (!boomAudioRef.current) boomAudioRef.current = new Audio("https://assets.mixkit.co/sfx/preview/mixkit-fuel-explosion-1705.mp3");

      const ambient = ambientAudioRef.current;
      const suspense = suspenseAudioRef.current;

      if (!isMusicOn || isPaused) {
          ambient.pause();
          suspense.pause();
          return;
      }

      // Logic to switch tracks based on phase
      const isSuspensePhase = roundPhase === 'GROOM_ANSWERING' || roundPhase === 'VOTING' || roundPhase === 'VICTIM_SELECTION';
      
      if (isSuspensePhase) {
          ambient.pause();
          suspense.play().catch(e => console.log("Audio play failed", e));
      } else {
          suspense.pause();
          // Don't play ambient during video playback (QUESTION/REVEAL) to hear the audio
          const isVideoPhase = roundPhase === 'QUESTION' || roundPhase === 'REVEAL';
          if (!isVideoPhase) {
             ambient.play().catch(e => console.log("Audio play failed", e));
          } else {
             ambient.pause();
          }
      }

  }, [roundPhase, isMusicOn, isPaused]);

  // --- VIDEO MANAGEMENT ---
  useEffect(() => {
    if (!videoRef.current || !currentQ) return;
    
    const videoFile = videos[currentQ.videoId];
    if (videoFile) {
        // Only update source if it changed to prevent reload
        const newSrc = URL.createObjectURL(videoFile);
        if (videoRef.current.src !== newSrc) {
            videoRef.current.src = newSrc;
        }
        
        // Handle Phases
        if (roundPhase === 'QUESTION') {
             videoRef.current.currentTime = currentQ.qStart;
             if (!isPaused) videoRef.current.play().catch(() => {});
        } else if (roundPhase === 'REVEAL') {
             videoRef.current.currentTime = currentQ.aStart;
             if (!isPaused) videoRef.current.play().catch(() => {});
        } else {
             videoRef.current.pause();
        }
    }
    
    // Cleanup handled by browser mostly, but could revoke object URLs if needed strictly
  }, [currentQ, roundPhase, videos, isPaused]);

  // Handle Video Time Updates (Auto-Pause)
  const handleTimeUpdate = () => {
      if (!videoRef.current || !currentQ) return;
      const t = videoRef.current.currentTime;
      
      if (roundPhase === 'QUESTION' && t >= currentQ.qEnd) {
          videoRef.current.pause();
          onUpdateState({ roundPhase: 'GROOM_ANSWERING' });
      }
      
      if (roundPhase === 'REVEAL' && t >= currentQ.aEnd) {
          videoRef.current.pause();
          onUpdateState({ roundPhase: 'JUDGMENT' });
      }
  };

  // --- TIMER LOGIC ---
  useEffect(() => {
      let interval: any;
      
      // Setup Timer based on phase
      if (roundPhase === 'GROOM_ANSWERING') {
          if (timeLeft === 0) setTimeLeft(60); // 60s for Groom
      } else if (roundPhase === 'VOTING') {
          if (timeLeft === 0) setTimeLeft(20); // 20s for Voting
      } else {
          // Reset timer for other phases
          if (timeLeft !== 0 && roundPhase !== 'GROOM_ANSWERING' && roundPhase !== 'VOTING') {
              setTimeLeft(0);
          }
      }

      if ((roundPhase === 'GROOM_ANSWERING' || roundPhase === 'VOTING') && !isPaused) {
          interval = setInterval(() => {
              setTimeLeft(prev => {
                  if (prev <= 1) {
                      clearInterval(interval);
                      handleTimerComplete();
                      return 0;
                  }
                  return prev - 1;
              });
          }, 1000);
      }
      
      return () => clearInterval(interval);
  }, [roundPhase, isPaused]);

  const handleTimerComplete = () => {
      if (roundPhase === 'GROOM_ANSWERING') {
          onUpdateState({ roundPhase: 'VOTING' });
      } else if (roundPhase === 'VOTING') {
          // Auto-vote for lazy players
          const nonGroomPlayers = players.filter(p => !p.isGroom);
          const newVotes = { ...currentVotes };
          let changed = false;
          
          nonGroomPlayers.forEach(p => {
              if (newVotes[p.id] === undefined) {
                  newVotes[p.id] = Math.random() > 0.5; // Random vote
                  changed = true;
              }
          });
          
          if (changed) {
              onUpdateState({ currentVotes: newVotes, roundPhase: 'REVEAL' });
          } else {
              onUpdateState({ roundPhase: 'REVEAL' });
          }
      }
  };

  // --- ROULETTE LOGIC (VICTIM REVEAL) ---
  useEffect(() => {
      if (roundPhase === 'VICTIM_REVEAL' && roundLosers.length > 1) {
          setIsRouletteSpinning(true);
          let speed = 100;
          let steps = 0;
          const maxSteps = 25; // How many spins before stop
          
          const spin = () => {
              setRouletteIndex(prev => (prev + 1) % roundLosers.length);
              if (tickAudioRef.current && isMusicOn) {
                  tickAudioRef.current.currentTime = 0;
                  tickAudioRef.current.play().catch(() => {});
              }
              
              steps++;
              if (steps < maxSteps) {
                  speed += 10; // Slow down
                  setTimeout(spin, speed);
              } else {
                  // Stop on the victim
                  setIsRouletteSpinning(false);
                  const victimIndex = roundLosers.findIndex(id => id === selectedVictimId);
                  setRouletteIndex(victimIndex !== -1 ? victimIndex : 0);
                  
                  if (boomAudioRef.current && isMusicOn) {
                      boomAudioRef.current.play().catch(() => {});
                  }
              }
          };
          spin();
      } else if (roundPhase === 'VICTIM_REVEAL') {
          // Single loser or logic fallback
          if (boomAudioRef.current && isMusicOn) {
               boomAudioRef.current.play().catch(() => {});
          }
      }
  }, [roundPhase, roundLosers, selectedVictimId]);


  // --- HOST ACTIONS ---
  const handleJudgment = (isCorrect: boolean) => {
    const groomId = players.find(p => p.isGroom)?.id;
    if (!groomId) return;

    // Calculate losers
    const losers: string[] = [];
    players.forEach(p => {
        if (p.isGroom) return;
        const vote = currentVotes[p.id];
        // If vote matches result (e.g. He's Right (true) === isCorrect (true)), player wins.
        // If vote != result, player loses.
        if (vote !== isCorrect) {
            losers.push(p.id);
        }
    });

    // If Groom is wrong, he is also a loser (conceptually, though he doesn't drink based on votes usually, depends on house rules. Let's say he drinks if he is wrong)
    if (!isCorrect) {
        // Logic choice: Does groom drink if he didn't know the answer? Usually yes.
    }

    // Update scores
    const updatedPlayers = players.map(p => {
        if (p.isGroom) {
            return isCorrect ? { ...p, score: p.score + 10 } : p;
        } else {
            const vote = currentVotes[p.id];
            if (vote === isCorrect) {
                return { ...p, score: p.score + 5 };
            } else {
                return { ...p, drinks: p.drinks + 1 };
            }
        }
    });

    // Determine next phase
    const nextPhase = losers.length > 0 ? 'VICTIM_SELECTION' : 'CONSEQUENCE';

    onUpdateState({
        groomResult: isCorrect,
        players: updatedPlayers,
        groomCorrectCount: isCorrect ? gameState.groomCorrectCount + 1 : gameState.groomCorrectCount,
        roundLosers: losers,
        roundPhase: nextPhase
    });
  };

  const nextQuestion = () => {
    if (currentQuestionIndex + 1 < questions.length) {
      onUpdateState({
        currentQuestionIndex: currentQuestionIndex + 1,
        roundPhase: 'QUESTION',
        currentVotes: {},
        groomResult: null,
        roundLosers: [],
        groomAnswer: null,
        selectedVictimId: null
      });
    } else {
      onGameEnd();
    }
  };

  // --- RENDERING HELPERS ---

  // Circular Timer SVG
  const renderTimer = (maxTime: number) => {
      const radius = 45;
      const circumference = 2 * Math.PI * radius;
      const progress = (timeLeft / maxTime) * circumference;
      const color = timeLeft < 5 ? 'text-red-500' : (roundPhase === 'GROOM_ANSWERING' ? 'text-yellow-400' : 'text-blue-400');
      
      return (
          <div className="relative w-48 h-48 flex items-center justify-center animate-pop">
              <svg className="w-full h-full transform -rotate-90 drop-shadow-2xl" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r={radius} stroke="#334155" strokeWidth="8" fill="transparent" />
                  <circle 
                    cx="50" cy="50" r={radius} 
                    stroke="currentColor" 
                    strokeWidth="8" 
                    fill="transparent" 
                    strokeDasharray={circumference} 
                    strokeDashoffset={circumference - progress}
                    strokeLinecap="round"
                    className={`transition-all duration-1000 ease-linear ${color}`}
                  />
              </svg>
              <div className={`absolute inset-0 flex flex-col items-center justify-center ${color}`}>
                  <span className="text-6xl font-black font-mono">{timeLeft}</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-1">
                      {roundPhase === 'GROOM_ANSWERING' ? 'דבר חתן' : 'הצבעה'}
                  </span>
              </div>
          </div>
      );
  };

  return (
    <div className="h-screen w-full flex flex-col bg-slate-900 relative overflow-hidden">
      {/* --- HEADER --- */}
      <div className="h-20 bg-slate-900/90 border-b border-slate-700 flex items-center justify-between px-6 z-20 shrink-0">
          <div className="flex items-center gap-4">
              <div className="bg-purple-600 px-4 py-1 rounded-full text-sm font-bold shadow-lg shadow-purple-900/50">
                  שאלה {currentQuestionIndex + 1} / {questions.length}
              </div>
              <h2 className="text-xl font-bold text-slate-200 truncate max-w-xl">{currentQ.question}</h2>
          </div>
          
          <div className="flex items-center gap-4">
               {/* Controls */}
               <button onClick={() => setIsMusicOn(!isMusicOn)} className={`p-3 rounded-full ${isMusicOn ? 'bg-slate-700 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
                   {isMusicOn ? <Volume2 className="w-5 h-5"/> : <VolumeX className="w-5 h-5"/>}
               </button>
               <button onClick={() => onUpdateState({ isPaused: !isPaused })} className={`p-3 rounded-full ${isPaused ? 'bg-orange-500 text-white animate-pulse' : 'bg-slate-700 text-slate-300'}`}>
                   {isPaused ? <Play className="w-5 h-5 fill-current"/> : <Pause className="w-5 h-5 fill-current"/>}
               </button>
          </div>
      </div>

      {/* --- MAIN CONTENT GRID --- */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden relative">
          
          {/* LEFT: Video & Actions */}
          <div className="col-span-8 relative bg-black flex flex-col items-center justify-center p-4">
              {/* Video Player */}
              <div className="relative w-full h-full max-h-[80vh] aspect-video rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
                  <video 
                    ref={videoRef}
                    className="w-full h-full object-contain bg-black"
                    onTimeUpdate={handleTimeUpdate}
                    playsInline
                  />
                  {/* Overlays */}
                  {roundPhase === 'QUESTION' && <div className="absolute top-4 right-4 bg-black/60 backdrop-blur px-4 py-2 rounded-lg text-xl font-bold border border-white/10">🎥 צפה בשאלה</div>}
                  {roundPhase === 'REVEAL' && <div className="absolute top-4 right-4 bg-green-600/80 backdrop-blur px-4 py-2 rounded-lg text-xl font-bold border border-white/10 animate-pulse">🎬 חשיפת התשובה</div>}
                  
                  {/* Timer Overlay for Non-Video Phases */}
                  {(roundPhase === 'GROOM_ANSWERING' || roundPhase === 'VOTING') && (
                      <div className="absolute inset-0 bg-slate-900/90 z-10 flex flex-col items-center justify-center">
                          {renderTimer(roundPhase === 'GROOM_ANSWERING' ? 60 : 20)}
                          
                          {/* Groom Answer Preview during timer */}
                          {roundPhase === 'GROOM_ANSWERING' && groomAnswer && (
                              <div className="mt-8 bg-yellow-500/20 border border-yellow-500 px-8 py-4 rounded-xl animate-pop max-w-2xl text-center">
                                  <div className="text-yellow-400 text-sm font-bold mb-2 uppercase">החתן כתב:</div>
                                  <div className="text-3xl text-white font-bold">"{groomAnswer}"</div>
                              </div>
                          )}
                      </div>
                  )}

                  {/* Victim Roulette Overlay */}
                  {(roundPhase === 'VICTIM_SELECTION' || roundPhase === 'VICTIM_REVEAL') && (
                      <div className="absolute inset-0 bg-slate-900/95 z-20 flex flex-col items-center justify-center">
                          <h2 className="text-4xl font-black text-red-500 mb-8 uppercase tracking-widest animate-pulse">הקורבן הנבחר</h2>
                          
                          <div className="relative w-64 h-64">
                              {/* Background Glow */}
                              <div className="absolute inset-0 bg-red-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
                              
                              {/* Avatar Cycle */}
                              <div className="relative w-full h-full rounded-full border-8 border-red-600 overflow-hidden shadow-[0_0_50px_rgba(220,38,38,0.5)] bg-slate-800">
                                   {roundLosers.length > 0 && (
                                       (() => {
                                           // Determine which ID to show
                                           const idToShow = isRouletteSpinning 
                                                ? roundLosers[rouletteIndex] 
                                                : selectedVictimId || roundLosers[0];
                                           
                                           const p = players.find(pl => pl.id === idToShow);
                                           return p?.photo ? (
                                               <img src={p.photo} className="w-full h-full object-cover" />
                                           ) : (
                                               <div className="w-full h-full flex items-center justify-center"><User className="w-20 h-20 text-slate-500"/></div>
                                           );
                                       })()
                                   )}
                              </div>
                          </div>
                          
                          {roundPhase === 'VICTIM_REVEAL' && !isRouletteSpinning && selectedVictimId && (
                               <div className="mt-8 text-center animate-pop">
                                   <div className="text-5xl font-black text-white mb-2">{players.find(p => p.id === selectedVictimId)?.name}</div>
                                   <button 
                                     onClick={() => onUpdateState({ roundPhase: 'MISSION_EXECUTION' })}
                                     className="mt-6 bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-full text-xl shadow-lg transition-transform hover:scale-105"
                                   >
                                       ביצוע משימה!
                                   </button>
                               </div>
                          )}
                      </div>
                  )}

                  {/* Judgment Phase Overlay */}
                  {roundPhase === 'JUDGMENT' && (
                      <div className="absolute inset-0 bg-slate-900/90 z-20 flex flex-col items-center justify-center gap-8 animate-fade-in">
                          <h2 className="text-4xl font-bold text-white">האם החתן צדק?</h2>
                          <div className="flex gap-8">
                              <button onClick={() => handleJudgment(true)} className="group flex flex-col items-center gap-4 p-8 bg-green-500/10 hover:bg-green-500/20 border-2 border-green-500 rounded-3xl transition-all hover:scale-105">
                                  <CheckCircle className="w-24 h-24 text-green-500 group-hover:animate-bounce" />
                                  <span className="text-3xl font-bold text-green-400">צדק!</span>
                              </button>
                              <button onClick={() => handleJudgment(false)} className="group flex flex-col items-center gap-4 p-8 bg-red-500/10 hover:bg-red-500/20 border-2 border-red-500 rounded-3xl transition-all hover:scale-105">
                                  <XCircle className="w-24 h-24 text-red-500 group-hover:animate-shake" />
                                  <span className="text-3xl font-bold text-red-400">טעה...</span>
                              </button>
                          </div>
                      </div>
                  )}

                  {/* Mission Execution Overlay */}
                  {roundPhase === 'MISSION_EXECUTION' && (
                      <div className="absolute inset-0 bg-slate-900 z-30 flex items-center justify-center p-8 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
                          <div className="w-full max-w-4xl border-4 border-yellow-500 bg-black/80 p-12 rounded-3xl text-center relative shadow-[0_0_100px_rgba(234,179,8,0.3)]">
                               <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-yellow-500 text-black font-black text-2xl px-8 py-2 rounded-full uppercase tracking-widest rotate-2 shadow-lg">
                                   VS
                               </div>
                               
                               <div className="flex justify-between items-center mb-12">
                                   <div className="text-center w-1/3">
                                       <div className="w-32 h-32 mx-auto rounded-full border-4 border-yellow-500 overflow-hidden mb-4 shadow-xl">
                                            {players.find(p => p.isGroom)?.photo ? (
                                                <img src={players.find(p => p.isGroom)?.photo} className="w-full h-full object-cover" />
                                            ) : <User className="w-full h-full bg-slate-800 p-4" />}
                                       </div>
                                       <h3 className="text-2xl font-bold text-yellow-400">החתן</h3>
                                   </div>
                                   
                                   <div className="w-1/3 flex flex-col items-center">
                                       <Sword className="w-20 h-20 text-red-500 animate-pulse" />
                                   </div>

                                   <div className="text-center w-1/3">
                                       <div className="w-32 h-32 mx-auto rounded-full border-4 border-red-500 overflow-hidden mb-4 shadow-xl bg-slate-800 relative">
                                            {/* Show victim photo or group icon */}
                                            {players.find(p => p.id === selectedVictimId)?.photo ? (
                                                <img src={players.find(p => p.id === selectedVictimId)?.photo} className="w-full h-full object-cover grayscale" />
                                            ) : <Skull className="w-full h-full p-6 text-red-500" />}
                                       </div>
                                       <h3 className="text-2xl font-bold text-red-400">הקורבן</h3>
                                   </div>
                               </div>

                               <div className="bg-white/10 p-6 rounded-xl border border-white/20 mb-8">
                                   <h4 className="text-slate-400 text-sm uppercase tracking-wider mb-2">המשימה</h4>
                                   <p className="text-3xl font-black text-white leading-relaxed">
                                       {currentQ.question} {/* Or specific mission if separated logic */}
                                       {/* For this logic, we assume we might want to show a specific mission text, but sticking to prompt flow */}
                                       בצעו את המשימה שעל הפרק!
                                   </p>
                               </div>

                               <button onClick={nextQuestion} className="bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xl py-4 px-12 rounded-full shadow-lg transform transition-transform hover:scale-105 flex items-center justify-center gap-3 mx-auto">
                                   <CheckCircle className="w-6 h-6" />
                                   המשימה הושלמה!
                               </button>
                          </div>
                      </div>
                  )}

                  {/* Pause Overlay */}
                  {isPaused && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
                          <div className="text-center animate-bounce">
                              <Pause className="w-24 h-24 text-white mx-auto mb-4" />
                              <h2 className="text-4xl font-bold text-white">המשחק מושהה</h2>
                          </div>
                      </div>
                  )}
              </div>
          </div>

          {/* RIGHT: Leaderboard & Status */}
          <div className="col-span-4 bg-slate-900 border-r border-slate-700 flex flex-col">
              {/* Header Status */}
              <div className="p-4 bg-slate-800 border-b border-slate-700">
                  <div className="flex justify-between items-center mb-2">
                       <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">סטטוס</span>
                       <div className="flex items-center gap-2">
                           {roundPhase === 'VOTING' && (
                               <>
                                   <div className="flex items-center gap-1 text-green-400 text-xs font-bold bg-green-900/30 px-2 py-1 rounded">
                                       <ThumbsUp className="w-3 h-3" /> {Object.values(currentVotes).filter(v => v).length}
                                   </div>
                                   <div className="flex items-center gap-1 text-red-400 text-xs font-bold bg-red-900/30 px-2 py-1 rounded">
                                       <ThumbsDown className="w-3 h-3" /> {Object.values(currentVotes).filter(v => !v).length}
                                   </div>
                               </>
                           )}
                           <span className="bg-slate-700 text-white text-xs px-2 py-1 rounded-full">{Object.keys(currentVotes).length}/{players.filter(p => !p.isGroom).length}</span>
                       </div>
                  </div>
                  
                  {/* Groom Answer Display Small */}
                  {groomAnswer && roundPhase !== 'GROOM_ANSWERING' && (
                      <div className="mt-2 bg-yellow-900/30 border border-yellow-500/30 p-2 rounded text-center">
                          <span className="text-xs text-yellow-500 block mb-1">תשובת החתן</span>
                          <span className="text-white font-bold">{groomAnswer}</span>
                      </div>
                  )}
              </div>

              {/* Player Grid */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  <div className="grid grid-cols-1 gap-3">
                      {players.sort((a,b) => b.score - a.score).map(p => {
                          const vote = currentVotes[p.id];
                          const isVoting = roundPhase === 'VOTING';
                          const isReveal = roundPhase === 'REVEAL' || roundPhase === 'JUDGMENT' || roundPhase === 'VICTIM_SELECTION';
                          const isWinner = isReveal && groomResult !== null && vote === groomResult && !p.isGroom;
                          const isLoser = isReveal && groomResult !== null && vote !== groomResult && !p.isGroom;
                          const isVictim = selectedVictimId === p.id;

                          return (
                              <div key={p.id} className={`
                                  relative p-3 rounded-xl border flex items-center justify-between transition-all duration-300
                                  ${p.isGroom ? 'bg-gradient-to-r from-yellow-900/40 to-slate-800 border-yellow-500/50' : 'bg-slate-800 border-slate-700'}
                                  ${isWinner ? 'border-green-500 bg-green-900/20 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : ''}
                                  ${isLoser ? 'border-red-500 opacity-80' : ''}
                                  ${isVictim ? 'border-red-500 bg-red-900/50 scale-105 z-10' : ''}
                              `}>
                                  <div className="flex items-center gap-3">
                                      <div className="relative">
                                          <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden border border-slate-600">
                                              {p.photo ? <img src={p.photo} className="w-full h-full object-cover"/> : <User className="w-full h-full p-2 text-slate-400"/>}
                                          </div>
                                          {p.isGroom && <div className="absolute -top-2 -left-1 text-yellow-500"><Crown className="w-5 h-5 fill-current"/></div>}
                                          {isVictim && <div className="absolute -bottom-1 -right-1 bg-red-600 rounded-full p-0.5"><Skull className="w-3 h-3 text-white"/></div>}
                                      </div>
                                      <div>
                                          <div className={`font-bold text-sm ${p.isGroom ? 'text-yellow-400' : 'text-slate-200'}`}>{p.name}</div>
                                          <div className="flex items-center gap-2 text-xs text-slate-400">
                                              <span>{p.score} נק'</span>
                                              {p.drinks > 0 && <span className="text-red-400 flex items-center"><Wine className="w-3 h-3 mr-0.5"/> {p.drinks}</span>}
                                          </div>
                                      </div>
                                  </div>

                                  {/* Status Icon */}
                                  <div>
                                      {isVoting && (
                                          vote !== undefined 
                                            ? <div className="w-3 h-3 bg-green-500 rounded-full shadow-[0_0_10px_#22c55e]"></div>
                                            : <Loader2 className="w-4 h-4 text-slate-600 animate-spin" />
                                      )}
                                      {isReveal && !p.isGroom && (
                                          vote !== undefined ? (
                                              <div className={`p-1 rounded-full ${vote ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                  {vote ? <ThumbsUp className="w-4 h-4" /> : <ThumbsDown className="w-4 h-4" />}
                                              </div>
                                          ) : <span className="text-xs text-slate-600">-</span>
                                      )}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default GamePhase;
