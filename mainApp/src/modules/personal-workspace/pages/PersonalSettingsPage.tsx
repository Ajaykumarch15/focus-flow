import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Check, Target, Clock, Trophy } from 'lucide-react';
import { useStore } from '@worklog/services/useStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Select } from '@shared/components/ui/Select';
import { Field } from '@shared/components/ui/Field';

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

const TIMEZONE_OPTIONS = [
  Intl.DateTimeFormat().resolvedOptions().timeZone,
  'Asia/Calcutta', 'UTC', 'America/New_York', 'America/Los_Angeles',
  'Europe/London', 'Europe/Berlin', 'Asia/Singapore', 'Asia/Tokyo',
].filter((zone, i, arr) => zone && arr.indexOf(zone) === i);

export function PersonalSettingsPage() {
  const navigate = useNavigate();
  const { profile, updateProfile } = useStore();
  const { user } = useAuthStore();
  const [saved, setSaved] = useState(false);

  const [dailyGoal, setDailyGoal] = useState(profile.dailyGoal);
  const [personalGoal, setPersonalGoal] = useState(profile.personalDailyGoal);
  const [timezone, setTimezone] = useState(profile.timezone);
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(profile.leaderboardOptIn);

  const flashSaved = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, []);

  const handleSave = (updates: Partial<typeof profile>) => {
    updateProfile(updates);
    flashSaved();
  };

  return (
    <div className="min-h-screen bg-surface-950 relative overflow-x-hidden overflow-y-auto">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />

      <header className="sticky top-0 z-20 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/personal/today')}
              className="flex items-center gap-1.5 text-xs font-bold text-surface-400 hover:text-surface-100 transition-colors bg-surface-900 hover:bg-surface-800 px-3 py-2 rounded-xl border border-surface-800">
              <ArrowLeft size={14} /> Back
            </button>
            <div>
              <h1 className="font-display font-bold text-sm leading-none text-surface-50">Personal Settings</h1>
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
              <Target size={16} />
            </div>
            <div>
              <h2 className="font-display font-bold text-surface-50 text-[15px]">Goals</h2>
              <p className="text-xs text-surface-400">Set your daily focus targets</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Work Goal (hours)">
                <Input type="number" className="h-11 rounded-xl" min="0" max="24" value={dailyGoal}
                  onChange={(e) => { const v = Number(e.target.value); setDailyGoal(v); handleSave({ dailyGoal: v }); }} />
              </Field>
              <Field label="Personal Goal (hours)">
                <Input type="number" className="h-11 rounded-xl" min="0" max="24" value={personalGoal}
                  onChange={(e) => { const v = Number(e.target.value); setPersonalGoal(v); handleSave({ personalDailyGoal: v }); }} />
              </Field>
            </div>
            <p className="text-xs text-surface-500">Work goal tracks focus time in the Worklog. Personal goal tracks focus time in the Personal workspace. Set to 0 to disable.</p>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.06 }}
          className="rounded-2xl border border-surface-800/80 bg-surface-900/70 backdrop-blur-sm p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Clock size={16} />
            </div>
            <div>
              <h2 className="font-display font-bold text-surface-50 text-[15px]">Timezone</h2>
              <p className="text-xs text-surface-400">Your local timezone for scheduling</p>
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-surface-200">Timezone</p>
              <p className="text-xs text-surface-500 mt-0.5">Used for calendar and reminder scheduling</p>
            </div>
            <Select value={timezone} onChange={(e) => { setTimezone(e.target.value); handleSave({ timezone: e.target.value }); }} className="h-9 rounded-lg text-xs w-48">
              {TIMEZONE_OPTIONS.map((z) => <option key={z} value={z}>{z}</option>)}
            </Select>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.12 }}
          className="rounded-2xl border border-surface-800/80 bg-surface-900/70 backdrop-blur-sm p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Trophy size={16} />
            </div>
            <div>
              <h2 className="font-display font-bold text-surface-50 text-[15px]">Community</h2>
              <p className="text-xs text-surface-400">Leaderboard and visibility preferences</p>
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-surface-200">Show on Leaderboard</p>
              <p className="text-xs text-surface-500 mt-0.5">Display your profile on the public leaderboard</p>
            </div>
            <Toggle enabled={leaderboardOptIn} onToggle={() => { setLeaderboardOptIn(!leaderboardOptIn); handleSave({ leaderboardOptIn: !leaderboardOptIn }); }} />
          </div>
        </motion.div>
      </main>
    </div>
  );
}
