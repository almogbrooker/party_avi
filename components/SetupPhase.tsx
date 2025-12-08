
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Mission, QAPair, VideoAsset } from '../types';
import { Video, ListTodo, PlayCircle, Loader2, Smartphone, Monitor, ArrowRight, UserPlus, Clock, Trash2, Plus, Play, Crown, Camera, Image as ImageIcon, X, Aperture, User, Save, Upload, FileJson, Sparkles, Check, GripVertical, Settings2, Timer, AlertCircle } from 'lucide-react';
import { analyzeVideoForQA } from '../services/geminiService';

interface SetupPhaseProps {
  onHostGame: (videos: Record<string, File>, missions: Mission[], questions: QAPair[]) => void;
  onJoinGame: (name: string, code: string, isGroom?: boolean, photo?: string) => void;
  isLoading: boolean;
  isJoining: boolean;
  initialCode?: string;
  initialRole?: 'PLAYER' | 'GROOM';
}

const PREDEFINED_MISSIONS = [
  "לרקוד עם הכסא דקה שלמה בחושניות",
  "לעשות חיקוי של החתן מתעצבן",
  "לשלוח הודעה מביכה לאקסית (החתן בוחר ניסוח)",
  "לרדת ל-20 שכיבות סמיכה",
  "לשתות כוס מים ללא ידיים",
  "לספר בדיחה גסה",
  "לשיר שיר של סטטיק ובן אל",
  "לעשות סלפי עם המלצרית/ברמן",
  "לנשק את הקרחת/מצח של החתן",
  "לעשות מסאז' לחתן דקה",
  "לנאום נאום של דקה למה החתן בחר גרוע",
  "להדגים איך הכלה רוקדת",
  "להתקשר לאמא ולהגיד לה שאתה מתחתן מחר",
  "לעשות גלגלון (או לנסות)",
  "לדבר במבטא צרפתי עד הסיבוב הבא",
  "להוריד חולצה"
];

const SetupPhase: React.FC<SetupPhaseProps> = ({ 
    onHostGame, 
    onJoinGame, 
    isLoading, 
    isJoining,
    initialCode = '',
    initialRole = 'PLAYER' 
}) => {
  const [mode, setMode] = useState<'SELECT' | 'HOST_SETUP' | 'JOIN'>('SELECT');
  const [setupStep, setSetupStep] = useState<1 | 2>(1); // 1 = Videos & Questions, 2 = Missions
  
  // HOST STATE
  const [videoAssets, setVideoAssets] = useState<VideoAsset[]>([]);
  const [questions, setQuestions] = useState<QAPair[]>([]);
  const [missions, setMissions] = useState<Mission[]>([
    { id: 'm1', text: 'לרקוד עם הכסא דקה שלמה בחושניות' },
    { id: 'm2', text: 'לעשות חיקוי של החתן' },
    { id: 'm3', text: 'לשתות כוס מים ללא ידיים' },
  ]);
  const [missionInput, setMissionInput] = useState('');

  // EDITOR STATE
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [analyzingVideoId, setAnalyzingVideoId] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string>(''); // Text feedback for loading
  const [elapsedTime, setElapsedTime] = useState(0); // Timer for long operations
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);

  // JOIN STATE
  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState(initialCode);
  const [isGroom, setIsGroom] = useState(initialRole === 'GROOM');
  const [joinPhoto, setJoinPhoto] = useState<string | undefined>(undefined);
  
  // CAMERA STATE
  const [showCamera, setShowCamera] = useState(false);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Auto-switch to join mode if code is provided
  useEffect(() => {
    if (initialCode) {
      setMode('JOIN');
      setJoinCode(initialCode);
      if (initialRole === 'GROOM') {
          setIsGroom(true);
          setJoinName('החתן');
      }
    }
  }, [initialCode, initialRole]);

  // Ensure a video is always selected if available
  useEffect(() => {
    if (!activeVideoId && videoAssets.length > 0) {
      setActiveVideoId(videoAssets[0].id);
    }
  }, [videoAssets, activeVideoId]);

  // Timer for analysis
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (analyzingVideoId) {
        setElapsedTime(0);
        interval = setInterval(() => {
            setElapsedTime(prev => prev + 1);
        }, 1000);
    }
    return () => {
        if (interval) clearInterval(interval);
    };
  }, [analyzingVideoId]);

  // Memoized URL for the active video to prevent re-renders of the video element
  const activeVideoUrl = useMemo(() => {
      const vid = videoAssets.find(v => v.id === activeVideoId);
      return vid ? URL.createObjectURL(vid.file) : null;
  }, [activeVideoId, videoAssets]);

  // Cleanup object URLs when component unmounts
  useEffect(() => {
      return () => {
          if (activeVideoUrl) URL.revokeObjectURL(activeVideoUrl);
      };
  }, [activeVideoUrl]);


  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const newVideoId = `v-${Date.now()}`;
      
      const newAsset: VideoAsset = {
          id: newVideoId,
          file: file,
          name: file.name
      };

      setVideoAssets(prev => [...prev, newAsset]);
      setActiveVideoId(newVideoId); // Switch to the new video immediately
      
      // Auto analyze
      setAnalyzingVideoId(newVideoId);
      setAnalysisStatus('מתחיל העלאה...');
      try {
          const newQuestions = await analyzeVideoForQA(file, newVideoId, (status) => setAnalysisStatus(status));
          setQuestions(prev => [...prev, ...newQuestions]);
      } catch (err) {
          console.error(err);
          // Don't show alert if it was just skipped/cancelled (we might add specific error types later)
      } finally {
          setAnalyzingVideoId(null);
          setAnalysisStatus('');
          setElapsedTime(0);
      }
    }
  };

  const removeVideo = (id: string) => {
      setVideoAssets(prev => prev.filter(v => v.id !== id));
      setQuestions(prev => prev.filter(q => q.videoId !== id));
      if (activeVideoId === id) {
          // Switch to another video or null
          const remaining = videoAssets.filter(v => v.id !== id);
          setActiveVideoId(remaining.length > 0 ? remaining[0].id : null);
      }
  };

  const skipAnalysis = () => {
      setAnalyzingVideoId(null);
      setAnalysisStatus('');
      setElapsedTime(0);
      // Ensure we still have the video selected so they can manual edit
      if (!activeVideoId && videoAssets.length > 0) {
          setActiveVideoId(videoAssets[videoAssets.length - 1].id);
      }
  };

  // Editor Functions
  const handleUpdateQuestion = (id: string, field: keyof QAPair, value: any) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const handleAddQuestion = () => {
    const targetVideoId = activeVideoId || (videoAssets.length > 0 ? videoAssets[0].id : null);
    
    if (!targetVideoId) {
        alert("נא להעלות סרטון קודם");
        return;
    }

    const newQ: QAPair = {
        id: `manual-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        videoId: targetVideoId,
        question: 'שאלה חדשה',
        answer: 'תשובה',
        qStart: currentVideoTime,
        qEnd: currentVideoTime + 5,
        aStart: currentVideoTime + 5,
        aEnd: currentVideoTime + 10,
        timestampStr: formatTime(currentVideoTime)
    };
    setQuestions(prev => [...prev, newQ]);
  };

  const captureTimestamp = (qId: string, field: 'qStart' | 'qEnd' | 'aStart' | 'aEnd') => {
      if (!videoRef.current) return;
      const time = videoRef.current.currentTime;
      handleUpdateQuestion(qId, field, time);
      
      // Auto-update display string if start time changed
      if (field === 'qStart') {
          handleUpdateQuestion(qId, 'timestampStr', formatTime(time));
      }
  };

  const seekTo = (time: number) => {
      if (videoRef.current) {
          videoRef.current.currentTime = time;
          // Don't auto play, just seek
      }
  };

  // Mission Functions
  const addMission = () => {
    if (missionInput.trim()) {
      setMissions([...missions, { id: Date.now().toString(), text: missionInput.trim() }]);
      setMissionInput('');
    }
  };

  const addPredefinedMission = (text: string) => {
      if (!missions.find(m => m.text === text)) {
          setMissions([...missions, { id: Date.now().toString(), text }]);
      }
  };

  const removeMission = (id: string) => {
    setMissions(missions.filter(m => m.id !== id));
  };

  // Final Start
  const handleHostStart = () => {
      if (videoAssets.length === 0 || questions.length === 0) {
          alert("חובה להעלות לפחות סרטון אחד ושאלה אחת.");
          return;
      }
      
      // Convert assets to map
      const videoMap: Record<string, File> = {};
      videoAssets.forEach(v => videoMap[v.id] = v.file);
      
      onHostGame(videoMap, missions, questions);
  };

  // Save/Load Config
  const saveConfig = () => {
      const config = {
          questions,
          missions,
          savedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bachelor-game-config.json`;
      a.click();
      URL.revokeObjectURL(url);
  };

  const handleConfigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const config = JSON.parse(event.target?.result as string);
                if (config.questions) setQuestions(config.questions);
                if (config.missions) setMissions(config.missions);
                alert("הגדרות נטענו! כעת העלה את הסרטונים המתאימים.");
            } catch (err) {
                alert("קובץ לא תקין");
            }
        };
        reader.readAsText(file);
    }
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ---------------- RENDER HELPERS ----------------

  const renderVideoManager = () => (
      <div className="space-y-4">
          <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Video className="w-5 h-5 text-purple-400" />
                  ניהול סרטונים
              </h3>
              <label className="cursor-pointer bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  הוסף סרטון
                  <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
              </label>
          </div>
          
          <div className="space-y-2">
              {videoAssets.map((video, index) => (
                  <div 
                    key={video.id} 
                    onClick={() => setActiveVideoId(video.id)}
                    className={`p-3 rounded-lg border flex flex-col justify-between cursor-pointer transition-colors ${activeVideoId === video.id ? 'bg-purple-900/40 border-purple-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                  >
                      <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3 overflow-hidden">
                              <span className="bg-slate-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{index + 1}</span>
                              <span className="truncate text-sm text-slate-300">{video.name}</span>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); removeVideo(video.id); }} className="text-slate-500 hover:text-red-400">
                              <Trash2 className="w-4 h-4" />
                          </button>
                      </div>
                      
                      {/* Analysis Status */}
                      {analyzingVideoId === video.id && (
                          <div className="mt-2 text-xs bg-slate-900/50 p-2 rounded border border-slate-700">
                             <div className="flex items-center gap-2 text-purple-400 animate-pulse mb-2">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span className="font-bold">{analysisStatus}</span>
                             </div>
                             <div className="flex justify-between items-center">
                                 <span className="text-[10px] text-slate-500">זמן עבר: {elapsedTime}s</span>
                                 <button onClick={(e) => { e.stopPropagation(); skipAnalysis(); }} className="text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-white">
                                     דלג על ניתוח (עריכה ידנית)
                                 </button>
                             </div>
                          </div>
                      )}
                  </div>
              ))}
              {videoAssets.length === 0 && (
                  <div className="text-center p-8 border-2 border-dashed border-slate-700 rounded-xl text-slate-500">
                      אין סרטונים. העלה סרטון ראשון כדי להתחיל.
                  </div>
              )}
          </div>

          {/* Config Load */}
          <div className="mt-8 pt-6 border-t border-slate-700">
             <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">יש לך קובץ שמור?</span>
                <label className="text-blue-400 hover:text-blue-300 text-sm cursor-pointer flex items-center gap-1">
                    <Upload className="w-4 h-4" />
                    טען הגדרות
                    <input type="file" accept=".json" onChange={handleConfigUpload} className="hidden" />
                </label>
             </div>
          </div>
      </div>
  );

  const renderEditor = () => {
      // Find active video details
      const activeVideo = videoAssets.find(v => v.id === activeVideoId);
      const activeQuestions = questions.filter(q => q.videoId === activeVideoId);

      // If no video selected or available
      if (!activeVideoId || !activeVideo) {
          return (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 min-h-[400px]">
                  <FilmIcon className="w-16 h-16 mb-4 opacity-20" />
                  <p>בחר סרטון מהרשימה בצד ימין כדי לערוך</p>
              </div>
          );
      }

      return (
          <div className="space-y-6">
              {/* Video Player */}
              <div className="bg-black rounded-xl overflow-hidden aspect-video border border-slate-700 sticky top-4 shadow-2xl relative z-10 group">
                   {activeVideoUrl ? (
                       <video 
                            ref={videoRef}
                            src={activeVideoUrl}
                            controls
                            className="w-full h-full object-contain"
                            playsInline
                            // Add these to help with compatibility
                            preload="metadata"
                            onTimeUpdate={() => videoRef.current && setCurrentVideoTime(videoRef.current.currentTime)}
                       />
                   ) : (
                       <div className="flex items-center justify-center h-full text-white">טוען וידאו...</div>
                   )}
                   <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-xs font-mono text-white pointer-events-none">
                       {formatTime(currentVideoTime)}
                   </div>
                   
                   {/* Overlay info if analyzing */}
                   {analyzingVideoId === activeVideoId && (
                       <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white z-20">
                            <Loader2 className="w-10 h-10 animate-spin mb-2 text-purple-500" />
                            <p>{analysisStatus}</p>
                            <p className="text-xs text-slate-400 mt-2">{elapsedTime}s</p>
                       </div>
                   )}
              </div>

              {/* Questions List */}
              <div className="space-y-4 pb-20">
                  <div className="flex justify-between items-end">
                      <h4 className="text-lg font-bold text-white">שאלות בסרטון זה ({activeQuestions.length})</h4>
                      <button onClick={handleAddQuestion} className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 hover:text-purple-300 text-sm font-bold flex items-center gap-2 py-2 px-4 rounded-lg border border-purple-500/50 transition-colors">
                          <Plus className="w-4 h-4" /> הוסף שאלה ידנית
                      </button>
                  </div>
                  
                  {activeQuestions.map((q, i) => (
                      <div key={q.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-purple-500/50 transition-all group">
                          {/* Inputs */}
                          <div className="grid grid-cols-1 gap-3 mb-3">
                              <input 
                                  value={q.question}
                                  onChange={(e) => handleUpdateQuestion(q.id, 'question', e.target.value)}
                                  className="bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm focus:border-purple-500 w-full font-bold"
                                  placeholder="כתוב את השאלה כאן..."
                              />
                              <input 
                                  value={q.answer}
                                  onChange={(e) => handleUpdateQuestion(q.id, 'answer', e.target.value)}
                                  className="bg-slate-900 border border-slate-700 rounded p-2 text-slate-300 text-sm focus:border-green-500 w-full"
                                  placeholder="כתוב את התשובה כאן..."
                              />
                          </div>

                          {/* Timeline Editor */}
                          <div className="bg-slate-900/50 p-2 rounded-lg grid grid-cols-2 gap-2 text-xs">
                              {/* Question Timing */}
                              <div className="space-y-1">
                                  <div className="text-blue-400 font-bold mb-1 flex items-center gap-1">
                                      <Settings2 className="w-3 h-3" /> מקטע שאלה
                                  </div>
                                  <div className="flex items-center gap-1">
                                      <span className="w-8 text-slate-500">התחלה:</span>
                                      <span onClick={() => seekTo(q.qStart)} className="cursor-pointer font-mono hover:text-white bg-slate-800 px-1 rounded transition-colors">{formatTime(q.qStart)}</span>
                                      <button onClick={() => captureTimestamp(q.id, 'qStart')} className="p-1 hover:bg-blue-500/20 text-blue-400 rounded transition-colors" title="קבע זמן נוכחי"><Clock className="w-3 h-3"/></button>
                                  </div>
                                  <div className="flex items-center gap-1">
                                      <span className="w-8 text-slate-500">סיום:</span>
                                      <span onClick={() => seekTo(q.qEnd)} className="cursor-pointer font-mono hover:text-white bg-slate-800 px-1 rounded transition-colors">{formatTime(q.qEnd)}</span>
                                      <button onClick={() => captureTimestamp(q.id, 'qEnd')} className="p-1 hover:bg-blue-500/20 text-blue-400 rounded transition-colors" title="קבע זמן נוכחי"><Clock className="w-3 h-3"/></button>
                                  </div>
                              </div>

                              {/* Answer Timing */}
                              <div className="space-y-1 border-r border-slate-700 pr-2">
                                  <div className="text-green-400 font-bold mb-1 flex items-center gap-1">
                                      <Settings2 className="w-3 h-3" /> מקטע תשובה
                                  </div>
                                  <div className="flex items-center gap-1">
                                      <span className="w-8 text-slate-500">התחלה:</span>
                                      <span onClick={() => seekTo(q.aStart)} className="cursor-pointer font-mono hover:text-white bg-slate-800 px-1 rounded transition-colors">{formatTime(q.aStart)}</span>
                                      <button onClick={() => captureTimestamp(q.id, 'aStart')} className="p-1 hover:bg-green-500/20 text-green-400 rounded transition-colors" title="קבע זמן נוכחי"><Clock className="w-3 h-3"/></button>
                                  </div>
                                  <div className="flex items-center gap-1">
                                      <span className="w-8 text-slate-500">סיום:</span>
                                      <span onClick={() => seekTo(q.aEnd)} className="cursor-pointer font-mono hover:text-white bg-slate-800 px-1 rounded transition-colors">{formatTime(q.aEnd)}</span>
                                      <button onClick={() => captureTimestamp(q.id, 'aEnd')} className="p-1 hover:bg-green-500/20 text-green-400 rounded transition-colors" title="קבע זמן נוכחי"><Clock className="w-3 h-3"/></button>
                                  </div>
                              </div>
                          </div>

                          <div className="flex justify-end mt-2">
                              <button onClick={() => handleDeleteQuestion(q.id)} className="text-red-500 hover:text-red-400 text-xs flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                                  <Trash2 className="w-3 h-3" /> מחק שאלה
                              </button>
                          </div>
                      </div>
                  ))}
                  
                  {activeQuestions.length === 0 && (
                      <div className="text-center text-slate-500 p-4 border border-dashed border-slate-700 rounded-lg">
                          לחץ על "הוסף שאלה ידנית" כדי להתחיל
                      </div>
                  )}
              </div>
          </div>
      );
  };

  const renderMissionsStep = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full pb-20">
          <div className="flex flex-col h-full bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
               <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                   <ListTodo className="w-5 h-5 text-pink-500" />
                   המשימות שנבחרו ({missions.length})
               </h3>
               
               <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={missionInput}
                    onChange={(e) => setMissionInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addMission()}
                    placeholder="כתוב משימה אישית..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-pink-500"
                  />
                  <button onClick={addMission} className="bg-pink-600 hover:bg-pink-500 text-white px-4 rounded-lg font-bold">הוסף</button>
               </div>

               <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                   {missions.map(m => (
                       <div key={m.id} className="bg-slate-900 p-3 rounded-lg border border-slate-700 flex justify-between items-center group hover:border-pink-500/30">
                           <span className="text-sm text-slate-200">{m.text}</span>
                           <button onClick={() => removeMission(m.id)} className="text-slate-600 hover:text-red-500"><X className="w-4 h-4"/></button>
                       </div>
                   ))}
                   {missions.length === 0 && <div className="text-center text-slate-500 mt-10">אין משימות. בחר מהרשימה או הוסף לבד.</div>}
               </div>
          </div>

          <div className="flex flex-col h-full bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
               <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                   <Sparkles className="w-5 h-5 text-yellow-500" />
                   מאגר רעיונות
               </h3>
               <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                    {PREDEFINED_MISSIONS.map((text, i) => {
                         const isSelected = missions.some(m => m.text === text);
                         return (
                            <button 
                                key={i} 
                                onClick={() => !isSelected && addPredefinedMission(text)}
                                disabled={isSelected}
                                className={`w-full text-right p-3 rounded-lg border flex justify-between items-center transition-all ${isSelected ? 'bg-slate-900/50 border-transparent text-slate-600 cursor-default' : 'bg-slate-900 border-slate-700 hover:border-yellow-500/50 text-slate-300'}`}
                            >
                                <span className="text-sm">{text}</span>
                                {!isSelected && <Plus className="w-4 h-4 text-slate-500" />}
                            </button>
                         );
                    })}
               </div>
          </div>
      </div>
  );

  // Helper icon for empty state
  const FilmIcon = ({ className }: { className?: string }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
      </svg>
  );

  // ---------------- MAIN RENDER ----------------

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center animate-fade-in">
        <Loader2 className="w-20 h-20 text-purple-400 animate-spin" />
        <h2 className="text-2xl font-bold text-white">טוען...</h2>
      </div>
    );
  }

  // --- JOIN SCREEN ---
  if (mode === 'JOIN') {
      // (Reusing existing join screen logic for brevity, just wrapping the return)
      return (
      <div className="max-w-md mx-auto w-full px-4 pt-10">
        {showCamera && (
            <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
                <div className="relative w-full max-w-md aspect-square bg-black overflow-hidden rounded-2xl border-2 border-slate-700">
                    <video ref={cameraVideoRef} className="w-full h-full object-cover transform -scale-x-100" autoPlay playsInline muted />
                    <button 
                        onClick={() => {
                            if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
                            setShowCamera(false);
                        }} 
                        className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full z-10"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="mt-8 flex gap-6">
                    <button 
                        onClick={() => {
                            if (cameraVideoRef.current) {
                                const video = cameraVideoRef.current;
                                const canvas = document.createElement('canvas');
                                const size = Math.min(video.videoWidth, video.videoHeight);
                                canvas.width = 150; canvas.height = 150;
                                const ctx = canvas.getContext('2d');
                                if (ctx) {
                                    const startX = (video.videoWidth - size) / 2;
                                    const startY = (video.videoHeight - size) / 2;
                                    ctx.translate(150, 0); ctx.scale(-1, 1);
                                    ctx.drawImage(video, startX, startY, size, size, 0, 0, 150, 150);
                                    setJoinPhoto(canvas.toDataURL('image/jpeg', 0.8));
                                    if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
                                    setShowCamera(false);
                                }
                            }
                        }} 
                        className="w-20 h-20 rounded-full border-4 border-white bg-transparent flex items-center justify-center hover:bg-white/10 transition-colors"
                    >
                        <div className="w-16 h-16 rounded-full bg-white"></div>
                    </button>
                </div>
                <p className="mt-4 text-slate-400">צלם תמונה</p>
            </div>
        )}

        {!initialCode && (
            <button onClick={() => setMode('SELECT')} className="flex items-center text-slate-400 hover:text-white mb-8">
            <ArrowRight className="w-4 h-4 ml-2" />
            חזרה
            </button>
        )}
        <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-xl space-y-6">
           <div className="text-center flex flex-col items-center">
             <div className="relative mb-6 group cursor-pointer" onClick={async () => {
                 try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                    setCameraStream(stream);
                    setShowCamera(true);
                    setTimeout(() => { if (cameraVideoRef.current) { cameraVideoRef.current.srcObject = stream; cameraVideoRef.current.play(); } }, 100);
                 } catch (e) { alert("נדרשת גישה למצלמה"); }
             }}>
                {isGroom && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-yellow-500 animate-bounce z-10">
                        <Crown className="w-8 h-8" />
                    </div>
                )}
                <div className={`relative w-28 h-28 rounded-full overflow-hidden shadow-2xl transition-transform transform group-hover:scale-105 ${isGroom ? 'border-4 border-yellow-400 bg-yellow-900/20' : 'border-4 border-blue-400 bg-slate-700'}`}>
                    {joinPhoto ? (
                        <img src={joinPhoto} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            {isGroom ? <UserPlus className="w-12 h-12 text-yellow-400/50" /> : <User className="w-12 h-12 text-slate-500" />}
                        </div>
                    )}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <Camera className="w-8 h-8 text-white" />
                    </div>
                </div>
             </div>
             <h2 className="text-2xl font-bold text-white mt-2">{isGroom ? 'כניסת חתן' : 'הצטרפות למשחק'}</h2>
           </div>
           <div className="space-y-4">
             <div>
               <label className="block text-sm font-medium text-slate-400 mb-1">השם שלך</label>
               <input type="text" value={joinName} onChange={(e) => setJoinName(e.target.value)} readOnly={isGroom} className={`w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white ${isGroom ? 'text-yellow-400 font-bold text-center' : ''}`} placeholder="שם..." />
             </div>
             <div>
               <label className="block text-sm font-medium text-slate-400 mb-1">קוד משחק</label>
               <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} readOnly={!!initialCode} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-center font-mono text-lg" placeholder="ABCD" maxLength={6} />
             </div>
           </div>
           <button onClick={() => onJoinGame(joinName, joinCode, isGroom, joinPhoto)} disabled={!joinName || !joinCode} className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg ${isGroom ? 'bg-gradient-to-r from-yellow-600 to-orange-600' : 'bg-blue-600 hover:bg-blue-500'}`}>
             {isGroom ? 'אני מוכן!' : 'הכנס למשחק'}
           </button>
        </div>
      </div>
    );
  }

  // --- HOST SETUP SCREEN (STEPPER) ---
  if (mode === 'HOST_SETUP') {
      return (
          <div className="max-w-7xl mx-auto h-screen flex flex-col pb-6">
              {/* Stepper Header */}
              <div className="flex items-center justify-between mb-4 px-4 pt-6 shrink-0">
                  <h2 className="text-2xl font-bold text-white">הכנת המשחק</h2>
                  <div className="flex items-center gap-4">
                      <div className={`flex items-center gap-2 ${setupStep === 1 ? 'text-purple-400 font-bold' : 'text-slate-500'}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${setupStep === 1 ? 'border-purple-400 bg-purple-900' : 'border-slate-600'}`}>1</div>
                          <span>וידאו ושאלות</span>
                      </div>
                      <div className="w-12 h-px bg-slate-700"></div>
                      <div className={`flex items-center gap-2 ${setupStep === 2 ? 'text-pink-400 font-bold' : 'text-slate-500'}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${setupStep === 2 ? 'border-pink-400 bg-pink-900' : 'border-slate-600'}`}>2</div>
                          <span>משימות</span>
                      </div>
                  </div>
                  <div>
                      <button onClick={saveConfig} className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
                          <Save className="w-4 h-4" /> שמור
                      </button>
                  </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 overflow-hidden bg-slate-900/50 border border-slate-700 rounded-2xl p-6 relative">
                  
                  {setupStep === 1 && (
                      <div className="grid grid-cols-12 gap-6 h-full">
                          {/* Sidebar: Videos */}
                          <div className="col-span-3 border-l border-slate-700 pl-4 h-full overflow-y-auto custom-scrollbar">
                              {renderVideoManager()}
                          </div>
                          {/* Main: Editor */}
                          <div className="col-span-9 h-full overflow-y-auto custom-scrollbar pr-2 pb-20">
                              {renderEditor()}
                          </div>
                      </div>
                  )}

                  {setupStep === 2 && renderMissionsStep()}

              </div>

              {/* Footer Actions - Sticky Bottom */}
              <div className="mt-4 flex justify-between items-center px-4 shrink-0 bg-slate-900 py-2 border-t border-slate-800">
                  {setupStep === 1 ? (
                      <button onClick={() => setMode('SELECT')} className="text-slate-400 hover:text-white">ביטול</button>
                  ) : (
                      <button onClick={() => setSetupStep(1)} className="text-slate-400 hover:text-white flex items-center gap-2">
                          <ArrowRight className="w-4 h-4" /> חזרה לוידאו
                      </button>
                  )}

                  {setupStep === 1 ? (
                      <div className="flex items-center gap-4">
                          {questions.length === 0 && <span className="text-red-400 text-sm font-medium animate-pulse">הוסף לפחות שאלה אחת כדי להמשיך</span>}
                          <button 
                            onClick={() => setSetupStep(2)}
                            disabled={questions.length === 0}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                          >
                              המשך למשימות <ArrowRight className="w-4 h-4 rotate-180" />
                          </button>
                      </div>
                  ) : (
                      <button 
                        onClick={handleHostStart}
                        className="bg-green-600 hover:bg-green-500 text-white px-10 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-green-900/20"
                      >
                          <PlayCircle className="w-6 h-6" />
                          התחל את המסיבה!
                      </button>
                  )}
              </div>
          </div>
      );
  }

  // --- SELECT MODE ---
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12">
        <div className="text-center space-y-4">
           <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
            המשחק של החתן
          </h1>
          <p className="text-2xl text-slate-300">האם החתן מכיר את הכלה?</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl px-4">
          <button onClick={() => setMode('HOST_SETUP')} className="group relative bg-slate-800 hover:bg-slate-700 p-8 rounded-3xl border border-slate-700 hover:border-purple-500 transition-all text-right">
            <div className="absolute top-4 left-4 p-3 bg-purple-500/20 rounded-full group-hover:bg-purple-500/30">
               <Monitor className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">אני המארח</h3>
            <p className="text-slate-400">הכנת סרטונים, שאלות ומשימות.</p>
          </button>

          <button onClick={() => setMode('JOIN')} className="group relative bg-slate-800 hover:bg-slate-700 p-8 rounded-3xl border border-slate-700 hover:border-blue-500 transition-all text-right">
             <div className="absolute top-4 left-4 p-3 bg-blue-500/20 rounded-full group-hover:bg-blue-500/30">
               <Smartphone className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">אני שחקן</h3>
            <p className="text-slate-400">הכנס קוד להצטרפות למשחק.</p>
          </button>
        </div>
    </div>
  );
};

export default SetupPhase;
