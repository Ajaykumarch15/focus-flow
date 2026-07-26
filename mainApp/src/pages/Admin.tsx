import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, Loader2, Clock, CheckCircle2, BarChart3, BookMarked,
  ChevronRight, ChevronDown, GitBranch, ArrowLeft, TrendingUp, Zap, Activity,
  Plus, Trash2, Edit2, X, Check, ShieldCheck, Globe, AlertTriangle,
  Target, RefreshCw, UserX, UserCheck, Trash, RotateCcw, Star, Calendar,
} from 'lucide-react';
import { format, eachDayOfInterval, subDays } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import { api } from '../utils/api';
import { toast } from '../store/useToastStore';
import { renderMarkdown } from '../components/ui/proEditor';
import { Skeleton, SkeletonStatCard } from '../components/ui/Skeleton';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router-dom';

// ── Types ─────────────────────────────────────────────────────────────────────
interface UserSummary { _id: string; name: string; email: string; role: string; avatar?: string; createdAt: string; deletedAt?: string | null; }
interface Team { _id: string; name: string; description?: string; members: UserSummary[]; createdAt: string; }
interface GlobalStats { totalUsers: number; activeUsers: number; todayTotalMs: number; todaySessionCount: number; }
type FilterRange = 'today' | 'week' | 'month' | 'all';
type AdminTab = 'overview' | 'users' | 'teams' | 'analytics' | 'activity';

// ── Motion ────────────────────────────────────────────────────────────────────
const stagger = { show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatMs(ms: number): string {
  if (!ms || ms < 0) return '0h';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatMsHours(ms: number): string {
  return (ms / 3600000).toFixed(1);
}

const ACTION_LABELS: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  'login':              { label: 'Logged in',          color: 'text-blue-400',    bg: 'bg-blue-500/10',    icon: Globe },
  'user.created':       { label: 'User created',       color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: Users },
  'user.updated':       { label: 'User updated',       color: 'text-sky-400',     bg: 'bg-sky-500/10',     icon: Edit2 },
  'user.role_changed':  { label: 'Role changed',       color: 'text-amber-400',   bg: 'bg-amber-500/10',   icon: ShieldCheck },
  'user.deleted':       { label: 'User deleted',       color: 'text-red-400',     bg: 'bg-red-500/10',     icon: UserX },
  'user.restored':      { label: 'User restored',      color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: UserCheck },
  'team.created':       { label: 'Team created',       color: 'text-purple-400',  bg: 'bg-purple-500/10',  icon: Users },
  'team.updated':       { label: 'Team updated',       color: 'text-purple-400',  bg: 'bg-purple-500/10',  icon: Edit2 },
  'team.deleted':       { label: 'Team deleted',       color: 'text-red-400',     bg: 'bg-red-500/10',     icon: Trash2 },
  'task.created':       { label: 'Task created',       color: 'text-brand-400',   bg: 'bg-brand-500/10',   icon: Plus },
  'task.completed':     { label: 'Task completed',     color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  'task.deleted':       { label: 'Task deleted',       color: 'text-red-400',     bg: 'bg-red-500/10',     icon: Trash2 },
  'session.started':    { label: 'Session started',    color: 'text-amber-400',   bg: 'bg-amber-500/10',   icon: Zap },
  'session.completed':  { label: 'Session completed',  color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  'worklog.created':    { label: 'Work log created',   color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    icon: BookMarked },
  'worklog.closed':     { label: 'Work log closed',    color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <motion.div variants={fadeUp}
      className="rounded-2xl border border-surface-800 bg-surface-900 p-5 hover:border-surface-700 transition-all relative overflow-hidden group">
      <div className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
        style={{ background: `${color}12` }}>
        <Icon size={18} style={{ color }} />
      </div>
      <p className="text-2xl font-display font-extrabold text-surface-50 mb-0.5">{value}</p>
      <p className="text-xs font-medium text-surface-400">{label}</p>
      {sub && <p className="text-[11px] text-emerald-400 mt-1">{sub}</p>}
    </motion.div>
  );
}

// ── Filter Selector ───────────────────────────────────────────────────────────
function FilterSelector({ active, onChange }: { active: FilterRange; onChange: (f: FilterRange) => void }) {
  return (
    <div className="flex gap-1 bg-surface-800/60 p-1 rounded-xl border border-surface-800">
      {(['today', 'week', 'month', 'all'] as const).map(f => (
        <button key={f} onClick={() => onChange(f)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
            active === f ? 'bg-surface-700/80 text-surface-50 shadow-sm border border-surface-600/30' : 'text-surface-400 hover:text-surface-200'
          }`}>{f}</button>
      ))}
    </div>
  );
}

// ── Activity Feed Item ────────────────────────────────────────────────────────
function ActivityItem({ activity }: { activity: any }) {
  const meta = ACTION_LABELS[activity.action] || { label: activity.action, color: 'text-surface-400', bg: 'bg-surface-800', icon: Activity };
  const Icon = meta.icon;
  const user = activity.userId;
  const timeAgo = useMemo(() => {
    const diff = Date.now() - new Date(activity.createdAt).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }, [activity.createdAt]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-850/50 transition-colors border border-transparent hover:border-surface-800">
      <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={14} className={meta.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-200">
          {user ? <span className="font-semibold text-surface-100">{user.name}</span> : <span className="text-surface-500">System</span>}
          {' '}{meta.label.toLowerCase()}
          {activity.details?.taskTitle && <span className="text-surface-400"> "{activity.details.taskTitle}"</span>}
          {activity.details?.teamName && <span className="text-surface-400"> "{activity.details.teamName}"</span>}
          {activity.details?.worklogTitle && <span className="text-surface-400"> "{activity.details.worklogTitle}"</span>}
          {activity.details?.newRole && <span className="text-amber-400"> to {activity.details.newRole}</span>}
        </p>
      </div>
      <span className="text-[11px] text-surface-500 flex-shrink-0">{timeAgo}</span>
    </motion.div>
  );
}

// ── Edit User Modal ───────────────────────────────────────────────────────────
function EditUserModal({ user, onClose, onSave }: { user: UserSummary; onClose: () => void; onSave: (data: any) => Promise<void> }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ name, email, role });
      onClose();
    } catch { } finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }} transition={{ duration: 0.2 }}
        className="w-full max-w-md rounded-2xl border border-surface-800 bg-surface-900 p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-surface-50">Edit User</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-surface-400 font-medium mb-1 block">Name</label>
            <input className="input w-full rounded-xl text-sm" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-surface-400 font-medium mb-1 block">Email</label>
            <input className="input w-full rounded-xl text-sm" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-surface-400 font-medium mb-1 block">Role</label>
            <div className="flex gap-2">
              {['user', 'admin'].map(r => (
                <button key={r} onClick={() => setRole(r)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                    role === r ? 'bg-brand-500/15 text-brand-400 border-brand-500/30' : 'bg-surface-800 text-surface-400 border-surface-800 hover:text-surface-200'
                  }`}>
                  {r === 'admin' ? <ShieldCheck size={14} className="inline mr-1.5" /> : <Users size={14} className="inline mr-1.5" />}
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1 py-2.5 rounded-xl text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim() || !email.trim()}
            className="btn-primary flex-1 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Team Create/Edit Modal ────────────────────────────────────────────────────
function TeamModal({ editing, users, onClose, onSave }: {
  editing: Team | null; users: UserSummary[]; onClose: () => void;
  onSave: (data: { name: string; description: string; members: string[] }) => Promise<void>;
}) {
  const [name, setName] = useState(editing?.name || '');
  const [desc, setDesc] = useState(editing?.description || '');
  const [members, setMembers] = useState<string[]>(editing?.members.map(m => m._id) || []);
  const [memberSearch, setMemberSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const filtered = users.filter(u => u.name.toLowerCase().includes(memberSearch.toLowerCase()) || u.email.toLowerCase().includes(memberSearch.toLowerCase()));
  const toggle = (id: string) => setMembers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg rounded-2xl border border-surface-800 bg-surface-900 p-6 shadow-2xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-surface-50">{editing ? 'Edit Team' : 'New Team'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400"><X size={16} /></button>
        </div>
        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div>
            <label className="text-xs text-surface-400 font-medium mb-1 block">Team Name</label>
            <input className="input w-full rounded-xl text-sm" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Frontend Team" />
          </div>
          <div>
            <label className="text-xs text-surface-400 font-medium mb-1 block">Description</label>
            <textarea className="input w-full rounded-xl text-sm resize-none" rows={2} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional description..." />
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <label className="text-xs text-surface-400 font-medium mb-1 block">Members ({members.length})</label>
            <input className="input w-full rounded-xl text-sm mb-2" placeholder="Search users..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
            <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin max-h-48">
              {filtered.map(u => (
                <button key={u._id} onClick={() => toggle(u._id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${
                    members.includes(u._id) ? 'bg-brand-500/10 border border-brand-500/30' : 'hover:bg-surface-850 border border-transparent'
                  }`}>
                  <div className="w-7 h-7 rounded-full bg-surface-800 flex items-center justify-center text-xs font-bold text-surface-300 flex-shrink-0">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-200 font-medium truncate">{u.name}</p>
                    <p className="text-[11px] text-surface-500 truncate">{u.email}</p>
                  </div>
                  {members.includes(u._id) && <Check size={14} className="text-brand-400 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5 pt-4 border-t border-surface-800">
          <button onClick={onClose} className="btn-secondary flex-1 py-2.5 rounded-xl text-sm">Cancel</button>
          <button onClick={async () => { setSaving(true); try { await onSave({ name, description: desc, members }); onClose(); } catch {} finally { setSaving(false); } }}
            disabled={saving || !name.trim()}
            className="btn-primary flex-1 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {editing ? 'Update' : 'Create'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function AdminDashboard() {
  const { profile } = useStore();
  const navigate = useNavigate();
  const accent = '#0ea5e9';

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [deletedUsers, setDeletedUsers] = useState<UserSummary[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterRange>('week');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');

  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<any>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamAnalytics, setTeamAnalytics] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showEditUser, setShowEditUser] = useState<UserSummary | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<UserSummary | null>(null);
  const [showTrash, setShowTrash] = useState(false);

  const [systemAnalytics, setSystemAnalytics] = useState<any>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<string>('month');
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const [activities, setActivities] = useState<any[]>([]);
  const [activityFilter, setActivityFilter] = useState('');
  const [loadingActivity, setLoadingActivity] = useState(false);
  const activityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const todayStr = format(new Date(), 'EEEE, MMMM d, yyyy');

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadBaseData = useCallback(async () => {
    setLoading(true);
    try {
      const [u, t, s] = await Promise.all([api.admin.listUsers(), api.teams.list(), api.admin.getStats()]);
      setUsers(u); setTeams(t); setStats(s);
    } catch (err: any) { toast.error('Failed to load admin data', err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadBaseData(); }, [loadBaseData]);

  const loadUserDetail = useCallback(async (userId: string, range?: FilterRange) => {
    setLoadingDetail(true);
    try {
      let from: number | undefined;
      const now = Date.now();
      if (range && range !== 'all') {
        const rangeMs = { today: 86400000, week: 7 * 86400000, month: 30 * 86400000 };
        from = now - (rangeMs[range as keyof typeof rangeMs] || 30 * 86400000);
      }
      const data = await api.admin.getUserAnalytics(userId, from);
      setUserAnalytics(data);
    } catch (err: any) { toast.error('Failed to load user analytics', err.message); }
    finally { setLoadingDetail(false); }
  }, []);

  const loadTeamDetail = useCallback(async (teamId: string, range?: FilterRange) => {
    setLoadingDetail(true);
    try {
      let from: number | undefined;
      const now = Date.now();
      if (range && range !== 'all') {
        const rangeMs = { today: 86400000, week: 7 * 86400000, month: 30 * 86400000 };
        from = now - (rangeMs[range as keyof typeof rangeMs] || 30 * 86400000);
      }
      const data = await api.teams.getAnalytics(teamId, from);
      setTeamAnalytics(data);
    } catch (err: any) { toast.error('Failed to load team analytics', err.message); }
    finally { setLoadingDetail(false); }
  }, []);

  useEffect(() => {
    if (selectedUser) loadUserDetail(selectedUser._id, filter);
  }, [selectedUser, filter, loadUserDetail]);

  useEffect(() => {
    if (selectedTeam) loadTeamDetail(selectedTeam._id, filter);
  }, [selectedTeam, filter, loadTeamDetail]);

  const loadSystemAnalytics = useCallback(async (period: string) => {
    setLoadingAnalytics(true);
    try {
      const data = await api.admin.getSystemAnalytics(period);
      setSystemAnalytics(data);
    } catch (err: any) { toast.error('Failed to load analytics', err.message); }
    finally { setLoadingAnalytics(false); }
  }, []);

  useEffect(() => { loadSystemAnalytics(analyticsPeriod); }, [analyticsPeriod, loadSystemAnalytics]);

  const loadActivity = useCallback(async (reset = false) => {
    setLoadingActivity(true);
    try {
      const before = reset || activities.length === 0 ? undefined : activities[activities.length - 1]?.createdAt;
      const data = await api.admin.getActivity(50, before, activityFilter || undefined);
      if (reset || activities.length === 0) setActivities(data);
      else setActivities(prev => [...prev, ...data]);
    } catch (err: any) { toast.error('Failed to load activity', err.message); }
    finally { setLoadingActivity(false); }
  }, [activityFilter, activities.length]);

  useEffect(() => {
    if (activeTab === 'activity') {
      loadActivity(true);
      activityIntervalRef.current = setInterval(() => loadActivity(true), 20000);
      return () => { if (activityIntervalRef.current) clearInterval(activityIntervalRef.current); };
    } else {
      if (activityIntervalRef.current) clearInterval(activityIntervalRef.current);
    }
  }, [activeTab, loadActivity]);

  useEffect(() => {
    if (activeTab === 'activity') loadActivity(true);
  }, [activityFilter, loadActivity]);

  // ── User CRUD handlers ───────────────────────────────────────────────────
  const handleUpdateUser = async (data: any) => {
    if (!showEditUser) return;
    const updated = await api.admin.updateUser(showEditUser._id, data);
    setUsers(prev => prev.map(u => u._id === updated._id ? updated : u));
    toast.success('User updated', `${updated.name} has been updated.`);
  };

  const handleDeleteUser = async () => {
    if (!showDeleteConfirm) return;
    await api.admin.deleteUser(showDeleteConfirm._id);
    const deleted = users.find(u => u._id === showDeleteConfirm._id);
    if (deleted) { setUsers(prev => prev.filter(u => u._id !== deleted._id)); setDeletedUsers(prev => [deleted, ...prev]); }
    setShowDeleteConfirm(null);
    toast.success('User deleted', `${showDeleteConfirm.name} has been soft-deleted.`);
  };

  const handleRestoreUser = async (userId: string) => {
    const restored = await api.admin.restoreUser(userId);
    setDeletedUsers(prev => prev.filter(u => u._id !== userId));
    setUsers(prev => [restored, ...prev]);
    toast.success('User restored', `${restored.name} has been restored.`);
  };

  // ── Team CRUD handlers ───────────────────────────────────────────────────
  const handleSaveTeam = async (data: { name: string; description: string; members: string[] }) => {
    if (editingTeam) {
      const updated = await api.teams.update(editingTeam._id, data);
      setTeams(prev => prev.map(t => t._id === updated._id ? updated : t));
      toast.success('Team updated', `"${data.name}" has been updated.`);
    } else {
      const created = await api.teams.create(data);
      setTeams(prev => [created, ...prev]);
      toast.success('Team created', `"${data.name}" has been created.`);
    }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm('Delete this team? This cannot be undone.')) return;
    await api.teams.delete(id);
    setTeams(prev => prev.filter(t => t._id !== id));
    toast.success('Team deleted');
  };

  // ── Filtered lists ───────────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    let list = users;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    if (roleFilter !== 'all') list = list.filter(u => u.role === roleFilter);
    return list;
  }, [users, search, roleFilter]);

  const filteredTeams = useMemo(() => {
    if (!search.trim()) return teams;
    const q = search.toLowerCase();
    return teams.filter(t => t.name.toLowerCase().includes(q));
  }, [teams, search]);

  const resetView = () => { setSelectedUser(null); setSelectedTeam(null); setUserAnalytics(null); setTeamAnalytics(null); setSearch(''); };

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) return <div className="p-6 lg:p-8 max-w-[1500px] mx-auto"><div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{Array.from({length:4}).map((_,i) => <SkeletonStatCard key={i} />)}</div></div>;

  return (
    <div className="p-6 lg:p-8 max-w-[1500px] mx-auto space-y-6">

      {/* ═══ Hero Banner ═══ */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl border border-surface-800/60 bg-surface-900 p-8 lg:p-10 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at top right, ${accent}15, transparent 70%)` }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at bottom left, #8b5cf615, transparent 70%)' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-extrabold text-surface-50 tracking-tight flex items-center gap-3">
              <ShieldCheck size={28} className="text-purple-400" /> Admin Console
            </h1>
            <p className="text-surface-400 text-sm mt-1">{todayStr}</p>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-xs text-surface-400">{stats?.totalUsers || 0} users</span>
              <span className="text-xs text-surface-400">{teams.length} teams</span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <motion.span className="w-2 h-2 rounded-full bg-emerald-400" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
                {stats?.activeUsers || 0} active now
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══ KPI Cards ═══ */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users" value={String(stats?.totalUsers || 0)} color="#8b5cf6" />
        <StatCard icon={Zap} label="Active Now" value={String(stats?.activeUsers || 0)}
          sub={stats?.totalUsers ? `${Math.round((stats.activeUsers / stats.totalUsers) * 100)}% of total` : undefined} color="#f59e0b" />
        <StatCard icon={Clock} label="Today Focus" value={`${formatMsHours(stats?.todayTotalMs || 0)}h`} color={accent} />
        <StatCard icon={Activity} label="Today Sessions" value={String(stats?.todaySessionCount || 0)} color="#10b981" />
      </motion.div>

      {/* ═══ Tab Navigation ═══ */}
      <div className="flex items-center gap-1 bg-surface-800/60 p-1 rounded-xl border border-surface-800 overflow-x-auto">
        {([
          { id: 'overview' as AdminTab, label: 'Overview', icon: Globe },
          { id: 'users' as AdminTab, label: 'Users', icon: Users },
          { id: 'teams' as AdminTab, label: 'Teams', icon: Users },
          { id: 'analytics' as AdminTab, label: 'Analytics', icon: BarChart3 },
          { id: 'activity' as AdminTab, label: 'Activity', icon: Activity },
        ]).map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id !== 'users' && tab.id !== 'teams') resetView(); }}
              className={`relative flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                isActive ? 'text-surface-50' : 'text-surface-400 hover:text-surface-200'
              }`}>
              {isActive && <motion.div layoutId="adminTab" className="absolute inset-0 bg-surface-700/80 rounded-lg border border-surface-600/30" transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }} />}
              <span className="relative flex items-center gap-1.5"><tab.icon size={13} /> {tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ═══ Content Area ═══ */}
      <AnimatePresence mode="wait">

        {/* ─── Detail Views ─────────────────────────────────────────── */}
        {selectedUser && (
          <motion.div key="user-detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <UserDetailView user={selectedUser} analytics={userAnalytics} loading={loadingDetail}
              filter={filter} setFilter={setFilter} onBack={() => { setSelectedUser(null); setUserAnalytics(null); }}
              accent={accent} />
          </motion.div>
        )}

        {selectedTeam && (
          <motion.div key="team-detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <TeamDetailView team={selectedTeam} analytics={teamAnalytics} loading={loadingDetail}
              filter={filter} setFilter={setFilter} onBack={() => { setSelectedTeam(null); setTeamAnalytics(null); }} />
          </motion.div>
        )}

        {/* ─── Overview Tab ─────────────────────────────────────────── */}
        {!selectedUser && !selectedTeam && activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Users */}
            <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-surface-100 flex items-center gap-2"><Users size={14} className="text-purple-400" /> Recent Users</h3>
                <button onClick={() => { setActiveTab('users'); resetView(); }} className="text-xs text-surface-500 hover:text-surface-200 flex items-center gap-1">View All <ChevronRight size={12} /></button>
              </div>
              <div className="space-y-2">
                {users.slice(0, 5).map(u => (
                  <button key={u._id} onClick={() => setSelectedUser(u)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-850 transition-colors text-left">
                    <div className="w-8 h-8 rounded-full bg-surface-800 flex items-center justify-center text-xs font-bold text-surface-300">{u.name.charAt(0).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-surface-200 font-medium truncate">{u.name}</p>
                      <p className="text-[11px] text-surface-500 truncate">{u.email}</p>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${u.role === 'admin' ? 'bg-purple-500/15 text-purple-400' : 'bg-surface-800 text-surface-500'}`}>{u.role}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Active Teams */}
            <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-surface-100 flex items-center gap-2"><Users size={14} className="text-sky-400" /> Teams</h3>
                <button onClick={() => { setActiveTab('teams'); resetView(); }} className="text-xs text-surface-500 hover:text-surface-200 flex items-center gap-1">View All <ChevronRight size={12} /></button>
              </div>
              <div className="space-y-2">
                {teams.length === 0 ? (
                  <p className="text-sm text-surface-500 text-center py-6">No teams yet</p>
                ) : teams.slice(0, 5).map(t => (
                  <button key={t._id} onClick={() => setSelectedTeam(t)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-850 transition-colors text-left">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center"><Users size={14} className="text-sky-400" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-surface-200 font-medium truncate">{t.name}</p>
                      <p className="text-[11px] text-surface-500">{t.members.length} member{t.members.length !== 1 ? 's' : ''}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Users Tab ───────────────────────────────────────────── */}
        {!selectedUser && !selectedTeam && activeTab === 'users' && (
          <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="flex items-center gap-3 flex-wrap mb-5">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
                <input className="input h-10 pl-9 pr-4 rounded-xl text-sm" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="flex gap-1.5">
                {(['all', 'admin', 'user'] as const).map(r => (
                  <button key={r} onClick={() => setRoleFilter(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                      roleFilter === r ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30' : 'bg-surface-800 text-surface-400 border border-surface-800 hover:text-surface-200'
                    }`}>{r}</button>
                ))}
              </div>
              <button onClick={() => setShowTrash(!showTrash)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-surface-400 hover:text-red-400 bg-surface-800 border border-surface-800 transition-all">
                <Trash size={12} /> Trash {deletedUsers.length > 0 && <span className="text-[10px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-md">{deletedUsers.length}</span>}
              </button>
            </div>

            {/* Trash Section */}
            {showTrash && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 mb-5">
                <h4 className="text-sm font-bold text-red-400 mb-3 flex items-center gap-2"><Trash size={14} /> Deleted Users</h4>
                {deletedUsers.length === 0 ? <p className="text-xs text-surface-500">No deleted users</p> : (
                  <div className="space-y-2">
                    {deletedUsers.map(u => (
                      <div key={u._id} className="flex items-center gap-3 p-2 rounded-xl bg-surface-900/50">
                        <div className="w-7 h-7 rounded-full bg-surface-800 flex items-center justify-center text-xs font-bold text-surface-400">{u.name.charAt(0).toUpperCase()}</div>
                        <div className="flex-1 min-w-0"><p className="text-sm text-surface-300 truncate">{u.name}</p></div>
                        <button onClick={() => handleRestoreUser(u._id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center gap-1">
                          <RotateCcw size={11} /> Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* User Grid */}
            <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUsers.map(u => (
                <motion.div key={u._id} variants={fadeUp} whileHover={{ y: -3 }}
                  className="rounded-2xl border border-surface-800 bg-surface-900 p-5 hover:border-surface-700 hover:shadow-lg transition-all cursor-pointer"
                  onClick={() => setSelectedUser(u)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-surface-800 flex items-center justify-center text-sm font-bold text-surface-300">{u.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <p className="text-sm font-semibold text-surface-100">{u.name}</p>
                        <p className="text-[11px] text-surface-500">{u.email}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${u.role === 'admin' ? 'bg-purple-500/15 text-purple-400' : 'bg-surface-800 text-surface-500'}`}>{u.role}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-surface-500">Joined {format(new Date(u.createdAt), 'MMM d, yyyy')}</span>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setShowEditUser(u)} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-500 hover:text-surface-200 transition-all"><Edit2 size={13} /></button>
                      <button onClick={() => setShowDeleteConfirm(u)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-surface-500 hover:text-red-400 transition-all"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* ─── Teams Tab ───────────────────────────────────────────── */}
        {!selectedUser && !selectedTeam && activeTab === 'teams' && (
          <motion.div key="teams" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
                <input className="input h-10 pl-9 pr-4 rounded-xl text-sm" placeholder="Search teams..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <button onClick={() => { setEditingTeam(null); setShowTeamModal(true); }}
                className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm">
                <Plus size={14} /> New Team
              </button>
            </div>
            <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTeams.map(t => (
                <motion.div key={t._id} variants={fadeUp} whileHover={{ y: -3 }}
                  className="rounded-2xl border border-surface-800 bg-surface-900 p-5 hover:border-surface-700 hover:shadow-lg transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedTeam(t)}>
                      <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center"><Users size={16} className="text-sky-400" /></div>
                      <div>
                        <p className="text-sm font-semibold text-surface-100">{t.name}</p>
                        {t.description && <p className="text-[11px] text-surface-500 truncate max-w-[180px]">{t.description}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mb-3">
                    {t.members.slice(0, 5).map((m, i) => (
                      <div key={m._id} className="w-6 h-6 rounded-full bg-surface-800 flex items-center justify-center text-[9px] font-bold text-surface-400 -ml-1 first:ml-0 border border-surface-900">{m.name.charAt(0).toUpperCase()}</div>
                    ))}
                    {t.members.length > 5 && <span className="text-[10px] text-surface-500 ml-1">+{t.members.length - 5}</span>}
                  </div>
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setSelectedTeam(t)} className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-surface-800 text-surface-300 hover:text-surface-100 transition-all">Analytics</button>
                    <button onClick={() => { setEditingTeam(t); setShowTeamModal(true); }} className="p-1.5 rounded-lg bg-surface-800 text-surface-400 hover:text-surface-200 transition-all"><Edit2 size={13} /></button>
                    <button onClick={() => handleDeleteTeam(t._id)} className="p-1.5 rounded-lg bg-surface-800 text-surface-400 hover:text-red-400 transition-all"><Trash2 size={13} /></button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* ─── Analytics Tab ───────────────────────────────────────── */}
        {!selectedUser && !selectedTeam && activeTab === 'analytics' && (
          <motion.div key="analytics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex gap-1 bg-surface-800/60 p-1 rounded-xl border border-surface-800">
                {(['week', 'month', 'quarter'] as const).map(p => (
                  <button key={p} onClick={() => setAnalyticsPeriod(p)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                      analyticsPeriod === p ? 'bg-surface-700/80 text-surface-50 shadow-sm border border-surface-600/30' : 'text-surface-400 hover:text-surface-200'
                    }`}>{p}</button>
                ))}
              </div>
            </div>
            {loadingAnalytics ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({length:4}).map((_,i) => <SkeletonStatCard key={i} />)}</div>
            ) : systemAnalytics && (
              <>
                <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <StatCard icon={Users} label="Active Users" value={String(systemAnalytics.activeUsers || 0)} color="#8b5cf6" />
                  <StatCard icon={Clock} label="Total Focus" value={`${formatMsHours(systemAnalytics.totalFocusMs || 0)}h`} color={accent} />
                  <StatCard icon={Target} label="Completion Rate" value={`${systemAnalytics.taskCompletionRate || 0}%`} color="#10b981" />
                  <StatCard icon={Star} label="Avg Focus Score" value={String(systemAnalytics.avgFocusScore || 0)} sub="out of 100" color="#f59e0b" />
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Daily Focus Chart */}
                  <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
                    <h3 className="text-sm font-bold text-surface-100 mb-4 flex items-center gap-2"><BarChart3 size={14} className="text-brand-400" /> Daily Focus Hours</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={systemAnalytics.dailyFocus || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-800)" />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-surface-500)' }} tickFormatter={v => v.slice(5)} />
                          <YAxis tick={{ fontSize: 10, fill: 'var(--color-surface-500)' }} tickFormatter={v => `${v}h`} />
                          <Tooltip contentStyle={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-800)', borderRadius: 12, fontSize: 12 }}
                            formatter={(v: any) => [`${(v / 3600000).toFixed(1)}h`, 'Focus']} labelFormatter={l => l} />
                          <Bar dataKey="totalMs" fill={accent} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* User Growth Chart */}
                  <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
                    <h3 className="text-sm font-bold text-surface-100 mb-4 flex items-center gap-2"><TrendingUp size={14} className="text-emerald-400" /> User Signups</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={systemAnalytics.userGrowth || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-800)" />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-surface-500)' }} tickFormatter={v => v.slice(5)} />
                          <YAxis tick={{ fontSize: 10, fill: 'var(--color-surface-500)' }} allowDecimals={false} />
                          <Tooltip contentStyle={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-800)', borderRadius: 12, fontSize: 12 }} />
                          <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Top Categories */}
                {systemAnalytics.topCategories?.length > 0 && (
                  <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
                    <h3 className="text-sm font-bold text-surface-100 mb-4 flex items-center gap-2"><Globe size={14} className="text-purple-400" /> Top Categories</h3>
                    <div className="space-y-2">
                      {systemAnalytics.topCategories.map((cat: any, i: number) => {
                        const maxMs = Math.max(...systemAnalytics.topCategories.map((c: any) => c.totalTimeMs), 1);
                        const pct = (cat.totalTimeMs / maxMs) * 100;
                        return (
                          <div key={cat.category} className="flex items-center gap-3">
                            <span className="text-xs text-surface-400 w-24 truncate">{cat.category}</span>
                            <div className="flex-1 h-6 rounded-lg bg-surface-800 overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: i * 0.05 }}
                                className="h-full rounded-lg" style={{ background: `linear-gradient(90deg, ${accent}40, ${accent})` }} />
                            </div>
                            <span className="text-xs text-surface-400 font-mono w-16 text-right">{formatMs(cat.totalTimeMs)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* ─── Activity Tab ────────────────────────────────────────── */}
        {!selectedUser && !selectedTeam && activeTab === 'activity' && (
          <motion.div key="activity" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex gap-1 bg-surface-800/60 p-1 rounded-xl border border-surface-800 overflow-x-auto">
                {[{ id: '', label: 'All' }, { id: 'login', label: 'Logins' }, { id: 'user', label: 'Users' }, { id: 'team', label: 'Teams' }, { id: 'task', label: 'Tasks' }, { id: 'session', label: 'Sessions' }, { id: 'worklog', label: 'Work Logs' }].map(f => (
                  <button key={f.id} onClick={() => setActivityFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                      activityFilter === f.id ? 'bg-surface-700/80 text-surface-50 shadow-sm' : 'text-surface-400 hover:text-surface-200'
                    }`}>{f.label}</button>
                ))}
              </div>
              <button onClick={() => loadActivity(true)} className="p-2 rounded-lg bg-surface-800 text-surface-400 hover:text-surface-200 transition-all">
                <RefreshCw size={14} className={loadingActivity ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="rounded-2xl border border-surface-800 bg-surface-900 divide-y divide-surface-800 max-h-[600px] overflow-y-auto scrollbar-thin">
              {activities.length === 0 && !loadingActivity ? (
                <div className="p-12 text-center"><Activity size={28} className="text-surface-600 mx-auto mb-3" /><p className="text-sm text-surface-400">No activity recorded yet</p></div>
              ) : (
                activities.map((a: any) => <ActivityItem key={a._id} activity={a} />)
              )}
              {loadingActivity && activities.length === 0 && (
                <div className="p-8 text-center"><Loader2 size={20} className="text-brand-400 animate-spin mx-auto" /></div>
              )}
            </div>
            {activities.length > 0 && (
              <button onClick={() => loadActivity(false)} disabled={loadingActivity}
                className="w-full mt-3 py-2.5 rounded-xl text-xs font-semibold text-surface-400 hover:text-surface-200 bg-surface-800 border border-surface-800 hover:border-surface-700 transition-all flex items-center justify-center gap-2">
                {loadingActivity ? <Loader2 size={13} className="animate-spin" /> : <ChevronDown size={13} />} Load more
              </button>
            )}
          </motion.div>
        )}

      </AnimatePresence>

      {/* ═══ Modals ═══ */}
      <AnimatePresence>
        {showTeamModal && <TeamModal editing={editingTeam} users={users} onClose={() => { setShowTeamModal(false); setEditingTeam(null); }} onSave={handleSaveTeam} />}
        {showEditUser && <EditUserModal user={showEditUser} onClose={() => setShowEditUser(null)} onSave={handleUpdateUser} />}
        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-surface-800 bg-surface-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={22} className="text-red-400" />
              </div>
              <h3 className="text-center font-display font-bold text-surface-50 mb-2">Delete User</h3>
              <p className="text-sm text-surface-400 text-center mb-5">
                Are you sure you want to delete <span className="font-semibold text-surface-200">{showDeleteConfirm.name}</span>?
                This is a soft-delete — they can be restored from the trash.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(null)} className="btn-secondary flex-1 py-2.5 rounded-xl text-sm">Cancel</button>
                <button onClick={handleDeleteUser} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500 hover:bg-red-400 text-white transition-all">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── User Detail View ──────────────────────────────────────────────────────────
function UserDetailView({ user, analytics, loading, filter, setFilter, onBack, accent }: {
  user: UserSummary; analytics: any; loading: boolean; filter: FilterRange; setFilter: (f: FilterRange) => void;
  onBack: () => void; accent: string;
}) {
  const [detailTab, setDetailTab] = useState<'analytics' | 'worklogs' | 'reports'>('analytics');
  const navigate = useNavigate();

  const chartData = useMemo(() => {
    if (!analytics?.sessions) return [];
    const map: Record<string, number> = {};
    analytics.sessions.forEach((s: any) => {
      const d = new Date(s.startTime).toISOString().slice(0, 10);
      map[d] = (map[d] || 0) + (s.activeTime || 0);
    });
    return Object.entries(map).slice(-7).map(([date, ms]) => ({ date: date.slice(5), hours: Math.round(ms / 3600000 * 10) / 10 }));
  }, [analytics]);

  if (loading) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({length:4}).map((_,i) => <SkeletonStatCard key={i} />)}</div>;

  const summary = analytics?.summary;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-surface-800 text-surface-400 transition-colors"><ArrowLeft size={18} /></button>
        <div className="w-12 h-12 rounded-xl bg-surface-800 flex items-center justify-center text-lg font-bold text-surface-300">{user.name.charAt(0).toUpperCase()}</div>
        <div className="flex-1">
          <h2 className="text-lg font-display font-bold text-surface-50">{user.name}</h2>
          <p className="text-xs text-surface-400">{user.email}</p>
        </div>
        <span className={`text-xs font-bold uppercase px-3 py-1 rounded-lg ${user.role === 'admin' ? 'bg-purple-500/15 text-purple-400' : 'bg-surface-800 text-surface-500'}`}>{user.role}</span>
      </div>

      {/* Stats */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Clock} label="Focus Time" value={`${formatMsHours(summary?.totalTimeMs || 0)}h`} color={accent} />
        <StatCard icon={Target} label="Completion" value={`${summary ? Math.round((summary.completedTasks / Math.max(summary.totalTasks, 1)) * 100) : 0}%`} color="#10b981" />
        <StatCard icon={BookMarked} label="Work Logs" value={String(summary?.workLogCount || 0)} color="#8b5cf6" />
        <StatCard icon={Zap} label="Sessions" value={String(summary?.sessionCount || 0)} color="#f59e0b" />
      </motion.div>

      {/* Tab Selector + Filter */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex gap-1 bg-surface-800/60 p-1 rounded-xl border border-surface-800">
          {(['analytics', 'worklogs', 'reports'] as const).map(tab => (
            <button key={tab} onClick={() => setDetailTab(tab)}
              className={`relative px-4 py-2 rounded-lg text-xs font-semibold transition-all capitalize ${
                detailTab === tab ? 'text-surface-50' : 'text-surface-400 hover:text-surface-200'
              }`}>
              {detailTab === tab && <motion.div layoutId="userDetailTab" className="absolute inset-0 bg-surface-700/80 rounded-lg border border-surface-600/30" transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }} />}
              <span className="relative">{tab}</span>
            </button>
          ))}
        </div>
        <FilterSelector active={filter} onChange={setFilter} />
      </div>

      {/* Chart */}
      {detailTab === 'analytics' && chartData.length > 0 && (
        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5 mb-6">
          <h3 className="text-sm font-bold text-surface-100 mb-3">Daily Focus (Last 7 Days)</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-800)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-surface-500)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-surface-500)' }} />
                <Tooltip contentStyle={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-800)', borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="hours" fill={accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Work Logs */}
      {detailTab === 'worklogs' && (
        <div className="space-y-3">
          {analytics?.workLogs?.length > 0 ? analytics.workLogs.map((log: any) => (
            <div key={log._id} className="rounded-2xl border border-surface-800 bg-surface-900 p-5 cursor-pointer hover:border-surface-700 transition-all"
              onClick={() => navigate(`/worklog/${log._id}`)}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-surface-100">{log.title}</h4>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                  log.status === 'done' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-brand-500/15 text-brand-400'
                }`}>{log.status}</span>
              </div>
              {log.problem && <p className="text-xs text-surface-400 line-clamp-2 mb-2" dangerouslySetInnerHTML={{ __html: renderMarkdown(log.problem) }} />}
              <div className="flex items-center gap-3 text-[11px] text-surface-500">
                {log.gitBranch && <span className="flex items-center gap-1"><GitBranch size={10} /> {log.gitBranch}</span>}
                <span>{log.completedItems?.length || 0} completed</span>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-surface-800 bg-surface-900 p-12 text-center">
              <BookMarked size={28} className="text-surface-600 mx-auto mb-3" />
              <p className="text-sm text-surface-400">No work logs found</p>
            </div>
          )}
        </div>
      )}

      {/* Reports */}
      {detailTab === 'reports' && <UserReportsView userId={user._id} filter={filter} accent={accent} />}

      {/* Top Tasks */}
      {detailTab === 'analytics' && analytics?.tasks?.length > 0 && (
        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
          <h3 className="text-sm font-bold text-surface-100 mb-3">Top Tasks</h3>
          <div className="space-y-2">
            {analytics.tasks.slice(0, 5).map((t: any) => (
              <div key={t._id} className="flex items-center gap-3 p-2 rounded-xl">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color || accent }} />
                <span className="text-sm text-surface-200 flex-1 truncate">{t.title}</span>
                <span className="text-xs text-surface-500 font-mono">{formatMs(t.totalTime || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── User Reports View (inside admin user detail) ─────────────────────────────
function UserReportsView({ userId, filter, accent }: { userId: string; filter: FilterRange; accent: string }) {
  const [reports, setReports] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<any>(null);
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingDay, setLoadingDay] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingReports(true);
      try {
        const data = await api.admin.getUserReportsSummary(userId);
        if (!cancelled) setReports(data || []);
      } catch { if (!cancelled) setReports([]); }
      finally { if (!cancelled) setLoadingReports(false); }
    })();
    return () => { cancelled = true; };
  }, [userId, filter]);

  useEffect(() => {
    if (!selectedDay) { setDayDetail(null); return; }
    let cancelled = false;
    (async () => {
      setLoadingDay(true);
      try {
        const data = await api.admin.getUserReportDay(userId, selectedDay);
        if (!cancelled) setDayDetail(data);
      } catch { if (!cancelled) setDayDetail(null); }
      finally { if (!cancelled) setLoadingDay(false); }
    })();
    return () => { cancelled = true; };
  }, [userId, selectedDay]);

  const calendarDays = useMemo(() => {
    const end = new Date();
    const start = subDays(end, 29);
    return eachDayOfInterval({ start, end });
  }, []);

  const reportMap = useMemo(() => {
    const m: Record<string, any> = {};
    reports.forEach(r => { m[r.date] = r; });
    return m;
  }, [reports]);

  if (loadingReports) {
    return <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({length:4}).map((_,i) => <SkeletonStatCard key={i} />)}</div>;
  }

  const totalMs = reports.reduce((a, r) => a + (r.totalMs || 0), 0);
  const totalSessions = reports.reduce((a, r) => a + (r.sessionCount || 0), 0);
  const totalCompleted = reports.reduce((a, r) => a + (r.completedCount || 0), 0);
  const activeDays = reports.length;

  return (
    <div className="space-y-5">
      {/* Summary KPIs */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Clock} label="Focus Time" value={`${formatMsHours(totalMs)}h`} color={accent} />
        <StatCard icon={Zap} label="Sessions" value={String(totalSessions)} color="#f59e0b" />
        <StatCard icon={CheckCircle2} label="Completed" value={String(totalCompleted)} color="#10b981" />
        <StatCard icon={Calendar} label="Active Days" value={String(activeDays)} sub="of last 30" color="#8b5cf6" />
      </motion.div>

      {/* Calendar Heatmap */}
      <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
        <h3 className="text-sm font-bold text-surface-100 mb-4 flex items-center gap-2"><Calendar size={14} className="text-purple-400" /> Activity Calendar (Last 30 Days)</h3>
        <div className="grid grid-cols-7 gap-1.5">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-[10px] text-surface-500 text-center font-medium pb-1">{d}</div>
          ))}
          {/* Pad leading cells */}
          {Array.from({ length: calendarDays[0]?.getDay() || 0 }).map((_, i) => <div key={`pad-${i}`} />)}
          {calendarDays.map(day => {
            const dk = format(day, 'yyyy-MM-dd');
            const report = reportMap[dk];
            const ms = report?.totalMs || 0;
            const hours = ms / 3600000;
            const intensity = hours === 0 ? 0 : hours < 1 ? 1 : hours < 3 ? 2 : hours < 6 ? 3 : 4;
            const bg = [
              'bg-surface-800/50',
              'bg-brand-500/15',
              'bg-brand-500/30',
              'bg-brand-500/50',
              'bg-brand-500/80',
            ][intensity];
            const isSelected = selectedDay === dk;
            return (
              <button key={dk} onClick={() => setSelectedDay(isSelected ? null : dk)}
                title={`${dk}: ${report ? formatMsHours(ms) + 'h' : 'No data'}`}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] transition-all border ${
                  isSelected ? 'border-brand-400 ring-1 ring-brand-400/50' : 'border-transparent hover:border-surface-600'
                } ${bg}`}>
                <span className={ms > 0 ? 'text-surface-200 font-medium' : 'text-surface-500'}>{format(day, 'd')}</span>
                {report && <span className="text-[8px] text-surface-400 mt-0.5">{formatMsHours(ms)}h</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day Detail */}
      {selectedDay && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-surface-100">{selectedDay}</h3>
            <button onClick={() => setSelectedDay(null)} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400"><X size={14} /></button>
          </div>
          {loadingDay ? (
            <div className="py-8 text-center"><Loader2 size={20} className="text-brand-400 animate-spin mx-auto" /></div>
          ) : dayDetail ? (
            <div className="space-y-4">
              {/* Day Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-surface-800/50 p-3 text-center">
                  <p className="text-lg font-bold text-surface-100">{formatMsHours(dayDetail.totalActiveMs || 0)}h</p>
                  <p className="text-[10px] text-surface-500">Focus</p>
                </div>
                <div className="rounded-xl bg-surface-800/50 p-3 text-center">
                  <p className="text-lg font-bold text-surface-100">{dayDetail.sessions?.length || 0}</p>
                  <p className="text-[10px] text-surface-500">Sessions</p>
                </div>
                <div className="rounded-xl bg-surface-800/50 p-3 text-center">
                  <p className="text-lg font-bold text-surface-100">{dayDetail.completedTasks?.length || 0}</p>
                  <p className="text-[10px] text-surface-500">Completed</p>
                </div>
              </div>
              {/* Sessions */}
              {dayDetail.sessions?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-surface-300 mb-2">Sessions</h4>
                  <div className="space-y-1.5">
                    {dayDetail.sessions.map((s: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-surface-800/30">
                        <div className="w-2 h-2 rounded-full" style={{ background: s.taskColor || accent }} />
                        <span className="text-xs text-surface-200 flex-1 truncate">{s.taskTitle || 'Untitled'}</span>
                        <span className="text-[10px] text-surface-400 font-mono">{formatMs(s.activeTime || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Work Logs */}
              {dayDetail.workLogs?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-surface-300 mb-2">Work Logs</h4>
                  <div className="space-y-1.5">
                    {dayDetail.workLogs.map((w: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-surface-800/30">
                        <BookMarked size={12} className="text-cyan-400 flex-shrink-0" />
                        <span className="text-xs text-surface-200 flex-1 truncate">{w.title || 'Untitled'}</span>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${w.status === 'done' ? 'text-emerald-400 bg-emerald-500/10' : 'text-brand-400 bg-brand-500/10'}`}>{w.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-surface-500 text-center py-4">No data for this day</p>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ── Team Detail View ──────────────────────────────────────────────────────────
function TeamDetailView({ team, analytics, loading, filter, setFilter, onBack }: {
  team: Team; analytics: any; loading: boolean; filter: FilterRange; setFilter: (f: FilterRange) => void; onBack: () => void;
}) {
  const chartData = useMemo(() => {
    if (!analytics?.memberBreakdown) return [];
    return analytics.memberBreakdown
      .map((m: any) => ({ name: m.name, hours: Math.round(m.totalTimeMs / 3600000 * 10) / 10 }))
      .sort((a: any, b: any) => b.hours - a.hours);
  }, [analytics]);

  if (loading) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({length:4}).map((_,i) => <SkeletonStatCard key={i} />)}</div>;

  const summary = analytics?.summary;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-surface-800 text-surface-400 transition-colors"><ArrowLeft size={18} /></button>
        <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center"><Users size={20} className="text-sky-400" /></div>
        <div>
          <h2 className="text-lg font-display font-bold text-surface-50">{team.name}</h2>
          <p className="text-xs text-surface-400">{team.members.length} members</p>
        </div>
      </div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Clock} label="Total Focus" value={`${formatMsHours(summary?.totalTimeMs || 0)}h`} color="#0ea5e9" />
        <StatCard icon={CheckCircle2} label="Tasks Done" value={String(summary?.completedTasks || 0)} color="#10b981" />
        <StatCard icon={Users} label="Team Size" value={String(summary?.activeMembers || team.members.length)} color="#8b5cf6" />
        <StatCard icon={TrendingUp} label="Avg/User" value={`${formatMsHours(summary?.totalTimeMs / Math.max(summary?.activeMembers || 1, 1))}h`} color="#f59e0b" />
      </motion.div>

      {chartData.length > 0 && (
        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5 mb-6">
          <h3 className="text-sm font-bold text-surface-100 mb-4">Team Contributions</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-800)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--color-surface-500)' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-surface-500)' }} width={80} />
                <Tooltip contentStyle={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-800)', borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="hours" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {analytics?.memberBreakdown?.length > 0 && (
        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
          <h3 className="text-sm font-bold text-surface-100 mb-3">Member Activity</h3>
          <div className="space-y-2">
            {analytics.memberBreakdown.map((m: any) => (
              <div key={m.userId} className="flex items-center gap-3 p-2.5 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-surface-800 flex items-center justify-center text-xs font-bold text-surface-300">{m.name.charAt(0).toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-200 font-medium">{m.name}</p>
                  <p className="text-[11px] text-surface-500">{m.completedTasks} tasks · {m.sessionCount} sessions</p>
                </div>
                <span className="text-xs text-surface-400 font-mono">{formatMs(m.totalTimeMs)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
