import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, Loader2, Clock, CheckCircle2, BarChart3, BookMarked,
  GitBranch, Calendar, ArrowLeft, TrendingUp, Zap, Activity,
  Plus, Trash2, Edit2, X, Check, ShieldCheck, Globe, AlertTriangle,
  Target, RefreshCw, UserX, UserCheck, Trash, RotateCcw, Star,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, eachDayOfInterval, subDays } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { api } from '../../utils/api';
import { toast } from '../../store/useToastStore';
import { renderMarkdown } from '../../components/ui/proEditor';
import { SkeletonStatCard } from '../../components/ui/Skeleton';

const stagger = { show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };

function formatMs(ms: number): string {
  if (!ms || ms < 0) return '0h';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface UserSummary { _id: string; name: string; email: string; role: string; avatar?: string; createdAt: string; deletedAt?: string | null; }

function EditUserModal({ user, onClose, onSave }: { user: UserSummary; onClose: () => void; onSave: (data: any) => Promise<void> }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [saving, setSaving] = useState(false);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }} transition={{ duration: 0.2 }}
        className="w-full max-w-md rounded-2xl border border-surface-800 bg-surface-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-surface-50">Edit User</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400"><X size={16} /></button>
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
                    role === r ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' : 'bg-surface-800 text-surface-400 border-surface-800 hover:text-surface-200'
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
          <button onClick={async () => { setSaving(true); try { await onSave({ name, email, role }); onClose(); } catch {} finally { setSaving(false); } }}
            disabled={saving || !name.trim() || !email.trim()}
            className="btn-primary flex-1 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── User Profile Panel ────────────────────────────────────────────────────────
function UserProfilePanel({ user, onBack }: { user: UserSummary; onBack: () => void }) {
  const [tab, setTab] = useState<'analytics' | 'worklogs' | 'reports'>('analytics');
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.admin.getUserAnalytics(user._id).then(d => { setAnalytics(d); setLoading(false); }).catch(() => setLoading(false));
  }, [user._id]);

  const chartData = useMemo(() => {
    if (!analytics?.sessions) return [];
    const map: Record<string, number> = {};
    analytics.sessions.forEach((s: any) => {
      const d = new Date(s.startTime).toISOString().slice(0, 10);
      map[d] = (map[d] || 0) + (s.activeTime || 0);
    });
    return Object.entries(map).slice(-7).map(([date, ms]) => ({ date: date.slice(5), hours: Math.round(ms / 3600000 * 10) / 10 }));
  }, [analytics]);

  if (loading) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}</div>;

  const s = analytics?.summary;
  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-surface-800 text-surface-400 transition-colors"><ArrowLeft size={18} /></button>
        <div className="w-12 h-12 rounded-xl bg-surface-800 flex items-center justify-center text-lg font-bold text-surface-300">{user.name.charAt(0).toUpperCase()}</div>
        <div className="flex-1">
          <h2 className="text-lg font-display font-bold text-surface-50">{user.name}</h2>
          <p className="text-xs text-surface-400">{user.email}</p>
        </div>
        <span className={`text-xs font-bold uppercase px-3 py-1 rounded-lg ${user.role === 'admin' ? 'bg-purple-500/15 text-purple-400' : 'bg-surface-800 text-surface-500'}`}>{user.role}</span>
      </div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5"><p className="text-2xl font-display font-extrabold text-surface-50">{(s?.totalTimeMs || 0) / 3600000}h</p><p className="text-xs text-surface-400">Focus Time</p></div>
        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5"><p className="text-2xl font-display font-extrabold text-surface-50">{s ? Math.round((s.completedTasks / Math.max(s.totalTasks, 1)) * 100) : 0}%</p><p className="text-xs text-surface-400">Completion</p></div>
        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5"><p className="text-2xl font-display font-extrabold text-surface-50">{s?.workLogCount || 0}</p><p className="text-xs text-surface-400">Work Logs</p></div>
        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5"><p className="text-2xl font-display font-extrabold text-surface-50">{s?.sessionCount || 0}</p><p className="text-xs text-surface-400">Sessions</p></div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-800/60 p-1 rounded-xl border border-surface-800 mb-5 w-fit">
        {(['analytics', 'worklogs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all capitalize ${tab === t ? 'bg-surface-700/80 text-surface-50 shadow-sm border border-surface-600/30' : 'text-surface-400 hover:text-surface-200'}`}>{t}</button>
        ))}
      </div>

      {tab === 'analytics' && chartData.length > 0 && (
        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5 mb-6">
          <h3 className="text-sm font-bold text-surface-100 mb-3">Daily Focus</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-800)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-surface-500)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-surface-500)' }} />
                <Tooltip contentStyle={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-800)', borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'analytics' && analytics?.tasks?.length > 0 && (
        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
          <h3 className="text-sm font-bold text-surface-100 mb-3">Top Tasks</h3>
          <div className="space-y-2">
            {analytics.tasks.slice(0, 5).map((t: any) => (
              <div key={t._id} className="flex items-center gap-3 p-2 rounded-xl">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color || '#8b5cf6' }} />
                <span className="text-sm text-surface-200 flex-1 truncate">{t.title}</span>
                <span className="text-xs text-surface-500 font-mono">{formatMs(t.totalTime || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'worklogs' && (
        <div className="space-y-3">
          {analytics?.workLogs?.length > 0 ? analytics.workLogs.map((log: any) => (
            <div key={log._id} className="rounded-2xl border border-surface-800 bg-surface-900 p-5 cursor-pointer hover:border-surface-700 transition-all"
              onClick={() => navigate(`/worklog/${log._id}`)}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-surface-100">{log.title}</h4>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${log.status === 'done' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-brand-500/15 text-brand-400'}`}>{log.status}</span>
              </div>
              {log.problem && <p className="text-xs text-surface-400 line-clamp-2 mb-2" dangerouslySetInnerHTML={{ __html: renderMarkdown(log.problem) }} />}
              <div className="flex items-center gap-3 text-[11px] text-surface-500">
                {log.gitBranch && <span className="flex items-center gap-1"><GitBranch size={10} /> {log.gitBranch}</span>}
                <span>{log.completedItems?.length || 0} completed</span>
              </div>
            </div>
          )) : <div className="rounded-2xl border border-surface-800 bg-surface-900 p-12 text-center"><BookMarked size={28} className="text-surface-600 mx-auto mb-3" /><p className="text-sm text-surface-400">No work logs</p></div>}
        </div>
      )}
    </div>
  );
}

// ── Main People Page ──────────────────────────────────────────────────────────
export function AdminPeople() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [deletedUsers, setDeletedUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [showTrash, setShowTrash] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [showEditUser, setShowEditUser] = useState<UserSummary | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<UserSummary | null>(null);

  useEffect(() => {
    Promise.all([api.admin.listUsers(), api.admin.listDeletedUsers()])
      .then(([u, d]) => { setUsers(u); setDeletedUsers(d); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = users;
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)); }
    if (roleFilter !== 'all') list = list.filter(u => u.role === roleFilter);
    return list;
  }, [users, search, roleFilter]);

  const handleUpdate = async (data: any) => {
    if (!showEditUser) return;
    const updated = await api.admin.updateUser(showEditUser._id, data);
    setUsers(prev => prev.map(u => u._id === updated._id ? updated : u));
    toast.success('User updated', `${updated.name} has been updated.`);
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    await api.admin.deleteUser(showDeleteConfirm._id);
    const deleted = users.find(u => u._id === showDeleteConfirm._id);
    if (deleted) { setUsers(prev => prev.filter(u => u._id !== deleted._id)); setDeletedUsers(prev => [deleted, ...prev]); }
    setShowDeleteConfirm(null);
    toast.success('User deleted');
  };

  const handleRestore = async (userId: string) => {
    const restored = await api.admin.restoreUser(userId);
    setDeletedUsers(prev => prev.filter(u => u._id !== userId));
    setUsers(prev => [restored, ...prev]);
    toast.success('User restored');
  };

  if (loading) return <div className="p-6 lg:p-8 max-w-[1500px] mx-auto"><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}</div></div>;

  if (selectedUser) return (
    <div className="p-6 lg:p-8 max-w-[1500px] mx-auto">
      <UserProfilePanel user={selectedUser} onBack={() => setSelectedUser(null)} />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1500px] mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-display font-extrabold text-surface-50 mb-1">People</h1>
        <p className="text-sm text-surface-400">Manage your organization's members</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
          <input className="input h-10 pl-9 pr-4 rounded-xl text-sm" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'admin', 'user'] as const).map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${roleFilter === r ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' : 'bg-surface-800 text-surface-400 border border-surface-800 hover:text-surface-200'}`}>{r}</button>
          ))}
        </div>
        <button onClick={() => setShowTrash(!showTrash)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-surface-400 hover:text-red-400 bg-surface-800 border border-surface-800 transition-all">
          <Trash size={12} /> Trash {deletedUsers.length > 0 && <span className="text-[10px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-md">{deletedUsers.length}</span>}
        </button>
      </div>

      {showTrash && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
          <h4 className="text-sm font-bold text-red-400 mb-3 flex items-center gap-2"><Trash size={14} /> Deleted Users</h4>
          {deletedUsers.length === 0 ? <p className="text-xs text-surface-500">No deleted users</p> : (
            <div className="space-y-2">
              {deletedUsers.map(u => (
                <div key={u._id} className="flex items-center gap-3 p-2 rounded-xl bg-surface-900/50">
                  <div className="w-7 h-7 rounded-full bg-surface-800 flex items-center justify-center text-xs font-bold text-surface-400">{u.name.charAt(0).toUpperCase()}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm text-surface-300 truncate">{u.name}</p></div>
                  <button onClick={() => handleRestore(u._id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center gap-1">
                    <RotateCcw size={11} /> Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(u => (
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

      <AnimatePresence>
        {showEditUser && <EditUserModal user={showEditUser} onClose={() => setShowEditUser(null)} onSave={handleUpdate} />}
        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-surface-800 bg-surface-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4"><AlertTriangle size={22} className="text-red-400" /></div>
              <h3 className="text-center font-display font-bold text-surface-50 mb-2">Delete User</h3>
              <p className="text-sm text-surface-400 text-center mb-5">Are you sure you want to delete <span className="font-semibold text-surface-200">{showDeleteConfirm.name}</span>?</p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(null)} className="btn-secondary flex-1 py-2.5 rounded-xl text-sm">Cancel</button>
                <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500 hover:bg-red-400 text-white transition-all">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
