import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { Moon, Sun, Palette, User, Clock, Bell } from 'lucide-react';
import { TASK_COLORS } from '../utils/colors';

const LOCAL_CACHE_KEYS = [
  'focusflow-storage',
  'ff_profile_cache',
  'ff_theme_cache',
  'ff_worklog_cache',
  'ff_habit_cache',
  'ff_habit_timer',
  'ff_today_ms',
  'ff_active_timer',
];

const TIMEZONE_OPTIONS = [
  Intl.DateTimeFormat().resolvedOptions().timeZone,
  'Asia/Calcutta',
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Singapore',
  'Asia/Tokyo',
].filter((zone, index, zones) => zone && zones.indexOf(zone) === index);

export function Settings() {
  const { theme, profile, updateTheme, updateProfile } = useStore();

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl font-display font-bold text-white">Settings</h1>
        <p className="text-surface-300 mt-1">Customize your FocusFlow experience</p>
      </motion.div>

      <div className="space-y-6">
        {/* Profile */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2"><User size={18} className="text-brand-400" /> Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-surface-300 mb-1.5">Your Name</label>
              <input
                className="input"
                value={profile.name}
                onChange={e => updateProfile({ name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-surface-300 mb-1.5">Daily Goal (hours)</label>
              <input
                type="number"
                className="input"
                min="1" max="24"
                value={profile.dailyGoal}
                onChange={e => updateProfile({ dailyGoal: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-sm text-surface-300 mb-1.5">Report Timezone</label>
              <select
                className="input"
                value={profile.timezone}
                onChange={e => updateProfile({ timezone: e.target.value })}
              >
                {TIMEZONE_OPTIONS.map(zone => (
                  <option key={zone} value={zone}>{zone}</option>
                ))}
              </select>
              <p className="text-xs text-surface-500 mt-1.5">
                Daily reports and work-log history use this timezone for day boundaries.
              </p>
            </div>
          </div>
        </motion.section>

        {/* Theme */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2"><Palette size={18} className="text-brand-400" /> Appearance</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-surface-300 mb-2">Accent Color</label>
              <div className="flex gap-2 flex-wrap">
                {TASK_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => updateTheme({ accentColor: color })}
                    className={`w-8 h-8 rounded-full transition-all ${theme.accentColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-900 scale-110' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-surface-300 mb-2">Font Size</label>
              <div className="flex gap-2">
                {(['sm', 'md', 'lg'] as const).map(size => (
                  <button
                    key={size}
                    onClick={() => updateTheme({ fontSize: size })}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${theme.fontSize === size ? 'bg-brand-500 text-white' : 'bg-surface-800 text-surface-300 hover:text-white'}`}
                  >
                    {size.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {[
                { key: 'glassmorphism', label: 'Glassmorphism Effects' },
                { key: 'animatedBackground', label: 'Animated Background' },
                { key: 'reducedMotion', label: 'Reduce Motion' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-surface-200">{label}</span>
                  <button
                    onClick={() => updateTheme({ [key]: !theme[key as keyof typeof theme] } as any)}
                    className={`w-11 h-6 rounded-full transition-all relative ${theme[key as keyof typeof theme] ? 'bg-brand-500' : 'bg-surface-700'}`}
                  >
                    <motion.div
                      className="w-4 h-4 bg-white rounded-full absolute top-1"
                      animate={{ left: theme[key as keyof typeof theme] ? '1.5rem' : '0.25rem' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Pomodoro */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2"><Clock size={18} className="text-brand-400" /> Pomodoro Timer</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-surface-300 mb-1.5">Focus Duration (min)</label>
              <input
                type="number"
                className="input"
                min="1" max="120"
                value={profile.pomodoroWork}
                onChange={e => updateProfile({ pomodoroWork: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-sm text-surface-300 mb-1.5">Break Duration (min)</label>
              <input
                type="number"
                className="input"
                min="1" max="60"
                value={profile.pomodoroBreak}
                onChange={e => updateProfile({ pomodoroBreak: Number(e.target.value) })}
              />
            </div>
          </div>
        </motion.section>

        {/* Community */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="card p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Users size={18} className="text-brand-400" /> Community
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-sm text-surface-200">Show on Leaderboard</span>
              <p className="text-xs text-surface-500 mt-1">Allows other users to see your focus points and streak</p>
            </div>
            <button
              onClick={() => updateProfile({ leaderboardOptIn: !profile.leaderboardOptIn })}
              className={`w-11 h-6 rounded-full transition-all relative ${profile.leaderboardOptIn ? 'bg-brand-500' : 'bg-surface-700'}`}
            >
              <motion.div
                className="w-4 h-4 bg-white rounded-full absolute top-1"
                animate={{ left: profile.leaderboardOptIn ? '1.5rem' : '0.25rem' }}
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            </button>
          </div>
        </motion.section>

        {/* Data */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2"><Bell size={18} className="text-brand-400" /> Data</h2>
          <p className="text-sm text-surface-400 mb-4">
            FocusFlow syncs your account data with the server and keeps a local cache for faster loading. Clear the cache if the app looks stale.
          </p>
          <button
            onClick={() => {
              if (confirm('This clears only FocusFlow cached data on this device. Your server data will remain. Continue?')) {
                LOCAL_CACHE_KEYS.forEach(key => localStorage.removeItem(key));
                window.location.reload();
              }
            }}
            className="px-4 py-2 bg-red-400/10 hover:bg-red-400/20 text-red-400 border border-red-400/20 rounded-xl text-sm font-medium transition-all"
          >
            Clear Local Cache
          </button>
        </motion.section>
      </div>
    </div>
  );
}
