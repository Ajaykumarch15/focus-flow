import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../utils/api';
import {
  Moon, Sun, Palette, User, Bell, Users, Cloud, Check, BellRing,
  Shield, Database, Zap, Eye, AlertTriangle,
} from 'lucide-react';
import { ACCENT_PRESETS } from '../utils/colors';
import { getNotificationSettings, saveNotificationSettings, NotificationSettings, requestNotificationPermission } from '../hooks/useNotifications';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Field } from '../components/ui/Field';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { BackupRestoreSection } from '../components/settings/BackupRestoreSection';

const LOCAL_CACHE_KEYS = [
  'focusflow-storage', 'ff_profile_cache', 'ff_theme_cache',
  'ff_worklog_cache', 'ff_habit_cache', 'ff_habit_timer',
  'ff_day_cache', 'ff_today_ms', 'ff_active_timer',
];

const TIMEZONE_OPTIONS = [
  Intl.DateTimeFormat().resolvedOptions().timeZone,
  'Asia/Calcutta', 'UTC', 'America/New_York', 'America/Los_Angeles',
  'Europe/London', 'Europe/Berlin', 'Asia/Singapore', 'Asia/Tokyo',
].filter((zone, i, arr) => zone && arr.indexOf(zone) === i);

const NAV_SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-500/10' },
  { id: 'appearance', label: 'Appearance', icon: Palette, color: 'text-purple-500 dark:text-purple-400', bg: 'bg-purple-500/10' },
  { id: 'notifications', label: 'Notifications', icon: BellRing, color: 'text-pink-500 dark:text-pink-400', bg: 'bg-pink-500/10' },
  { id: 'integrations', label: 'Integrations', icon: Cloud, color: 'text-sky-500 dark:text-sky-400', bg: 'bg-sky-500/10' },
  { id: 'community', label: 'Community', icon: Users, color: 'text-indigo-500 dark:text-indigo-400', bg: 'bg-indigo-500/10' },
  { id: 'data', label: 'Data & Storage', icon: Database, color: 'text-rose-500 dark:text-rose-400', bg: 'bg-rose-500/10' },
  { id: 'security', label: 'Security', icon: Shield, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
] as const;

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.04 } } };

export function Settings() {
  const { theme, profile, updateTheme, updateProfile } = useStore();
  const { user, restoreSession } = useAuthStore();
  const [activeNav, setActiveNav] = useState('profile');
  const [saved, setSaved] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') === 'true') {
      window.history.replaceState({}, document.title, window.location.pathname);
      restoreSession();
    }
  }, [restoreSession]);

  const flashSaved = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, []);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveNav(visible[0].target.id);
      },
      { root: container, rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    );
    NAV_SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observerRef.current!.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleConnectGoogle = async () => {
    try {
      const { url } = await api.google.getUrl();
      window.location.href = url;
    } catch (err: any) { alert(err.message || 'Failed to connect Google Drive'); }
  };

  const handleDisconnectGoogle = async () => {
    if (confirm('Disconnect Google Drive?')) {
      try { await api.google.disconnect(); await restoreSession(); }
      catch (err: any) { alert(err.message || 'Failed to disconnect'); }
    }
  };

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Header */}
      <div className="border-b border-surface-800/60 bg-surface-950/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-bold text-surface-50 tracking-tight">Settings</h1>
            <p className="text-xs text-surface-400 font-medium mt-0.5">Customize your FocusFlow workspace</p>
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
      </div>

      <div className="max-w-[1200px] mx-auto px-6 lg:px-10 flex gap-8 py-8">
        {/* Sidebar Nav */}
        <aside className="hidden lg:block w-52 flex-shrink-0">
          <nav className="sticky top-24 space-y-0.5">
            {NAV_SECTIONS.map(s => {
              const Icon = s.icon;
              const active = activeNav === s.id;
              return (
                <button key={s.id} onClick={() => scrollTo(s.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left ${active ? `${s.bg} ${s.color}` : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50'}`}>
                  <Icon size={15} />
                  {s.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <main ref={contentRef} className="flex-1 min-w-0 space-y-6 overflow-y-auto" style={{ scrollBehavior: 'smooth' }}>
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-[720px]">

            {/* ─── Profile ─── */}
            <Section id="profile" icon={User} iconBg="bg-blue-500/10" iconColor="text-blue-500 dark:text-blue-400" title="Profile" desc="Manage your personal information">
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-2">
                  <Avatar name={profile.name} src={user?.avatar} size="xl" />
                  <div>
                    <p className="font-semibold text-surface-50">{profile.name}</p>
                    <p className="text-xs text-surface-400">{user?.email}</p>
                  </div>
                </div>
                <div className="mb-3">
                  <Button variant="outline" size="sm" disabled className="h-9 rounded-xl text-xs" title="Avatar upload arrives with cloud storage integration">
                    Change Avatar
                  </Button>
                  <p className="mt-1.5 text-[11px] text-surface-500">Image uploads become available once cloud storage is connected.</p>
                </div>
                <Field label="Display Name">
                  <Input className="h-11 rounded-xl" value={profile.name}
                    onChange={e => { updateProfile({ name: e.target.value }); flashSaved(); }} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Daily Goal (hours)">
                    <Input type="number" className="h-11 rounded-xl" min="1" max="24" value={profile.dailyGoal}
                      onChange={e => { updateProfile({ dailyGoal: Number(e.target.value) }); flashSaved(); }} />
                  </Field>
                  <Field label="Timezone">
                    <Select className="h-11 rounded-xl" value={profile.timezone}
                      onChange={e => { updateProfile({ timezone: e.target.value }); flashSaved(); }}>
                      {TIMEZONE_OPTIONS.map(z => <option key={z} value={z}>{z}</option>)}
                    </Select>
                  </Field>
                </div>
                <p className="text-xs text-surface-500">Daily reports and work-log history use this timezone for day boundaries.</p>
              </div>
            </Section>

            {/* ─── Appearance ─── */}
            <Section id="appearance" icon={Palette} iconBg="bg-purple-500/10" iconColor="text-purple-500 dark:text-purple-400" title="Appearance" desc="Customize the look and feel of FocusFlow">
              <div className="space-y-5">
                {/* Theme Mode */}
                <div>
                  <p className="text-xs font-semibold text-surface-300 uppercase tracking-wider mb-2.5">Theme Mode</p>
                  <div className="flex gap-2">
                    {([['dark', Moon, 'Dark'], ['light', Sun, 'Light']] as const).map(([mode, Icon, label]) => (
                      <button key={mode} onClick={() => { updateTheme({ mode }); flashSaved(); }}
                        className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-semibold transition-all border ${theme.mode === mode
                          ? 'bg-brand-500 text-white border-brand-500 shadow-lg shadow-brand-500/20'
                          : 'bg-surface-850 text-surface-300 border-surface-800 hover:border-surface-700 hover:text-surface-50'}`}>
                        <Icon size={16} /> {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Preview */}
                <div className="rounded-xl border border-surface-800 bg-surface-850/50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye size={13} className="text-surface-400" />
                    <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Preview</p>
                  </div>
                  <div className="rounded-xl p-4 bg-surface-900 border border-surface-800 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
                        <Zap size={14} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="h-2.5 w-28 rounded-full bg-brand-500" />
                        <div className="h-1.5 w-20 rounded-full bg-surface-700 mt-1.5" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-6 w-16 rounded-md bg-brand-500/15 text-brand-400 text-[10px] font-medium flex items-center justify-center">Active</div>
                      <div className="h-6 w-16 rounded-md bg-surface-800 text-surface-400 text-[10px] font-medium flex items-center justify-center">Paused</div>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
                      <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: '62%' }} />
                    </div>
                  </div>
                </div>

                {/* Accent Color */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs font-semibold text-surface-300 uppercase tracking-wider">Accent Color</p>
                    <span className="text-xs font-mono text-surface-500 px-2 py-0.5 rounded-md bg-surface-850 border border-surface-800">
                      {theme.accentColor || '#0ea5e9'}
                    </span>
                  </div>
                  <div className="grid grid-cols-8 gap-2 mb-3">
                    {ACCENT_PRESETS.map(preset => {
                      const sel = theme.accentColor?.toLowerCase() === preset.hex.toLowerCase();
                      return (
                        <button key={preset.hex} onClick={() => { updateTheme({ accentColor: preset.hex }); flashSaved(); }}
                          className={`aspect-square rounded-xl transition-all relative group ${sel ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-900 scale-110 shadow-lg' : 'hover:scale-105 opacity-75 hover:opacity-100'}`}
                          style={{ backgroundColor: preset.hex }} title={preset.name}>
                          {sel && <motion.div layoutId="accentCheck" className="absolute inset-0 flex items-center justify-center"><Check size={12} className="text-white drop-shadow" /></motion.div>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="color" value={theme.accentColor || '#0ea5e9'}
                      onChange={e => { updateTheme({ accentColor: e.target.value }); flashSaved(); }}
                      className="w-9 h-9 rounded-lg border border-surface-800 cursor-pointer bg-surface-850 p-1" />
                    <Input type="text" placeholder="#0ea5e9" maxLength={7} value={theme.accentColor || '#0ea5e9'}
                      onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) { updateTheme({ accentColor: e.target.value }); flashSaved(); } }}
                      className="h-9 w-28 text-xs font-mono rounded-lg" />
                    <span className="text-xs text-surface-500">Custom hex</span>
                  </div>
                </div>

                {/* Font Size */}
                <div>
                  <p className="text-xs font-semibold text-surface-300 uppercase tracking-wider mb-2.5">Font Size</p>
                  <div className="flex gap-2">
                    {(['sm', 'md', 'lg'] as const).map(size => (
                      <button key={size} onClick={() => { updateTheme({ fontSize: size }); flashSaved(); }}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${theme.fontSize === size
                          ? 'bg-brand-500 text-white border-brand-500' : 'bg-surface-850 text-surface-300 border-surface-800 hover:border-surface-700'}`}>
                        {size.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-0.5">
                  {[
                    { key: 'glassmorphism' as const, label: 'Glassmorphism', desc: 'Frosted glass effects on panels' },
                    { key: 'animatedBackground' as const, label: 'Animated Background', desc: 'Subtle gradient animation' },
                    { key: 'reducedMotion' as const, label: 'Reduce Motion', desc: 'Minimize animations for accessibility' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium text-surface-200">{label}</p>
                        <p className="text-xs text-surface-500 mt-0.5">{desc}</p>
                      </div>
                      <Toggle enabled={!!theme[key]}
                        onToggle={() => { updateTheme({ [key]: !theme[key] }); flashSaved(); }} />
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            {/* ─── Notifications ─── */}
            <Section id="notifications" icon={BellRing} iconBg="bg-pink-500/10" iconColor="text-pink-500 dark:text-pink-400" title="Notifications" desc="Control when and how you get notified">
              <NotificationSettingsSection onSaved={flashSaved} />
            </Section>

            {/* ─── Integrations ─── */}
            <Section id="integrations" icon={Cloud} iconBg="bg-sky-500/10" iconColor="text-sky-500 dark:text-sky-400" title="Integrations" desc="Connect external services">
              <div className="space-y-4">
                {/* IES-P1-24: a failed Drive sync must be visible, with a clear
                    recovery path — reconnect via the Connect button below. */}
                {user?.googleConnected && user?.driveSyncError && (
                  <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
                    <AlertTriangle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-amber-300">Google Drive sync needs attention</p>
                      <p className="text-xs text-amber-200/80 mt-0.5">{user.driveSyncError}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-4 p-4 rounded-xl border border-surface-800 bg-surface-850/50">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-surface-50">Google Drive</p>
                    <p className="text-xs text-surface-400 mt-0.5">Auto-sync work logs as Google Docs</p>
                    {user?.googleConnected && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-500 font-medium">
                        <Check size={12} /> Connected
                      </div>
                    )}
                  </div>
                  {user?.googleConnected ? (
                    <Button variant="secondary" size="sm" onClick={handleDisconnectGoogle}>Disconnect</Button>
                  ) : (
                    <Button size="sm" onClick={handleConnectGoogle}>Connect</Button>
                  )}
                </div>
              </div>
            </Section>

            {/* ─── Community ─── */}
            <Section id="community" icon={Users} iconBg="bg-indigo-500/10" iconColor="text-indigo-500 dark:text-indigo-400" title="Community" desc="Leaderboard visibility">
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-surface-200">Show on Leaderboard</p>
                  <p className="text-xs text-surface-500 mt-0.5">Allow others to see your focus points and streak</p>
                </div>
                <Toggle enabled={profile.leaderboardOptIn}
                  onToggle={() => { updateProfile({ leaderboardOptIn: !profile.leaderboardOptIn }); flashSaved(); }} />
              </div>
            </Section>

            {/* ─── Data & Storage ─── */}
            <Section id="data" icon={Database} iconBg="bg-rose-500/10" iconColor="text-rose-500 dark:text-rose-400" title="Data & Storage" desc="Manage your data and backups">
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-xs text-surface-400">FocusFlow syncs data with the server and caches locally for speed. Clear the cache if the app looks stale.</p>
                  <Button variant="secondary" onClick={() => {
                    if (confirm('Clear local cache? Server data will remain safe.')) {
                      LOCAL_CACHE_KEYS.forEach(k => localStorage.removeItem(k));
                      flashSaved();
                    }
                  }}>
                    Clear Local Cache
                  </Button>
                </div>

                <div className="border-t border-surface-800 pt-5">
                  <BackupRestoreSection />
                </div>
              </div>
            </Section>

            {/* ─── Security ─── */}
            <Section id="security" icon={Shield} iconBg="bg-emerald-500/10" iconColor="text-emerald-500 dark:text-emerald-400" title="Security" desc="Account protection">
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-surface-200">Two-Factor Authentication</p>
                    <p className="text-xs text-surface-500 mt-0.5">Add an extra layer of security</p>
                  </div>
                  <Badge className="rounded-md border border-surface-700 px-2 py-1 text-[10px] uppercase tracking-wider">Coming Soon</Badge>
                </div>
                <div className="flex items-center justify-between py-2.5 border-t border-surface-800">
                  <div>
                    <p className="text-sm font-medium text-surface-200">Active Sessions</p>
                    <p className="text-xs text-surface-500 mt-0.5">Manage devices signed into your account</p>
                  </div>
                  <Badge className="rounded-md border border-surface-700 px-2 py-1 text-[10px] uppercase tracking-wider">Coming Soon</Badge>
                </div>
              </div>
            </Section>

            <div className="h-16" />
          </motion.div>
        </main>
      </div>
    </div>
  );
}

/* ─── Reusable Pieces ─── */

function Section({ id, icon: Icon, iconBg, iconColor, title, desc, children }: {
  id: string; icon: any; iconBg: string; iconColor: string; title: string; desc: string; children: React.ReactNode;
}) {
  return (
    <motion.section id={id} variants={fadeUp}
      className="rounded-2xl border border-surface-800/80 bg-surface-900/70 backdrop-blur-sm p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-8 h-8 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center`}>
          <Icon size={16} />
        </div>
        <div>
          <h2 className="font-display font-bold text-surface-50 text-[15px]">{title}</h2>
          <p className="text-xs text-surface-500 mt-0.5">{desc}</p>
        </div>
      </div>
      {children}
    </motion.section>
  );
}

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

/* ─── Notification Settings ─── */

function NotificationSettingsSection({ onSaved }: { onSaved: () => void }) {
  // IES-P1-21: keep the toggles in component state so changes apply in place —
  // the old implementation re-read localStorage at render and forced a full
  // page reload to see the new value (discarding timer/drafts).
  const [settings, setSettings] = useState<NotificationSettings>(getNotificationSettings);

  const updateSetting = (key: keyof NotificationSettings, value: boolean) => {
    const next = { ...settings, [key]: value };
    saveNotificationSettings(next);
    setSettings(next);
    onSaved();
  };

  const handleEnableAll = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      const next = { enabled: true, deadlineReminders: true, habitReminders: true, dailyGoalReminder: true };
      saveNotificationSettings(next);
      setSettings(next);
      onSaved();
    }
  };

  if (Notification.permission === 'denied') {
    return (
      <EmptyState
        className="rounded-xl border border-surface-800 bg-surface-850/50 !py-8"
        icon={<Bell size={20} />}
        title="Browser notifications are blocked"
        description="Enable them in your browser settings."
      />
    );
  }

  const notifItems = [
    { key: 'deadlineReminders' as const, label: 'Deadline Reminders', desc: 'Tasks due or overdue', icon: '⏰' },
    { key: 'habitReminders' as const, label: 'Habit Reminders', desc: 'Scheduled habit nudges', icon: '✅' },
    { key: 'dailyGoalReminder' as const, label: 'Daily Goal', desc: 'Evening goal check-in', icon: '🎯' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between py-1">
        <div>
          <p className="text-sm font-medium text-surface-200">Enable Notifications</p>
          <p className="text-xs text-surface-500 mt-0.5">Master switch for all alerts</p>
        </div>
        {Notification.permission !== 'granted' ? (
          <Button size="sm" onClick={handleEnableAll}>Enable</Button>
        ) : (
          <Toggle enabled={settings.enabled} onToggle={() => { updateSetting('enabled', !settings.enabled); }} />
        )}
      </div>

      <AnimatePresence>
        {settings.enabled && Notification.permission === 'granted' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="space-y-1 overflow-hidden border-t border-surface-800 pt-3">
            {notifItems.map(({ key, label, desc, icon }) => (
              <div key={key} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-base">{icon}</span>
                  <div>
                    <p className="text-sm font-medium text-surface-200">{label}</p>
                    <p className="text-xs text-surface-500 mt-0.5">{desc}</p>
                  </div>
                </div>
                <Toggle enabled={settings[key]} onToggle={() => updateSetting(key, !settings[key])} />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
