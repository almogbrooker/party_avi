import React, { useState, useRef, useEffect } from 'react';
import { Player, Mission, QAPair, GameState } from '../types';
import confetti from 'canvas-confetti';
import { Play, Pause, CheckCircle, XCircle, Wine, Skull, ChevronRight, Volume2, VolumeX, Music, Clock, ThumbsUp, ThumbsDown, User, Crown, Sword, Loader2 } from 'lucide-react';

interface GamePhaseProps {
  gameState: GameState;
  onUpdateState: (updates: Partial<GameState>) => void;
  onGameEnd: () => void;
}

// Audio disabled - was causing NotSupportedError
const AMBIENT_MUSIC_URL = "";
const SUSPENSE_MUSIC_URL = "";
const CORRECT_ANSWER_URL = "";
const WRONG_ANSWER_URL = "";
const VICTIM_SELECTED_URL = "";
const MISSION_COMPLETE_URL = "";
const COUNTDOWN_TICK_URL = "";

// Random groom image display component
const RandomGroomImage: React.FC<{ images: File[] }> = ({ images }) => {
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (images.length === 0) return;

    const showRandomImage = () => {
      const randomIndex = Math.floor(Math.random() * images.length);
      const imageUrl = URL.createObjectURL(images[randomIndex]);
      setCurrentImage(imageUrl);
      setIsVisible(true);

      // Hide after 3 seconds
      setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
      }, 3000);
    };

    // Show first image after 10 seconds, then randomly every 15-30 seconds
    const initialTimer = setTimeout(showRandomImage, 10000);
    const randomInterval = setInterval(() => {
      const randomDelay = Math.random() * 15000 + 15000; // 15-30 seconds
      setTimeout(showRandomImage, randomDelay);
    }, 30000); // Check every 30 seconds

    return () => {
      clearTimeout(initialTimer);
      clearInterval(randomInterval);
      if (currentImage) URL.revokeObjectURL(currentImage);
    };
  }, [images]);

  if (!isVisible || !currentImage) return null;

  return (
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 animate-bounce">
      <img
        src={currentImage}
        alt="Random groom moment"
        className="w-48 h-48 md:w-64 md:h-64 object-contain rounded-2xl border-4 border-white shadow-2xl"
      />
    </div>
  );
};

const GamePhase: React.FC<GamePhaseProps> = ({ gameState, onUpdateState, onGameEnd }) => {
  // Helper function to play sound with lazy loading
  const playSound = (ref: React.MutableRefObject<HTMLAudioElement | null>, url: string, volume: number = 0.5) => {
    if (!isMusicOn || !url) return;
    if (!ref.current) {
      ref.current = new Audio(url);
      ref.current.volume = volume;
    }
    ref.current.play().catch(() => {});
  };

  // Helper function to safely pause audio
  const safePause = (ref: React.MutableRefObject<HTMLAudioElement | null>) => {
    if (ref.current) {
      ref.current.pause();
    }
  };

  // Helper function to safely play audio
  const safePlay = (ref: React.MutableRefObject<HTMLAudioElement | null>, url: string) => {
    if (!isMusicOn || !url) return;
    if (!ref.current) {
      ref.current = new Audio(url);
      ref.current.volume = 0.3;
    }
    ref.current.play().catch(e => console.log("Audio play failed:", e));
  };

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

  const currentQ = questions && questions.length > 0 ? questions[currentQuestionIndex] : null;

  // If no questions, show a message
  if (!questions || questions.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <h2 className="text-3xl font-bold mb-4">אין שאלות זמינות</h2>
          <p>אנא הוסף שאלות והתחל מחדש</p>
        </div>
      </div>
    );
  }

  // Audio Refs
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const suspenseAudioRef = useRef<HTMLAudioElement | null>(null);
  const tickAudioRef = useRef<HTMLAudioElement | null>(null);
  const boomAudioRef = useRef<HTMLAudioElement | null>(null);
  const correctAnswerRef = useRef<HTMLAudioElement | null>(null);
  const wrongAnswerRef = useRef<HTMLAudioElement | null>(null);
  const victimSelectedRef = useRef<HTMLAudioElement | null>(null);
  const missionCompleteRef = useRef<HTMLAudioElement | null>(null);
  const countdownTickRef = useRef<HTMLAudioElement | null>(null);

  // Custom music refs
  const lobbyMusicRef = useRef<HTMLAudioElement | null>(null);
  const questionMusicRef = useRef<HTMLAudioElement | null>(null);
  const groomMusicRef = useRef<HTMLAudioElement | null>(null);
  const votingMusicRef = useRef<HTMLAudioElement | null>(null);
  const revealMusicRef = useRef<HTMLAudioElement | null>(null);
  const missionMusicRef = useRef<HTMLAudioElement | null>(null);
  const victoryMusicRef = useRef<HTMLAudioElement | null>(null);

  const [isMusicOn, setIsMusicOn] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Roulette State
  const [rouletteIndex, setRouletteIndex] = useState(0);
  const [isRouletteSpinning, setIsRouletteSpinning] = useState(false);

  // --- AUDIO MANAGEMENT ---
  useEffect(() => {
      // Play appropriate music for each phase
      if (!gameState.isHost) return; // Only host controls music

      const stopAllAudio = () => {
          if (lobbyMusicRef.current) lobbyMusicRef.current.pause();
          if (questionMusicRef.current) questionMusicRef.current.pause();
          if (groomMusicRef.current) groomMusicRef.current.pause();
          if (votingMusicRef.current) votingMusicRef.current.pause();
          if (revealMusicRef.current) revealMusicRef.current.pause();
          if (missionMusicRef.current) missionMusicRef.current.pause();
          if (victoryMusicRef.current) victoryMusicRef.current.pause();
      };

      stopAllAudio();

      // Only play if not paused
      if (isPaused) return;

      // Get music URLs from gameState
      const { gameMusic } = gameState;

      // Create audio objects from files
      if (gameMusic.lobby && !lobbyMusicRef.current) {
          lobbyMusicRef.current = new Audio(URL.createObjectURL(gameMusic.lobby));
          lobbyMusicRef.current.loop = true;
          lobbyMusicRef.current.volume = 0.5;
      }
      if (gameMusic.question && !questionMusicRef.current) {
          questionMusicRef.current = new Audio(URL.createObjectURL(gameMusic.question));
          questionMusicRef.current.loop = true;
          questionMusicRef.current.volume = 0.4;
      }
      if (gameMusic.groomAnswering && !groomMusicRef.current) {
          groomMusicRef.current = new Audio(URL.createObjectURL(gameMusic.groomAnswering));
          groomMusicRef.current.loop = true;
          groomMusicRef.current.volume = 0.5;
      }
      if (gameMusic.voting && !votingMusicRef.current) {
          votingMusicRef.current = new Audio(URL.createObjectURL(gameMusic.voting));
          votingMusicRef.current.loop = true;
          votingMusicRef.current.volume = 0.4;
      }
      if (gameMusic.reveal && !revealMusicRef.current) {
          revealMusicRef.current = new Audio(URL.createObjectURL(gameMusic.reveal));
          revealMusicRef.current.volume = 0.6;
      }
      if (gameMusic.mission && !missionMusicRef.current) {
          missionMusicRef.current = new Audio(URL.createObjectURL(gameMusic.mission));
          missionMusicRef.current.loop = true;
          missionMusicRef.current.volume = 0.5;
      }
      if (gameMusic.victory && !victoryMusicRef.current) {
          victoryMusicRef.current = new Audio(URL.createObjectURL(gameMusic.victory));
          victoryMusicRef.current.volume = 0.7;
      }

      // Play appropriate music based on phase
      const playPhaseMusic = (audioRef: React.MutableRefObject<HTMLAudioElement | null>) => {
          if (audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(err => console.log('Audio play failed:', err));
          }
      };

      switch (gameState.stage) {
          case GameStage.LOBBY:
              if (lobbyMusicRef.current) playPhaseMusic(lobbyMusicRef);
              break;
          case GameStage.PLAYING:
              switch (roundPhase) {
                  case 'QUESTION':
                      if (questionMusicRef.current) playPhaseMusic(questionMusicRef);
                      break;
                  case 'GROOM_ANSWERING':
                      if (groomMusicRef.current) playPhaseMusic(groomMusicRef);
                      break;
                  case 'VOTING':
                      if (votingMusicRef.current) playPhaseMusic(votingMusicRef);
                      break;
                  case 'REVEAL':
                  case 'JUDGMENT':
                      if (revealMusicRef.current) playPhaseMusic(revealMusicRef);
                      break;
                  case 'MISSION_EXECUTION':
                      if (missionMusicRef.current) playPhaseMusic(missionMusicRef);
                      break;
                  case 'VICTIM_SELECTION':
                  case 'VICTIM_REVEAL':
                      // Keep current music playing
                      break;
              }
              break;
          case GameStage.SUMMARY:
              if (victoryMusicRef.current) playPhaseMusic(victoryMusicRef);
              break;
      }

      return () => {
          stopAllAudio();
      };
  }, [gameState.stage, roundPhase, gameState.gameMusic, isPaused, gameState.isHost]);

  // Log state on mount and changes
  useEffect(() => {
      console.log('🎮 GamePhase mounted/updated:', {
          stage: gameState.stage,
          roundPhase,
          playersCount: players.length,
          currentQuestionIndex,
          hasVideo: !!currentQ,
          isHost: gameState.isHost,
          isPaused,
          groomAnswer: groomAnswer ? '[SET]' : '[NOT SET]',
          votesCount: Object.keys(currentVotes).length,
          roundLosers: roundLosers,
          selectedVictim: selectedVictimId
      });
  }, [gameState.stage, roundPhase, players.length, currentQuestionIndex, isPaused, groomAnswer, currentVotes, roundLosers, selectedVictimId]);

  // --- BOT AUTOMATION ---
  useEffect(() => {
    if (!gameState.isHost || isPaused) return;
    
    const groom = players.find(p => p.isGroom);
    const bots = players.filter(p => p.isBot && !p.isGroom);

    // 1. Groom Bot Answer Automation (30-40s delay)
    if (roundPhase === 'GROOM_ANSWERING' && groom?.isBot && !groomAnswer) {
         // Random text options for the bot
         const botAnswers = [
            "אני לא זוכר אבל בטח משהו מביך",
            "חד משמעית כן",
            "לא נראה לי",
            "היא תגיד שאני מבולגן",
            "פיצה?",
            "תל אביב",
            "ברור שאני אוהב אותה",
            "שטויות במיץ",
            "לא יודע..."
         ];
         const randomAnswer = botAnswers[Math.floor(Math.random() * botAnswers.length)];
         
         const timeout = setTimeout(() => {
             onUpdateState({ groomAnswer: randomAnswer });
         }, 30000 + Math.random() * 10000); // 30s to 40s
         
         return () => clearTimeout(timeout);
    }

    // 2. Voting Automation for Bots
    if (roundPhase === 'VOTING') {
        const botsToVote = bots.filter(b => currentVotes[b.id] === undefined);
        if (botsToVote.length > 0) {
             const timeout = setTimeout(() => {
                 const newVotes = { ...currentVotes };
                 botsToVote.forEach(b => {
                     newVotes[b.id] = Math.random() > 0.5;
                 });
                 onUpdateState({ currentVotes: newVotes });
             }, 3000); // 3s delay for votes
             return () => clearTimeout(timeout);
        }
    }

    // 3. Victim Selection Automation
    if (roundPhase === 'VICTIM_SELECTION' && groom?.isBot && roundLosers.length > 0) {
         const timeout = setTimeout(() => {
             const randomVictim = roundLosers[Math.floor(Math.random() * roundLosers.length)];
             onUpdateState({ 
                 selectedVictimId: randomVictim,
                 roundPhase: 'VICTIM_REVEAL',
                 pastVictims: gameState.pastVictims.includes(randomVictim) ? gameState.pastVictims : [...gameState.pastVictims, randomVictim]
             });
         }, 5000);
         return () => clearTimeout(timeout);
    }

  }, [roundPhase, isPaused, players, currentVotes, groomAnswer, roundLosers, gameState.isHost]);

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
          console.log('🎥 Video reached question end, transitioning to GROOM_ANSWERING');
          videoRef.current.pause();
          onUpdateState({ roundPhase: 'GROOM_ANSWERING' });
      }

      if (roundPhase === 'REVEAL' && t >= currentQ.aEnd) {
          console.log('🎥 Video reached answer end, transitioning to JUDGMENT');
          videoRef.current.pause();
          onUpdateState({ roundPhase: 'JUDGMENT' });
      }
  };

  // --- TIMER LOGIC ---
  useEffect(() => {
      console.log('⏰ Timer effect - Phase:', roundPhase, 'TimeLeft:', timeLeft);
      let interval: any;

      // Setup Timer based on phase
      if (roundPhase === 'GROOM_ANSWERING') {
          // Stop timer if groom has answered
          if (groomAnswer && timeLeft > 0) {
              console.log('⏰ Groom answered, stopping timer at:', timeLeft);
              setTimeLeft(0);
          } else if (timeLeft === 0 && !groomAnswer) {
              console.log('⏰ Starting groom timer at 60 seconds');
              setTimeLeft(60); // 60s for Groom
          }
      } else if (roundPhase === 'VOTING') {
          if (timeLeft === 0) {
              console.log('⏰ Starting voting timer at 20 seconds');
              setTimeLeft(20); // 20s for Voting
          }
      } else {
          // Reset timer for other phases
          if (timeLeft !== 0 && roundPhase !== 'GROOM_ANSWERING' && roundPhase !== 'VOTING') {
              console.log('⏰ Resetting timer for phase:', roundPhase);
              setTimeLeft(0);
          }
      }

      if ((roundPhase === 'GROOM_ANSWERING' || roundPhase === 'VOTING') && !isPaused) {
          interval = setInterval(() => {
              setTimeLeft(prev => {
                  // Don't countdown if groom has answered
                  if (roundPhase === 'GROOM_ANSWERING' && groomAnswer) {
                      console.log('⏰ Groom has answered, stopping countdown');
                      return 0;
                  }

                  const newTime = prev - 1;
                  console.log('⏱️ Timer tick:', prev, '->', newTime);

                  // Play tick sound when time is running out (last 5 seconds)
                  if (prev <= 5 && prev > 1) {
                      playSound(countdownTickRef, COUNTDOWN_TICK_URL, 0.3);
                  }

                  if (prev <= 1) {
                      console.log('⏱️ Timer complete!');
                      clearInterval(interval);
                      setTimeout(handleTimerComplete, 0);
                      return 0;
                  }
                  return newTime;
              });
          }, 1000);
      }
      
      return () => clearInterval(interval);
  }, [roundPhase, isPaused, groomAnswer]);

  // Transition to VOTING when groom answers
  useEffect(() => {
    if (roundPhase === 'GROOM_ANSWERING' && groomAnswer && gameState.isHost) {
      console.log('🎯 Groom answered, transitioning to VOTING phase');
      onUpdateState({ roundPhase: 'VOTING' });
    }
  }, [groomAnswer, roundPhase, gameState.isHost]);

  const handleTimerComplete = () => {
      if (roundPhase === 'GROOM_ANSWERING') {
          onUpdateState({ roundPhase: 'VOTING' });
      } else if (roundPhase === 'VOTING') {
          // Auto-vote for lazy players (and bots if manual logic failed)
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

                  playSound(boomAudioRef, "https://assets.mixkit.co/sfx/preview/mixkit-fuel-explosion-1705.mp3", 0.4);
                  playSound(victimSelectedRef, VICTIM_SELECTED_URL, 0.6);
              }
          };
          spin();
      } else if (roundPhase === 'VICTIM_REVEAL') {
          // Single loser or logic fallback
          playSound(boomAudioRef, "https://assets.mixkit.co/sfx/preview/mixkit-fuel-explosion-1705.mp3", 0.4);
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

    // Play sound effect based on judgment
    if (isCorrect) {
        playSound(correctAnswerRef, CORRECT_ANSWER_URL, 0.5);
    } else if (!isCorrect) {
        playSound(wrongAnswerRef, WRONG_ANSWER_URL, 0.4);
    }

    onUpdateState({
        groomResult: isCorrect,
        players: updatedPlayers,
        groomCorrectCount: isCorrect ? gameState.groomCorrectCount + 1 : gameState.groomCorrectCount,
        roundLosers: losers,
        rouletteTargets: losers, // Add losers to roulette targets
        roundPhase: nextPhase
    });
  };

  const nextQuestion = () => {
    // Play mission complete sound
    playSound(missionCompleteRef, MISSION_COMPLETE_URL, 0.5);

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
      // Don't render if timer is at 0
      if (timeLeft === 0) return null;

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
    <div className="h-screen w-full flex flex-col bg-black relative overflow-hidden">
      {/* --- HEADER --- */}
      {/* Reduced size and removed title for immersion */}
      <div className="absolute top-0 left-0 right-0 p-4 z-50 flex items-center justify-between pointer-events-none">
          <div className="pointer-events-auto">
             <div className="bg-black/60 backdrop-blur px-4 py-2 rounded-full text-sm font-bold shadow-lg text-white border border-white/10">
                  שאלה {currentQuestionIndex + 1} / {questions.length}
             </div>
          </div>
          
          <div className="flex items-center gap-4 pointer-events-auto">
               <button onClick={() => setIsMusicOn(!isMusicOn)} className={`p-3 rounded-full shadow-lg backdrop-blur ${isMusicOn ? 'bg-black/60 text-green-400 border border-green-500/30' : 'bg-black/60 text-slate-500 border border-white/10'}`}>
                   {isMusicOn ? <Volume2 className="w-5 h-5"/> : <VolumeX className="w-5 h-5"/>}
               </button>
               <button onClick={() => onUpdateState({ isPaused: !isPaused })} className={`p-3 rounded-full shadow-lg backdrop-blur ${isPaused ? 'bg-orange-500 text-white animate-pulse' : 'bg-black/60 text-slate-300 border border-white/10'}`}>
                   {isPaused ? <Play className="w-5 h-5 fill-current"/> : <Pause className="w-5 h-5 fill-current"/>}
               </button>
          </div>
      </div>

      {/* --- MAIN CONTENT GRID --- */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden relative h-full">

          {/* LEFT: Video & Actions */}
          <div className="col-span-10 relative bg-black flex flex-col items-center justify-center">
              {/* Video Player */}
              <div className="relative w-full h-full overflow-hidden">
                  <video 
                    ref={videoRef}
                    className={`w-full h-full object-cover transition-all duration-1000 ${roundPhase === 'GROOM_ANSWERING' || roundPhase === 'VOTING' ? 'opacity-20 blur-xl scale-110' : 'opacity-100 scale-100'}`}
                    onTimeUpdate={handleTimeUpdate}
                    playsInline
                  />
                  
                  {/* OVERLAYS */}

                  {/* 1. Playing Overlay */}
                  {roundPhase === 'QUESTION' && <div className="absolute top-6 right-6 bg-black/60 backdrop-blur px-6 py-3 rounded-xl text-xl font-bold border border-white/10 animate-fade-in flex items-center gap-2"><span className="animate-pulse text-red-500">●</span> מקשיבים לשאלה</div>}
                  {roundPhase === 'REVEAL' && <div className="absolute top-6 right-6 bg-green-600/80 backdrop-blur px-6 py-3 rounded-xl text-xl font-bold border border-white/10 animate-pulse">🎬 חשיפת התשובה</div>}
                  
                  {/* 2. MASSIVE QUESTION OVERLAY (Groom Answering / Voting) */}
                  {(roundPhase === 'GROOM_ANSWERING' || roundPhase === 'VOTING') && (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-12 text-center bg-slate-900/90 backdrop-blur-sm">
                          
                          {/* Main Question Card */}
                          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-600/50 p-12 rounded-[3rem] shadow-2xl max-w-5xl w-full animate-pop flex flex-col items-center gap-8 relative overflow-hidden">
                                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500"></div>
                                
                                <h3 className="text-3xl text-purple-400 font-bold uppercase tracking-widest font-mono">השאלה היא:</h3>
                                <h1 className="text-6xl md:text-7xl font-black text-white leading-tight drop-shadow-lg" dir="auto">
                                    "{currentQ.question}"
                                </h1>
                                
                                <div className="flex items-center gap-16 mt-8">
                                     {renderTimer(roundPhase === 'GROOM_ANSWERING' ? 60 : 20)}
                                     
                                     {/* Side info in card */}
                                     {roundPhase === 'GROOM_ANSWERING' && (
                                         <div className="flex flex-col items-center animate-fade-in gap-4">
                                             <div className="relative">
                                                 <div className="absolute inset-0 bg-yellow-400 blur-2xl opacity-20 animate-pulse"></div>
                                                 <Crown className="w-20 h-20 text-yellow-400 animate-bounce relative z-10" />
                                             </div>
                                             <span className="text-2xl text-yellow-100 font-bold">החתן חושב...</span>
                                             {players.find(p => p.isGroom && p.isBot) && <span className="text-xs text-yellow-500/50 uppercase tracking-widest">Bot Mode</span>}
                                         </div>
                                     )}

                                     {roundPhase === 'VOTING' && (
                                         <div className="flex flex-col items-center animate-fade-in gap-4">
                                             <div className="flex -space-x-4 mb-2">
                                                 <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center border-4 border-slate-900 z-10 shadow-lg"><ThumbsUp className="w-8 h-8 text-white"/></div>
                                                 <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center border-4 border-slate-900 shadow-lg"><ThumbsDown className="w-8 h-8 text-white"/></div>
                                             </div>
                                             <span className="text-2xl text-blue-200 font-bold">הצביעו עכשיו!</span>
                                         </div>
                                     )}
                                </div>
                          </div>
                          
                          {/* Groom Answer Preview (Bottom of screen) */}
                          {roundPhase === 'GROOM_ANSWERING' && groomAnswer && (
                              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-8 py-4 rounded-xl animate-pop shadow-xl border-4 border-white max-w-2xl w-full text-center">
                                  <div className="text-xs font-bold uppercase mb-1 opacity-70">החתן כתב:</div>
                                  <div className="text-4xl font-black">{groomAnswer}</div>
                              </div>
                          )}
                      </div>
                  )}

                  {/* 3. Victim Roulette Overlay */}
                  {(roundPhase === 'VICTIM_SELECTION' || roundPhase === 'VICTIM_REVEAL') && (
                      <div className="absolute inset-0 bg-slate-900/95 z-20 flex flex-col items-center justify-center">
                          <h2 className="text-5xl font-black text-red-500 mb-8 uppercase tracking-widest animate-pulse drop-shadow-[0_0_20px_rgba(220,38,38,0.8)]">
                              {roundPhase === 'VICTIM_SELECTION' ? 'בחר קורבן' : 'הקורבן הנבחר'}
                          </h2>

                          {/* Show all losers in circles */}
                          <div className="relative w-[600px] h-[600px]">
                              {/* Central roulette circle */}
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full border-8 border-red-600 overflow-hidden shadow-[0_0_80px_rgba(220,38,38,0.6)] bg-slate-800 z-10">
                                   {roundLosers.length > 0 && (
                                       (() => {
                                           const idToShow = isRouletteSpinning
                                                ? roundLosers[rouletteIndex]
                                                : selectedVictimId || roundLosers[0];

                                           const p = players.find(pl => pl.id === idToShow);
                                           return p?.photo ? (
                                               <img src={p.photo} className="w-full h-full object-cover" />
                                           ) : (
                                               <div className="w-full h-full flex items-center justify-center"><User className="w-16 h-16 text-slate-500"/></div>
                                           );
                                       })()
                                   )}
                              </div>

                              {/* All losers circles around */}
                              {roundLosers.map((loserId, index) => {
                                  const angle = (360 / roundLosers.length) * index;
                                  const radius = 200;
                                  const x = Math.cos((angle - 90) * Math.PI / 180) * radius;
                                  const y = Math.sin((angle - 90) * Math.PI / 180) * radius;
                                  const isSelected = isRouletteSpinning ? index === rouletteIndex : loserId === selectedVictimId;
                                  const player = players.find(p => p.id === loserId);

                                  return (
                                      <div
                                          key={loserId}
                                          className={`absolute w-24 h-24 rounded-full border-4 overflow-hidden transition-all duration-300 ${
                                              isSelected
                                                  ? 'border-red-600 scale-125 shadow-[0_0_60px_rgba(220,38,38,0.8)] z-20'
                                                  : 'border-slate-600 opacity-60 hover:scale-110 hover:opacity-100'
                                          }`}
                                          style={{
                                              left: `${300 + x}px`,
                                              top: `${300 + y}px`,
                                              transform: 'translate(-50%, -50%)'
                                          }}
                                          onClick={() => !isRouletteSpinning && handleSelectVictim(loserId)}
                                      >
                                          {player?.photo ? (
                                              <img src={player.photo} className="w-full h-full object-cover" />
                                          ) : (
                                              <div className="w-full h-full flex items-center justify-center bg-slate-700">
                                                  <User className="w-8 h-8 text-slate-400"/>
                                              </div>
                                          )}
                                          {isSelected && (
                                              <div className="absolute inset-0 border-4 border-red-400 rounded-full animate-ping"></div>
                                          )}
                                      </div>
                                  );
                              })}
                          </div>
                          
                          {roundPhase === 'VICTIM_REVEAL' && !isRouletteSpinning && selectedVictimId && (
                               <div className="mt-12 text-center animate-pop">
                                   <div className="text-6xl font-black text-white mb-6 drop-shadow-xl">{players.find(p => p.id === selectedVictimId)?.name}</div>
                                   <button 
                                     onClick={() => onUpdateState({ roundPhase: 'MISSION_EXECUTION' })}
                                     className="mt-4 bg-red-600 hover:bg-red-500 text-white font-bold py-4 px-12 rounded-full text-2xl shadow-lg transition-transform hover:scale-105 border-4 border-red-800"
                                   >
                                       ביצוע משימה!
                                   </button>
                               </div>
                          )}
                      </div>
                  )}

                  {/* 4. Judgment Phase Overlay */}
                  {roundPhase === 'JUDGMENT' && (
                      <div className="absolute inset-0 bg-slate-900/90 z-20 flex flex-col items-center justify-center gap-12 animate-fade-in">
                          <h2 className="text-5xl font-black text-white drop-shadow-lg">האם החתן צדק?</h2>
                          <div className="flex gap-12">
                              <button onClick={() => handleJudgment(true)} className="group flex flex-col items-center gap-6 p-10 bg-green-500/10 hover:bg-green-500/20 border-4 border-green-500 rounded-3xl transition-all hover:scale-105">
                                  <CheckCircle className="w-32 h-32 text-green-500 group-hover:animate-bounce shadow-green-500 drop-shadow-lg" />
                                  <span className="text-4xl font-black text-green-400">צדק!</span>
                              </button>
                              <button onClick={() => handleJudgment(false)} className="group flex flex-col items-center gap-6 p-10 bg-red-500/10 hover:bg-red-500/20 border-4 border-red-500 rounded-3xl transition-all hover:scale-105">
                                  <XCircle className="w-32 h-32 text-red-500 group-hover:animate-shake shadow-red-500 drop-shadow-lg" />
                                  <span className="text-4xl font-black text-red-400">טעה...</span>
                              </button>
                          </div>
                      </div>
                  )}

                  {/* 5. Mission Execution Overlay */}
                  {roundPhase === 'MISSION_EXECUTION' && (
                      <div className="absolute inset-0 bg-slate-900 z-30 flex items-center justify-center p-8 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
                          <div className="w-full max-w-5xl border-4 border-yellow-500 bg-black/80 p-12 rounded-[3rem] text-center relative shadow-[0_0_100px_rgba(234,179,8,0.3)]">
                               <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-yellow-500 text-black font-black text-3xl px-12 py-4 rounded-full uppercase tracking-widest rotate-2 shadow-xl border-4 border-white">
                                   VS
                               </div>
                               
                               <div className="flex justify-between items-center mb-16 px-12">
                                   <div className="text-center w-1/3">
                                       <div className="w-40 h-40 mx-auto rounded-full border-8 border-yellow-500 overflow-hidden mb-6 shadow-2xl">
                                            {players.find(p => p.isGroom)?.photo ? (
                                                <img src={players.find(p => p.isGroom)?.photo} className="w-full h-full object-cover" />
                                            ) : <User className="w-full h-full bg-slate-800 p-4" />}
                                       </div>
                                       <h3 className="text-3xl font-black text-yellow-400 drop-shadow-md">החתן</h3>
                                   </div>
                                   
                                   <div className="w-1/3 flex flex-col items-center">
                                       <Sword className="w-32 h-32 text-red-500 animate-[pulse_0.5s_ease-in-out_infinite]" />
                                   </div>

                                   <div className="text-center w-1/3">
                                       <div className="w-40 h-40 mx-auto rounded-full border-8 border-red-500 overflow-hidden mb-6 shadow-2xl bg-slate-800 relative">
                                            {/* Show victim photo or group icon */}
                                            {players.find(p => p.id === selectedVictimId)?.photo ? (
                                                <img src={players.find(p => p.id === selectedVictimId)?.photo} className="w-full h-full object-cover grayscale" />
                                            ) : <Skull className="w-full h-full p-8 text-red-500" />}
                                       </div>
                                       <h3 className="text-3xl font-black text-red-400 drop-shadow-md">הקורבן</h3>
                                   </div>
                               </div>

                               <div className="bg-white/10 p-8 rounded-2xl border border-white/20 mb-10 backdrop-blur-sm">
                                   <h4 className="text-slate-400 text-lg uppercase tracking-wider mb-4 font-bold">השאלה הייתה:</h4>
                                   <p className="text-4xl md:text-5xl font-black text-white leading-relaxed mb-6">
                                       {currentQ.question}
                                   </p>

                                   <h4 className="text-yellow-400 text-lg uppercase tracking-wider mb-2 font-bold">תשובת החתן:</h4>
                                   <p className="text-3xl md:text-4xl font-bold text-yellow-300 leading-relaxed mb-6">
                                       {groomAnswer || currentQ.answer}
                                   </p>

                                   {activeMission && (
                                       <>
                                           <h4 className="text-slate-400 text-lg uppercase tracking-wider mb-2 font-bold">המשימה:</h4>
                                           <p className="text-2xl md:text-3xl font-black text-white leading-relaxed mb-4">
                                               {activeMission.text}
                                           </p>
                                       </>
                                   )}

                                   <div className="mt-6 text-yellow-400 font-bold text-xl animate-pulse">בצעו את המשימה עכשיו!</div>
                               </div>

                               <button onClick={nextQuestion} className="bg-gradient-to-r from-yellow-600 to-yellow-400 hover:from-yellow-500 hover:to-yellow-300 text-black font-black text-2xl py-5 px-16 rounded-full shadow-[0_10px_40px_rgba(234,179,8,0.4)] transform transition-transform hover:scale-105 flex items-center justify-center gap-4 mx-auto">
                                   <CheckCircle className="w-8 h-8" />
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
          <div className="col-span-2 bg-slate-900 border-l border-slate-800 flex flex-col z-20 shadow-2xl h-full">
              {/* Header Status */}
              <div className="p-6 bg-slate-800 border-b border-slate-700">
                  <div className="flex justify-between items-center mb-4">
                       <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">סטטוס משחק</span>
                       <div className="flex items-center gap-2">
                           {roundPhase === 'VOTING' && (
                               <>
                                   <div className="flex items-center gap-1 text-green-400 text-xs font-bold bg-green-900/30 px-3 py-1.5 rounded-lg border border-green-500/20">
                                       <ThumbsUp className="w-3 h-3" /> {Object.values(currentVotes).filter(v => v).length}
                                   </div>
                                   <div className="flex items-center gap-1 text-red-400 text-xs font-bold bg-red-900/30 px-3 py-1.5 rounded-lg border border-red-500/20">
                                       <ThumbsDown className="w-3 h-3" /> {Object.values(currentVotes).filter(v => !v).length}
                                   </div>
                               </>
                           )}
                           <span className="bg-slate-700 text-white text-xs px-3 py-1.5 rounded-full font-mono font-bold">{Object.keys(currentVotes).length}/{players.filter(p => !p.isGroom).length}</span>
                       </div>
                  </div>
                  
                  {/* Groom Answer Display Small */}
                  {groomAnswer && roundPhase !== 'GROOM_ANSWERING' && (
                      <div className="mt-2 bg-gradient-to-r from-yellow-900/40 to-slate-800 border border-yellow-500/30 p-3 rounded-xl text-center shadow-lg">
                          <span className="text-xs text-yellow-500 block mb-1 font-bold uppercase tracking-wide">תשובת החתן</span>
                          <span className="text-white font-black text-lg">{groomAnswer}</span>
                      </div>
                  )}
              </div>

              {/* Player Grid */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-900 max-h-[200px]">
                  <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-2">
                      {players.sort((a,b) => b.score - a.score).map(p => {
                          const vote = currentVotes[p.id];
                          const isVoting = roundPhase === 'VOTING';
                          const isReveal = roundPhase === 'REVEAL' || roundPhase === 'JUDGMENT' || roundPhase === 'VICTIM_SELECTION';
                          const isWinner = isReveal && groomResult !== null && vote === groomResult && !p.isGroom;
                          const isLoser = isReveal && groomResult !== null && vote !== groomResult && !p.isGroom;
                          const isVictim = selectedVictimId === p.id;

                          return (
                              <div key={p.id} className={`
                                  relative p-2 rounded-lg border flex flex-col items-center transition-all duration-300
                                  ${p.isGroom ? 'bg-gradient-to-r from-yellow-900/40 to-slate-800 border-yellow-500/50' : 'bg-slate-800 border-slate-700'}
                                  ${isWinner ? 'border-green-500 bg-green-900/20 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : ''}
                                  ${isLoser ? 'border-red-500 opacity-60' : ''}
                                  ${isVictim ? 'border-red-500 bg-red-900/50 scale-105 z-10 opacity-100' : ''}
                              `}>
                                  <div className="relative">
                                      <div className={`w-16 h-16 rounded-full bg-slate-700 overflow-hidden border-2 ${p.isBot ? 'border-slate-500 border-dashed' : 'border-slate-600'}`}>
                                          {p.photo ? <img src={p.photo} className="w-full h-full object-cover"/> : <User className="w-full h-full p-4 text-slate-400"/>}
                                      </div>
                                      {p.isGroom && <div className="absolute -top-2 -left-1 text-yellow-500 drop-shadow-md"><Crown className="w-6 h-6 fill-current"/></div>}
                                      {isVictim && <div className="absolute -bottom-1 -right-1 bg-red-600 rounded-full p-1 border border-white"><Skull className="w-3 h-3 text-white"/></div>}
                                  </div>
                                  <div className="mt-1 text-center">
                                          <div className={`font-bold text-sm ${p.isGroom ? 'text-yellow-400' : 'text-slate-200'}`}>
                                              {p.name}
                                          </div>
                                          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-1">
                                              <span className="font-mono font-bold bg-slate-950 px-1 rounded">{p.score}</span>
                                              {p.drinks > 0 && <span className="text-red-400 flex items-center"><Wine className="w-3 h-3"/> {p.drinks}</span>}
                                          </div>
                                  </div>

                                  {/* Status Icon */}
                                  <div>
                                      {isVoting && (
                                          vote !== undefined
                                            ? <div className="w-4 h-4 bg-green-500 rounded-full shadow-[0_0_10px_#22c55e] animate-pop"></div>
                                            : <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
                                      )}
                                      {isReveal && !p.isGroom && (
                                          vote !== undefined ? (
                                              <div className={`p-1.5 rounded-full ${vote ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                  {vote ? <ThumbsUp className="w-5 h-5" /> : <ThumbsDown className="w-5 h-5" />}
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

      {/* Random groom images */}
      <RandomGroomImage images={gameState.groomImages?.images || []} />
    </div>
  );
};

export default GamePhase;