import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../utils/api';
import { Moon, Sun, Palette, User, Clock, Bell, Users, Cloud, Check, BellRing } from 'lucide-react';
import { TASK_COLORS, ACCENT_PRESETS } from '../utils/colors';
import { getNotificationSettings, saveNotificationSettings, NotificationSettings, requestNotificationPermission } from '../hooks/useNotifications';

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
  const { user, restoreSession } = useAuthStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') === 'true') {
      window.history.replaceState({}, document.title, window.location.pathname);
      restoreSession();
    }
  }, [restoreSession]);

  const handleConnectGoogle = async () => {
    try {
      const { url } = await api.google.getUrl();
      window.location.href = url;
    } catch (err: any) {
      alert(err.message || 'Failed to connect Google Drive');
    }
  };

  const handleDisconnectGoogle = async () => {
    if (confirm('Disconnect Google Drive? FocusFlow will stop organizing projects and logs into documents.')) {
      try {
        await api.google.disconnect();
        await restoreSession();
      } catch (err: any) {
        alert(err.message || 'Failed to disconnect');
      }
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl font-display font-bold text-surface-50">Settings</h1>
        <p className="text-surface-300 mt-1">Customize your FocusFlow experience</p>
      </motion.div>

      <div className="space-y-6">
        {/* Profile */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
          <h2 className="font-semibold text-surface-50 mb-4 flex items-center gap-2"><User size={18} className="text-brand-400" /> Profile</h2>
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
          <h2 className="font-semibold text-surface-50 mb-4 flex items-center gap-2"><Palette size={18} className="text-brand-400" /> Appearance</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-surface-300 mb-2">Theme Mode</label>
              <div className="flex gap-2">
                <button
                  onClick={() => updateTheme({ mode: 'dark' })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${theme.mode === 'dark' ? 'bg-brand-500 text-white' : 'bg-surface-800 text-surface-300 hover:text-surface-50'}`}
                >
                  <Moon size={16} /> Dark
                </button>
                <button
                  onClick={() => updateTheme({ mode: 'light' })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${theme.mode === 'light' ? 'bg-brand-500 text-white' : 'bg-surface-800 text-surface-300 hover:text-surface-50'}`}
                >
                  <Sun size={16} /> Light
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm text-surface-300">Accent Color</label>
                <span className="text-xs font-mono text-surface-400 px-2 py-0.5 rounded bg-surface-800 border border-surface-700">
                  {theme.accentColor || '#0ea5e9'}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap items-center mb-3">
                {ACCENT_PRESETS.map(preset => {
                  const isSelected = theme.accentColor?.toLowerCase() === preset.hex.toLowerCase();
                  return (
                    <button
                      key={preset.hex}
                      onClick={() => updateTheme({ accentColor: preset.hex })}
                      className={`w-7 h-7 rounded-full transition-all relative ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-900 scale-110 shadow-lg' : 'opacity-75 hover:opacity-100 hover:scale-105'}`}
                      style={{ backgroundColor: preset.hex }}
                      title={`${preset.name} (${preset.hex})`}
                    />
                  );
                })}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <div className="relative flex items-center">
                  <input
                    type="color"
                    id="accent-color-picker"
                    value={theme.accentColor || '#0ea5e9'}
                    onChange={(e) => updateTheme({ accentColor: e.target.value })}
                    className="w-9 h-9 rounded-xl border border-surface-700 cursor-pointer bg-surface-800 p-1"
                  />
                </div>
                <input
                  type="text"
                  placeholder="#0ea5e9"
                  maxLength={7}
                  value={theme.accentColor || '#0ea5e9'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                      updateTheme({ accentColor: val });
                    }
                  }}
                  className="input w-32 text-xs font-mono"
                />
                <span className="text-xs text-surface-400">Custom Hex Color</span>
              </div>
            </div>

            <div>
              <label className="block text-sm text-surface-300 mb-2">Font Size</label>
              <div className="flex gap-2">
                {(['sm', 'md', 'lg'] as const).map(size => (
                  <button
                    key={size}
                    onClick={() => updateTheme({ fontSize: size })}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${theme.fontSize === size ? 'bg-brand-500 text-white' : 'bg-surface-800 text-surface-300 hover:text-surface-50'}`}
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
          <h2 className="font-semibold text-surface-50 mb-4 flex items-center gap-2"><Clock size={18} className="text-brand-400" /> Pomodoro Timer</h2>
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
          <h2 className="font-semibold text-surface-50 mb-4 flex items-center gap-2">
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

        {/* Notifications */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }} className="card p-6">
          <h2 className="font-semibold text-surface-50 mb-4 flex items-center gap-2">
            <BellRing size={18} className="text-brand-400" /> Notifications
          </h2>
          <NotificationSettingsSection />
        </motion.section>

        {/* Google Drive Connection */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.23 }} className="card p-6">
          <h2 className="font-semibold text-surface-50 mb-4 flex items-center gap-2">
            <Cloud size={18} className="text-brand-400" /> Google Drive Integration
          </h2>
          <p className="text-sm text-surface-400 mb-4">
            Connect your Google Drive to build a searchable knowledge repository for your projects. FocusFlow will automatically create project folders and structure your daily work logs as rich Google Documents.
          </p>

          {user?.googleConnected ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-medium self-start">
                <Check size={16} /> Google Drive is connected!
              </div>
              <button
                onClick={handleDisconnectGoogle}
                className="px-4 py-2 self-start bg-surface-700 hover:bg-surface-600 text-surface-200 border border-surface-600 rounded-xl text-sm font-medium transition-all"
              >
                Disconnect Google Drive
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectGoogle}
              className="btn-primary flex items-center gap-2"
            >
              <Cloud size={16} /> Connect Google Drive
            </button>
          )}
        </motion.section>

        {/* Data */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card p-6">
          <h2 className="font-semibold text-surface-50 mb-4 flex items-center gap-2"><Bell size={18} className="text-brand-400" /> Data</h2>
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

function NotificationSettingsSection() {
  const settings = getNotificationSettings();

  const updateSetting = (key: keyof NotificationSettings, value: boolean) => {
    saveNotificationSettings({ ...settings, [key]: value });
    // Force re-render by triggering a state change
    window.location.reload();
  };

  const handleEnableAll = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      saveNotificationSettings({
        enabled: true,
        deadlineReminders: true,
        pomodoroAlerts: true,
        habitReminders: true,
        dailyGoalReminder: true,
      });
      window.location.reload();
    }
  };

  if (Notification.permission === 'denied') {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-surface-400 mb-3">
          Browser notifications are blocked. Please enable them in your browser settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="block text-sm text-surface-200">Enable Notifications</span>
          <p className="text-xs text-surface-500 mt-1">Master switch for all notifications</p>
        </div>
        {Notification.permission !== 'granted' ? (
          <button
            onClick={handleEnableAll}
            className="px-3 py-1.5 bg-brand-500 hover:bg-brand-400 text-white text-sm font-medium rounded-lg transition-all"
          >
            Enable
          </button>
        ) : (
          <button
            onClick={() => updateSetting('enabled', !settings.enabled)}
            className={`w-11 h-6 rounded-full transition-all relative ${settings.enabled ? 'bg-brand-500' : 'bg-surface-700'}`}
          >
            <motion.div
              className="w-4 h-4 bg-white rounded-full absolute top-1"
              animate={{ left: settings.enabled ? '1.5rem' : '0.25rem' }}
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            />
          </button>
        )}
      </div>

      {settings.enabled && Notification.permission === 'granted' && (
        <div className="space-y-3 pt-2 border-t border-surface-800">
          {[
            { key: 'deadlineReminders' as const, label: 'Deadline Reminders', desc: 'Get notified when tasks are due or overdue' },
            { key: 'pomodoroAlerts' as const, label: 'Pomodoro Alerts', desc: 'Alerts when focus/break sessions end' },
            { key: 'habitReminders' as const, label: 'Habit Reminders', desc: 'Reminders for scheduled habits' },
            { key: 'dailyGoalReminder' as const, label: 'Daily Goal Reminder', desc: 'Reminder if daily focus goal not met' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <span className="block text-sm text-surface-200">{label}</span>
                <p className="text-xs text-surface-500 mt-0.5">{desc}</p>
              </div>
              <button
                onClick={() => updateSetting(key, !settings[key])}
                className={`w-11 h-6 rounded-full transition-all relative ${settings[key] ? 'bg-brand-500' : 'bg-surface-700'}`}
              >
                <motion.div
                  className="w-4 h-4 bg-white rounded-full absolute top-1"
                  animate={{ left: settings[key] ? '1.5rem' : '0.25rem' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
