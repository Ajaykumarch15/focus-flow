import { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

interface PomodoroPresetsProps {
  isRunning: boolean;
  isPaused: boolean;
  onSelectDuration?: (minutes: number) => void;
}

const PRESETS = [
  { label: 'Pomodoro', minutes: 25, shortLabel: '25 min' },
  { label: 'Short', minutes: 15, shortLabel: '15 min' },
  { label: 'Long', minutes: 50, shortLabel: '50 min' },
  { label: 'Custom', minutes: 0, shortLabel: '--' },
];

export function PomodoroPresets({ isRunning, isPaused, onSelectDuration }: PomodoroPresetsProps) {
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const [customMinutes, setCustomMinutes] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const isActive = isRunning || isPaused;

  const handlePresetClick = (preset: typeof PRESETS[number], index: number) => {
    if (isActive) return;

    if (preset.label === 'Custom') {
      setShowCustomInput(!showCustomInput);
      setActivePreset(index);
      return;
    }

    setShowCustomInput(false);
    setActivePreset(index);
    onSelectDuration?.(preset.minutes);
  };

  const handleCustomSubmit = () => {
    const mins = parseInt(customMinutes, 10);
    if (mins > 0 && mins <= 480) {
      onSelectDuration?.(mins);
      setShowCustomInput(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-2">
        {PRESETS.map((preset, index) => (
          <motion.button
            key={preset.label}
            type="button"
            whileHover={isActive ? {} : { scale: 1.05 }}
            whileTap={isActive ? {} : { scale: 0.95 }}
            onClick={() => handlePresetClick(preset, index)}
            disabled={isActive}
            className={`relative px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              activePreset === index
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-surface-800 text-surface-400 border border-surface-700 hover:border-surface-600 hover:text-surface-200'
            } ${isActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] uppercase tracking-wider opacity-70">{preset.label}</span>
              <span className="flex items-center gap-1">
                {preset.label === 'Custom' ? (
                  <Clock size={10} />
                ) : null}
                {preset.shortLabel}
              </span>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Custom duration input */}
      {showCustomInput && !isActive && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="flex items-center gap-2"
        >
          <input
            type="number"
            min={1}
            max={480}
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
            placeholder="Minutes"
            className="w-20 h-8 px-2 rounded-lg bg-surface-800 border border-surface-700 text-surface-200 text-xs text-center focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
          <button
            type="button"
            onClick={handleCustomSubmit}
            disabled={!customMinutes || parseInt(customMinutes, 10) <= 0}
            className="h-8 px-3 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            Set
          </button>
        </motion.div>
      )}
    </div>
  );
}
