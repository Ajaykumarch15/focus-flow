import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Timer, FileText } from 'lucide-react';
import { useStore } from '@worklog/services/useStore';
import { Select } from '@shared/components/ui/Select';

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${enabled ? 'bg-brand-500 shadow-inner shadow-brand-600/30' : 'bg-surface-700'}`}>
      <motion.div className="w-[18px] h-[18px] bg-white rounded-full absolute top-[3px] shadow-sm"
        animate={{ left: enabled ? '22px' : '3px' }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
    </button>
  );
}

const BREAK_OPTIONS = [
  { value: '0', label: 'Disabled' },
  { value: '15', label: 'Every 15 min' },
  { value: '30', label: 'Every 30 min' },
  { value: '45', label: 'Every 45 min' },
  { value: '60', label: 'Every 60 min' },
  { value: '90', label: 'Every 90 min' },
];

const SESSION_OPTIONS = [
  { value: '25', label: '25 min (Pomodoro)' },
  { value: '45', label: '45 min' },
  { value: '50', label: '50 min' },
  { value: '60', label: '60 min' },
  { value: '90', label: '90 min' },
  { value: '120', label: '120 min' },
];

const EXPORT_OPTIONS = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
];

export function WorklogSettingsPage() {
  const navigate = useNavigate();
  useStore();
  const [saved, setSaved] = useState(false);

  const [sessionLength, setSessionLength] = useState('50');
  const [breakInterval, setBreakInterval] = useState('30');
  const [autoStart, setAutoStart] = useState(false);
  const [dailySummary, setDailySummary] = useState(true);
  const [exportFormat, setExportFormat] = useState('csv');

  const flashSaved = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, []);

  return (
    <div className="min-h-screen bg-surface-950 relative overflow-x-hidden overflow-y-auto">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />

      <header className="sticky top-0 z-20 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/worklog/dashboard')}
              className="flex items-center gap-1.5 text-xs font-bold text-surface-400 hover:text-surface-100 transition-colors bg-surface-900 hover:bg-surface-800 px-3 py-2 rounded-xl border border-surface-800">
              <ArrowLeft size={14} /> Back
            </button>
            <div>
              <h1 className="font-display font-bold text-sm leading-none text-surface-50">Worklog Settings</h1>
            </div>
          </div>
          <AnimatePresence>
            {saved && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5 text-emerald-500 text-sm font-medium">
                <Check size={14} /> Saved
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 relative z-10">
        <motion.div variants={fadeUp} initial="hidden" animate="show"
          className="rounded-2xl border border-surface-800/80 bg-surface-900/70 backdrop-blur-sm p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Timer size={16} />
            </div>
            <div>
              <h2 className="font-display font-bold text-surface-50 text-[15px]">Timer</h2>
              <p className="text-xs text-surface-400">Configure focus session defaults</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-surface-200">Default Session Length</p>
                <p className="text-xs text-surface-500 mt-0.5">Default duration for new focus sessions</p>
              </div>
              <Select value={sessionLength} onChange={(e) => { setSessionLength(e.target.value); flashSaved(); }} className="h-9 rounded-lg text-xs w-44">
                {SESSION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-surface-200">Break Reminder Interval</p>
                <p className="text-xs text-surface-500 mt-0.5">How often to remind you to take a break</p>
              </div>
              <Select value={breakInterval} onChange={(e) => { setBreakInterval(e.target.value); flashSaved(); }} className="h-9 rounded-lg text-xs w-44">
                {BREAK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-surface-200">Auto-Start Timer on Task Select</p>
                <p className="text-xs text-surface-500 mt-0.5">Automatically start the timer when you select a task</p>
              </div>
              <Toggle enabled={autoStart} onToggle={() => { setAutoStart(!autoStart); flashSaved(); }} />
            </div>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.06 }}
          className="rounded-2xl border border-surface-800/80 bg-surface-900/70 backdrop-blur-sm p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <FileText size={16} />
            </div>
            <div>
              <h2 className="font-display font-bold text-surface-50 text-[15px]">Reports</h2>
              <p className="text-xs text-surface-400">Daily summary and export preferences</p>
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-surface-200">Show Daily Summary</p>
                <p className="text-xs text-surface-500 mt-0.5">Display a summary card at the end of each day</p>
              </div>
              <Toggle enabled={dailySummary} onToggle={() => { setDailySummary(!dailySummary); flashSaved(); }} />
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-surface-200">Export Format</p>
                <p className="text-xs text-surface-500 mt-0.5">Default format for work log exports</p>
              </div>
              <Select value={exportFormat} onChange={(e) => { setExportFormat(e.target.value); flashSaved(); }} className="h-9 rounded-lg text-xs w-32">
                {EXPORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
