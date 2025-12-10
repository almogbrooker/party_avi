import React, { useState } from 'react';
import { Clock, Save, RotateCcw, Settings } from 'lucide-react';

export interface TimerSettings {
  groomAnswerTime: number; // seconds
  playerVotingTime: number; // seconds
  revealDelayTime: number; // seconds
  missionDisplayTime: number; // seconds
  victimSelectionTime: number; // seconds
  consequenceDisplayTime: number; // seconds
}

interface TimerConfigProps {
  initialSettings?: Partial<TimerSettings>;
  onSave: (settings: TimerSettings) => void;
  onClose: () => void;
}

const DEFAULT_SETTINGS: TimerSettings = {
  groomAnswerTime: 30,
  playerVotingTime: 10,
  revealDelayTime: 2,
  missionDisplayTime: 5,
  victimSelectionTime: 5,
  consequenceDisplayTime: 3
};

const TIMER_DESCRIPTIONS = {
  groomAnswerTime: {
    label: "Groom Answer Time",
    description: "Time the groom has to answer each question",
    min: 10,
    max: 120,
    unit: "seconds"
  },
  playerVotingTime: {
    label: "Player Voting Time",
    description: "Time players have to vote on groom's answer",
    min: 5,
    max: 30,
    unit: "seconds"
  },
  revealDelayTime: {
    label: "Reveal Delay",
    description: "Delay before revealing the correct answer",
    min: 0,
    max: 10,
    unit: "seconds"
  },
  missionDisplayTime: {
    label: "Mission Display Time",
    description: "How long to display the mission text",
    min: 3,
    max: 15,
    unit: "seconds"
  },
  victimSelectionTime: {
    label: "Victim Selection Time",
    description: "Time for roulette to select a victim",
    min: 3,
    max: 15,
    unit: "seconds"
  },
  consequenceDisplayTime: {
    label: "Consequence Display Time",
    description: "How long to show the consequence before mission",
    min: 2,
    max: 10,
    unit: "seconds"
  }
};

export const TimerConfig: React.FC<TimerConfigProps> = ({
  initialSettings,
  onSave,
  onClose
}) => {
  const [settings, setSettings] = useState<TimerSettings>({
    ...DEFAULT_SETTINGS,
    ...initialSettings
  });

  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic');

  const handleSettingChange = (key: keyof TimerSettings, value: number) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const resetToDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const handleSave = () => {
    onSave(settings);
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-blue-400" />
            Game Timer Configuration
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <Settings className="w-6 h-6 rotate-90" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('basic')}
            className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
              activeTab === 'basic'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Basic Timers
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
              activeTab === 'advanced'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Advanced
          </button>
        </div>

        {/* Basic Timers */}
        {activeTab === 'basic' && (
          <div className="space-y-6">
            {(['groomAnswerTime', 'playerVotingTime', 'revealDelayTime'] as const).map((key) => {
              const config = TIMER_DESCRIPTIONS[key];
              return (
                <div key={key} className="bg-slate-700/50 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="text-white font-medium">{config.label}</h4>
                      <p className="text-slate-400 text-sm">{config.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-blue-400">
                        {settings[key]}
                      </span>
                      <span className="text-slate-400 ml-1">{config.unit}</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={config.min}
                    max={config.max}
                    step={key === 'revealDelayTime' ? 0.5 : 1}
                    value={settings[key]}
                    onChange={(e) => handleSettingChange(key, parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>{config.min}s</span>
                    <span>{config.max}s</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Advanced Timers */}
        {activeTab === 'advanced' && (
          <div className="space-y-6">
            {(['missionDisplayTime', 'victimSelectionTime', 'consequenceDisplayTime'] as const).map((key) => {
              const config = TIMER_DESCRIPTIONS[key];
              return (
                <div key={key} className="bg-slate-700/50 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="text-white font-medium">{config.label}</h4>
                      <p className="text-slate-400 text-sm">{config.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-purple-400">
                        {settings[key]}
                      </span>
                      <span className="text-slate-400 ml-1">{config.unit}</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={config.min}
                    max={config.max}
                    step={1}
                    value={settings[key]}
                    onChange={(e) => handleSettingChange(key, parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>{config.min}s</span>
                    <span>{config.max}s</span>
                  </div>
                </div>
              );
            })}

            {/* Game Speed Preset */}
            <div className="bg-slate-700/50 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">Game Speed Presets</h4>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSettings({
                    groomAnswerTime: 20,
                    playerVotingTime: 5,
                    revealDelayTime: 1,
                    missionDisplayTime: 3,
                    victimSelectionTime: 3,
                    consequenceDisplayTime: 2
                  })}
                  className="py-2 px-3 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg transition-colors text-sm"
                >
                  Quick Game
                </button>
                <button
                  onClick={resetToDefaults}
                  className="py-2 px-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-colors text-sm"
                >
                  Normal
                </button>
                <button
                  onClick={() => setSettings({
                    groomAnswerTime: 60,
                    playerVotingTime: 15,
                    revealDelayTime: 3,
                    missionDisplayTime: 8,
                    victimSelectionTime: 8,
                    consequenceDisplayTime: 5
                  })}
                  className="py-2 px-3 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-lg transition-colors text-sm"
                >
                  Extended
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="mt-6 p-4 bg-slate-700/30 rounded-lg">
          <h4 className="text-white font-medium mb-2">Estimated Game Duration</h4>
          <p className="text-slate-400 text-sm">
            Based on your settings, each round will take approximately{' '}
            <span className="text-white font-medium">
              {formatTime(
                settings.groomAnswerTime +
                settings.playerVotingTime +
                settings.revealDelayTime +
                settings.missionDisplayTime +
                settings.victimSelectionTime +
                settings.consequenceDisplayTime
              )}
            </span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={resetToDefaults}
            className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            Reset
          </button>

          <button
            onClick={onClose}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Save className="w-5 h-5" />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimerConfig;