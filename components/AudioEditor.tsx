import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Scissors, RotateCcw, Volume2, Save, X, Youtube, Link, Download } from 'lucide-react';

export interface AudioClipConfig {
  file?: File;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  startTime: number; // seconds
  endTime: number; // seconds
  duration: number; // How long to play
  volume: number; // 0-1
  fadeIn?: number; // seconds
  fadeOut?: number; // seconds
}

interface AudioEditorProps {
  file?: File;
  youtubeUrl?: string;
  onSave: (config: AudioClipConfig) => void;
  onClose: () => void;
  initialConfig?: Partial<AudioClipConfig>;
}

export const AudioEditor: React.FC<AudioEditorProps> = ({
  file,
  youtubeUrl,
  onSave,
  onClose,
  initialConfig
}) => {
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // YouTube state
  const [youtubeInputUrl, setYoutubeInputUrl] = useState(youtubeUrl || '');
  const [youtubeVideoId, setYoutubeVideoId] = useState('');
  const [isYoutubeMode, setIsYoutubeMode] = useState(!file);
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [youtubeThumbnail, setYoutubeThumbnail] = useState('');
  const [isProcessingYoutube, setIsProcessingYoutube] = useState(false);

  // Trim controls
  const [startTime, setStartTime] = useState(initialConfig?.startTime || 0);
  const [endTime, setEndTime] = useState(initialConfig?.endTime || 0);
  const [playDuration, setPlayDuration] = useState(initialConfig?.duration || 5);
  const [volume, setVolume] = useState(initialConfig?.volume || 0.5);

  // Waveform data
  const [waveform, setWaveform] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  // Extract YouTube video ID from URL
  const extractYouTubeId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // Load YouTube video info
  const loadYouTubeVideo = async () => {
    const videoId = extractYouTubeId(youtubeInputUrl);
    if (!videoId) {
      alert('Invalid YouTube URL');
      return;
    }

    setIsProcessingYoutube(true);
    setYoutubeVideoId(videoId);

    try {
      // Get video info using oembed
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const response = await fetch(oembedUrl);
      const data = await response.json();

      setYoutubeTitle(data.title);
      setYoutubeThumbnail(data.thumbnail_url);

      // For now, we'll simulate duration (in a real implementation, you'd use YouTube API)
      // This is a placeholder - you'd need YouTube Data API for actual duration
      setDuration(180); // Assume 3 minutes for demo

      setIsLoading(false);
      setIsYoutubeMode(true);
    } catch (error) {
      console.error('Error loading YouTube video:', error);
      alert('Failed to load YouTube video. Please check the URL.');
    } finally {
      setIsProcessingYoutube(false);
    }
  };

  // Load local audio file
  useEffect(() => {
    if (file && !isYoutubeMode) {
      const audioElement = new Audio(URL.createObjectURL(file));
      audioElement.addEventListener('loadedmetadata', () => {
        setDuration(audioElement.duration);
        setEndTime(audioElement.duration);
        setIsLoading(false);
      });

      audioElement.addEventListener('timeupdate', () => {
        setCurrentTime(audioElement.currentTime);
      });

      audioElement.addEventListener('ended', () => {
        setIsPlaying(false);
      });

      setAudio(audioElement);
      generateWaveform(audioElement);

      return () => {
        URL.revokeObjectURL(audioElement.src);
      };
    }
  }, [file, isYoutubeMode]);

  const generateWaveform = async (audioElement: HTMLAudioElement) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const response = await fetch(audioElement.src);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const rawData = audioBuffer.getChannelData(0);
      const samples = 500;
      const blockSize = Math.floor(rawData.length / samples);
      const filteredData = [];

      for (let i = 0; i < samples; i++) {
        const blockStart = blockSize * i;
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[blockStart + j]);
        }
        filteredData.push(sum / blockSize);
      }

      setWaveform(filteredData);
    } catch (error) {
      console.error('Error generating waveform:', error);
      const fallback = Array(500).fill(0).map(() => Math.random() * 0.8);
      setWaveform(fallback);
    }
  };

  const drawWaveform = useCallback(() => {
    if (!canvasRef.current || waveform.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw waveform
    ctx.fillStyle = '#64748b';
    const barWidth = width / waveform.length;

    waveform.forEach((value, index) => {
      const barHeight = value * height;
      const x = index * barWidth;
      const y = (height - barHeight) / 2;
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });

    // Draw selection area
    ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
    const startX = (startTime / duration) * width;
    const endX = (endTime / duration) * width;
    ctx.fillRect(startX, 0, endX - startX, height);

    // Draw playhead
    if (isPlaying) {
      ctx.fillStyle = '#ef4444';
      const playheadX = (currentTime / duration) * width;
      ctx.fillRect(playheadX, 0, 2, height);
    }
  }, [waveform, startTime, endTime, currentTime, duration, isPlaying]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  const togglePlay = () => {
    if (isYoutubeMode) {
      // YouTube playback (simplified - would need YouTube IFrame API in production)
      alert('YouTube playback would use YouTube IFrame API here');
      return;
    }

    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.currentTime = startTime;
      audio.play();
      setIsPlaying(true);

      setTimeout(() => {
        if (audio && isPlaying) {
          audio.pause();
          setIsPlaying(false);
        }
      }, Math.min(playDuration * 1000, (endTime - startTime) * 1000));
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !duration) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const time = percent * duration;

    if (e.shiftKey) {
      setEndTime(Math.min(time, duration));
    } else {
      setStartTime(Math.max(0, time));
    }
  };

  const resetTrim = () => {
    setStartTime(0);
    setEndTime(duration);
    setPlayDuration(5);
    setVolume(0.5);
  };

  const handleSave = () => {
    const config: AudioClipConfig = {
      file: isYoutubeMode ? undefined : file,
      youtubeUrl: isYoutubeMode ? youtubeInputUrl : undefined,
      youtubeVideoId: isYoutubeMode ? youtubeVideoId : undefined,
      startTime,
      endTime,
      duration: playDuration,
      volume,
      fadeIn: 0.5,
      fadeOut: 0.5
    };
    onSave(config);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading && !isYoutubeMode) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-slate-800 rounded-xl p-6 text-white">
          <p>Loading audio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold text-white flex items-center gap-2">
            {isYoutubeMode ? <Youtube className="w-6 h-6 text-red-500" /> : <Volume2 className="w-6 h-6" />}
            Edit Audio
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Source Selection */}
        <div className="mb-6">
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => setIsYoutubeMode(false)}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                !isYoutubeMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Download className="w-4 h-4 inline mr-2" />
              Upload File
            </button>
            <button
              onClick={() => setIsYoutubeMode(true)}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                isYoutubeMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Youtube className="w-4 h-4 inline mr-2" />
              YouTube
            </button>
          </div>

          {/* YouTube Input */}
          {isYoutubeMode && !youtubeVideoId && (
            <div className="flex gap-2">
              <input
                type="url"
                value={youtubeInputUrl}
                onChange={(e) => setYoutubeInputUrl(e.target.value)}
                placeholder="Paste YouTube URL here..."
                className="flex-1 bg-slate-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={loadYouTubeVideo}
                disabled={isProcessingYoutube || !youtubeInputUrl}
                className="bg-red-600 hover:bg-red-700 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                {isProcessingYoutube ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Link className="w-4 h-4" />
                )}
                Load
              </button>
            </div>
          )}

          {/* YouTube Preview */}
          {isYoutubeMode && youtubeVideoId && (
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="flex gap-4">
                <img
                  src={youtubeThumbnail}
                  alt={youtubeTitle}
                  className="w-32 h-24 object-cover rounded"
                />
                <div className="flex-1">
                  <h4 className="text-white font-medium mb-1">{youtubeTitle}</h4>
                  <p className="text-slate-400 text-sm">YouTube Video</p>
                </div>
              </div>
            </div>
          )}

          {/* File Info */}
          {!isYoutubeMode && file && (
            <div className="bg-slate-700 rounded-lg p-4">
              <p className="text-white font-medium">{file.name}</p>
              <p className="text-slate-400 text-sm">Local file</p>
            </div>
          )}
        </div>

        {(!isYoutubeMode && file) || (isYoutubeMode && youtubeVideoId) ? (
          <>
            {/* Waveform Display */}
            <div className="mb-6">
              <canvas
                ref={canvasRef}
                width={800}
                height={200}
                className="w-full h-48 bg-slate-900 rounded-lg cursor-pointer"
                onClick={handleCanvasClick}
              />
              <p className="text-slate-400 text-sm mt-2">
                Click to set start time, Shift+Click to set end time
              </p>
            </div>

            {/* Time Display */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-700 rounded-lg p-3">
                <p className="text-slate-400 text-sm">Start Time</p>
                <p className="text-white font-mono">{formatTime(startTime)}</p>
              </div>
              <div className="bg-slate-700 rounded-lg p-3">
                <p className="text-slate-400 text-sm">End Time</p>
                <p className="text-white font-mono">{formatTime(endTime)}</p>
              </div>
              <div className="bg-slate-700 rounded-lg p-3">
                <p className="text-slate-400 text-sm">Duration</p>
                <p className="text-white font-mono">{formatTime(endTime - startTime)}</p>
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-slate-300 text-sm block mb-2">
                  Start Time: {formatTime(startTime)}
                </label>
                <input
                  type="range"
                  min="0"
                  max={duration}
                  step="0.1"
                  value={startTime}
                  onChange={(e) => setStartTime(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-slate-300 text-sm block mb-2">
                  End Time: {formatTime(endTime)}
                </label>
                <input
                  type="range"
                  min="0"
                  max={duration}
                  step="0.1"
                  value={endTime}
                  onChange={(e) => setEndTime(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-slate-300 text-sm block mb-2">
                  Play Duration: {playDuration}s
                </label>
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="0.5"
                  value={playDuration}
                  onChange={(e) => setPlayDuration(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-slate-300 text-sm block mb-2">
                  Volume: {Math.round(volume * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => {
                    const newVolume = parseFloat(e.target.value);
                    setVolume(newVolume);
                    if (audio) audio.volume = newVolume;
                  }}
                  className="w-full"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={togglePlay}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                {isPlaying ? 'Pause Preview' : 'Preview Selection'}
              </button>

              <button
                onClick={resetTrim}
                className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                onClick={handleSave}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
              >
                <Save className="w-5 h-5" />
                Save
              </button>
            </div>
          </>
        ) : isProcessingYoutube ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white">Loading YouTube video...</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AudioEditor;