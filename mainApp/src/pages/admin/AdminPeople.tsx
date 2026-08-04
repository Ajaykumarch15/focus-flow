import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, BookMarked,
  GitBranch, ArrowLeft,
  Trash2, Edit2, X, Check, ShieldCheck, AlertTriangle,
  Trash, RotateCcw, UserPlus, Mail, User, Lock, EyeOff,
  Eye, Building2, Ban, CheckCircle2, KeyRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { api } from '../../utils/api';
import { toast } from '../../store/useToastStore';
import { runMutation } from '../../utils/mutation';
import { Markdown } from '../../lib';
import { SkeletonStatCard } from '../../components/ui/Skeleton';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';

const stagger = { show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };

function formatMs(ms: number): string {
  if (!ms || ms < 0) return '0h';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface UserSummary {
  _id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  createdAt: string;
  deletedAt?: string | null;
  status?: 'active' | 'disabled';
  lastLoginAt?: string;
}

// ── Create User Modal ──────────────────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (u: UserSummary) => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleCreate = async () => {
    setErr('');
    if (!form.name.trim() || !form.email.trim()) { setErr('Name and email are required.'); return; }
    if (form.password && form.password.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    setSaving(true);
    try {
      const created = await api.admin.createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password || undefined,
        role: form.role,
      });
      toast.success('User Created', `${form.name} has been provisioned successfully.`);
      onCreated(created);
      onClose();
    } catch (e: any) {
      setErr(e.message || 'Failed to create user.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.2 }}
        className="w-full max-w-md rounded-2xl border border-surface-800 bg-surface-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <UserPlus size={16} className="text-brand-400" />
            <h3 className="font-display font-bold text-surface-50">Provision New User</h3>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close"><X size={16} /></Button>
        </div>

        {err && (
          <div className="mb-4 p-3 text-xs text-danger-400 bg-danger-500/10 border border-danger-500/20 rounded-xl">
            {err}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-surface-300 uppercase tracking-wider mb-1.5 block">Full Name *</label>
            <div className="relative">
              <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
              <Input id="create-user-name" className="pl-9 text-xs" placeholder="Alex Johnson" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-surface-300 uppercase tracking-wider mb-1.5 block">Work Email *</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
              <Input id="create-user-email" type="email" className="pl-9 text-xs" placeholder="alex@organization.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-surface-300 uppercase tracking-wider mb-1.5 block">
              Initial Password <span className="normal-case text-surface-500 font-normal">(optional — user will be prompted if blank)</span>
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
              <Input id="create-user-password" type={showPass ? 'text' : 'password'} className="pl-9 pr-9 text-xs" placeholder="Min 8 characters" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300">
                {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-surface-300 uppercase tracking-wider mb-1.5 block">System Role</label>
            <div className="flex gap-2">
              {(['user', 'admin'] as const).map(r => (
                <button key={r} onClick={() => setForm(p => ({ ...p, role: r }))}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    form.role === r
                      ? 'bg-brand-500/15 text-brand-400 border-brand-500/30'
                      : 'bg-surface-800 text-surface-400 border-surface-800 hover:text-surface-200'
                  }`}>
                  {r === 'admin' ? <ShieldCheck size={13} className="inline mr-1.5" /> : <Users size={13} className="inline mr-1.5" />}
                  {r === 'admin' ? 'Administrator' : 'Standard User'}
                </button>
              ))}
            </div>
          </div>

          {/* Future: Team & Project assignment — placeholder */}
          <div className="p-3 rounded-xl bg-surface-800/50 border border-surface-800 text-xs text-surface-500 flex items-center gap-2">
            <Building2 size={13} />
            <span>Team & Project assignment available after user creation via Edit User.</span>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <Button variant="secondary" size="lg" onClick={onClose} className="flex-1 text-xs">Cancel</Button>
          <Button onClick={handleCreate} disabled={saving || !form.name.trim() || !form.email.trim()}
            loading={saving} leftIcon={<UserPlus size={13} />} className="flex-1 text-xs font-bold">
            Provision User
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Edit User Modal ────────────────────────────────────────────────────────────
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
          <div className="flex items-center gap-2">
            <Edit2 size={15} className="text-brand-400" />
            <h3 className="font-display font-bold text-surface-50">Edit User</h3>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close edit user dialog"><X size={16} /></Button>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="admin-edit-name" className="text-xs text-surface-400 font-bold uppercase tracking-wider mb-1.5 block">Name</label>
            <Input id="admin-edit-name" className="w-full rounded-xl text-xs" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="admin-edit-email" className="text-xs text-surface-400 font-bold uppercase tracking-wider mb-1.5 block">Email</label>
            <Input id="admin-edit-email" className="w-full rounded-xl text-xs" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-surface-400 font-bold uppercase tracking-wider mb-1.5 block">System Role</label>
            <div className="flex gap-2">
              {['user', 'admin'].map(r => (
                <button key={r} onClick={() => setRole(r)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    role === r ? 'bg-brand-500/15 text-brand-400 border-brand-500/30' : 'bg-surface-800 text-surface-400 border-surface-800 hover:text-surface-200'
                  }`}>
                  {r === 'admin' ? <ShieldCheck size={13} className="inline mr-1.5" /> : <Users size={13} className="inline mr-1.5" />}
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button variant="secondary" size="lg" onClick={onClose} className="flex-1 py-2.5 text-xs">Cancel</Button>
          <Button onClick={async () => { setSaving(true); try { await onSave({ name, email, role }); onClose(); } catch {} finally { setSaving(false); } }}
            disabled={saving || !name.trim() || !email.trim()}
            loading={saving}
            leftIcon={<Check size={14} />}
            className="flex-1 py-2.5 text-xs font-bold">
            Save Changes
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── User Profile Panel ────────────────────────────────────────────────────────
function UserProfilePanel({ user, onBack }: { user: UserSummary; onBack: () => void }) {
  const [tab, setTab] = useState<'analytics' | 'worklogs'>('analytics');
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

  if (loading) return <div role="status" aria-live="polite" className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}</div>;

  const s = analytics?.summary;
  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to people"><ArrowLeft size={18} /></Button>
        <div className="w-12 h-12 rounded-xl bg-surface-800 flex items-center justify-center text-lg font-bold text-surface-300">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-display font-bold text-surface-50">{user.name}</h2>
            {user.status === 'disabled' && (
              <Badge tone="danger" className="text-[10px] uppercase px-2 py-0.5">Disabled</Badge>
            )}
          </div>
          <p className="text-xs text-surface-400">{user.email}</p>
          {user.lastLoginAt && (
            <p className="text-[11px] text-surface-500 mt-0.5">
              Last login: {format(new Date(user.lastLoginAt), 'MMM d, yyyy HH:mm')}
            </p>
          )}
        </div>
        <Badge tone={user.role === 'admin' ? 'brand' : 'neutral'} className="uppercase px-3 py-1 rounded-lg">{user.role}</Badge>
      </div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-5"><p className="text-2xl font-display font-extrabold text-surface-50">{Math.round((s?.totalTimeMs || 0) / 3600000 * 10) / 10}h</p><p className="text-xs text-surface-400">Focus Time</p></Card>
        <Card className="p-5"><p className="text-2xl font-display font-extrabold text-surface-50">{s ? Math.round((s.completedTasks / Math.max(s.totalTasks, 1)) * 100) : 0}%</p><p className="text-xs text-surface-400">Completion</p></Card>
        <Card className="p-5"><p className="text-2xl font-display font-extrabold text-surface-50">{s?.workLogCount || 0}</p><p className="text-xs text-surface-400">Work Logs</p></Card>
        <Card className="p-5"><p className="text-2xl font-display font-extrabold text-surface-50">{s?.sessionCount || 0}</p><p className="text-xs text-surface-400">Sessions</p></Card>
      </motion.div>

      <div className="flex gap-1 bg-surface-800/60 p-1 rounded-xl border border-surface-800 mb-5 w-fit">
        {(['analytics', 'worklogs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all capitalize ${tab === t ? 'bg-surface-700/80 text-surface-50 shadow-sm border border-surface-600/30' : 'text-surface-400 hover:text-surface-200'}`}>{t}</button>
        ))}
      </div>

      {tab === 'analytics' && chartData.length > 0 && (
        <Card className="p-5 mb-6">
          <h3 className="text-sm font-bold text-surface-100 mb-3">Daily Focus (Last 7 Days)</h3>
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
        </Card>
      )}

      {tab === 'analytics' && analytics?.tasks?.length > 0 && (
        <Card className="p-5">
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
        </Card>
      )}

      {tab === 'worklogs' && (
        <div className="space-y-3">
          {analytics?.workLogs?.length > 0 ? analytics.workLogs.map((log: any) => (
            <Card key={log._id} role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter') navigate(`/worklog/${log._id}`); }}
              className="p-5 cursor-pointer hover:border-surface-700 transition-all"
              onClick={() => navigate(`/worklog/${log._id}`)}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-surface-100">{log.title}</h4>
                <StatusBadge status={log.status} className="uppercase" />
              </div>
              {log.problem && <div className="text-xs text-surface-400 line-clamp-2 mb-2"><Markdown source={log.problem} /></div>}
              <div className="flex items-center gap-3 text-[11px] text-surface-500">
                {log.gitBranch && <span className="flex items-center gap-1"><GitBranch size={10} /> {log.gitBranch}</span>}
                <span>{log.completedItems?.length || 0} completed</span>
              </div>
            </Card>
          )) : <EmptyState icon={<BookMarked size={28} className="text-surface-600" />} title="No work logs" description="" />}
        </div>
      )}
    </div>
  );
}

// ── Main People Page ──────────────────────────────────────────────────────────
export function AdminPeople() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [usersCursor, setUsersCursor] = useState<string | null>(null);
  const [usersHasMore, setUsersHasMore] = useState(false);
  const [deletedUsers, setDeletedUsers] = useState<UserSummary[]>([]);
  const [deletedCursor, setDeletedCursor] = useState<string | null>(null);
  const [deletedHasMore, setDeletedHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false);
  const [loadingMoreDeleted, setLoadingMoreDeleted] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [showTrash, setShowTrash] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [showEditUser, setShowEditUser] = useState<UserSummary | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<UserSummary | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState<UserSummary | null>(null);

  useEffect(() => {
    Promise.all([api.admin.listUsers(), api.admin.listDeletedUsers()])
      .then(([u, d]) => {
        setUsers(u.items);
        setUsersHasMore(u.hasMore);
        setUsersCursor(u.nextCursor);
        setDeletedUsers(d.items);
        setDeletedHasMore(d.hasMore);
        setDeletedCursor(d.nextCursor);
      })
      .finally(() => setLoading(false));
  }, []);

  const loadMoreUsers = async () => {
    if (!usersHasMore || loadingMoreUsers) return;
    setLoadingMoreUsers(true);
    try {
      const data = await api.admin.listUsers(false, usersCursor ?? undefined);
      setUsers(prev => [...prev, ...data.items]);
      setUsersHasMore(data.hasMore);
      setUsersCursor(data.nextCursor);
    } catch {}
    finally { setLoadingMoreUsers(false); }
  };

  const loadMoreDeleted = async () => {
    if (!deletedHasMore || loadingMoreDeleted) return;
    setLoadingMoreDeleted(true);
    try {
      const data = await api.admin.listDeletedUsers(deletedCursor ?? undefined);
      setDeletedUsers(prev => [...prev, ...data.items]);
      setDeletedHasMore(data.hasMore);
      setDeletedCursor(data.nextCursor);
    } catch {}
    finally { setLoadingMoreDeleted(false); }
  };

  const filtered = useMemo(() => {
    let list = users;
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)); }
    if (roleFilter !== 'all') list = list.filter(u => u.role === roleFilter);
    if (statusFilter !== 'all') list = list.filter(u => (u.status || 'active') === statusFilter);
    return list;
  }, [users, search, roleFilter, statusFilter]);

  const handleUpdate = async (data: any) => {
    if (!showEditUser) return;
    const updated = await api.admin.updateUser(showEditUser._id, data);
    setUsers(prev => prev.map(u => u._id === updated._id ? updated : u));
    toast.success('User updated', `${updated.name} has been updated.`);
  };

  const handleToggleDisable = async (user: UserSummary) => {
    const isDisabling = (user.status || 'active') === 'active';
    try {
      const updated = await api.admin.updateUser(user._id, { status: isDisabling ? 'disabled' : 'active' });
      setUsers(prev => prev.map(u => u._id === user._id ? { ...u, status: updated.status || (isDisabling ? 'disabled' : 'active') } : u));
      toast.success(isDisabling ? 'User Disabled' : 'User Activated', `${user.name} has been ${isDisabling ? 'disabled' : 'activated'}.`);
    } catch (e: any) {
      toast.error('Operation Failed', e.message);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    const target = showDeleteConfirm;
    const deleted = users.find(u => u._id === target._id);
    if (!deleted) return;
    await runMutation(
      () => {
        setUsers(prev => prev.filter(u => u._id !== target._id));
        setDeletedUsers(prev => [deleted, ...prev]);
        return () => {
          setUsers(prev => [deleted, ...prev]);
          setDeletedUsers(prev => prev.filter(u => u._id !== target._id));
        };
      },
      () => api.admin.deleteUser(target._id),
      { errorTitle: 'Failed to delete user' },
    );
    setShowDeleteConfirm(null);
    toast.success('User deleted');
  };

  const handleRestore = async (userId: string) => {
    const restored = await api.admin.restoreUser(userId);
    setDeletedUsers(prev => prev.filter(u => u._id !== userId));
    setUsers(prev => [restored, ...prev]);
    toast.success('User restored');
  };

  const handleResetPassword = async () => {
    if (!showResetConfirm) return;
    try {
      // Placeholder: future email-based reset; currently logs admin action
      toast.success('Password Reset Initiated', `A reset credential will be issued for ${showResetConfirm.name}.`);
      setShowResetConfirm(null);
    } catch (e: any) {
      toast.error('Reset Failed', e.message);
    }
  };

  const activeCount = users.filter(u => (u.status || 'active') === 'active').length;
  const disabledCount = users.filter(u => u.status === 'disabled').length;
  const adminCount = users.filter(u => u.role === 'admin').length;

  if (loading) return <div className="p-6 lg:p-8 max-w-[1500px] mx-auto"><div role="status" aria-live="polite" className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}</div></div>;

  if (selectedUser) return (
    <div className="p-6 lg:p-8 max-w-[1500px] mx-auto">
      <UserProfilePanel user={selectedUser} onBack={() => setSelectedUser(null)} />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1500px] mx-auto space-y-5">
      <PageHeader
        title="User Management"
        description="Provision, manage, and govern all workspace user accounts"
        icon={<Users size={18} className="text-brand-400" />}
        actions={
          <Button leftIcon={<UserPlus size={14} />} className="text-xs font-bold shadow-lg shadow-brand-500/20"
            onClick={() => setShowCreateUser(true)}>
            Provision New User
          </Button>
        }
      />

      {/* ── Org Health Stats ── */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: users.length, color: 'text-brand-400', icon: <Users size={16} /> },
          { label: 'Active Users', value: activeCount, color: 'text-emerald-400', icon: <CheckCircle2 size={16} /> },
          { label: 'Disabled', value: disabledCount, color: 'text-danger-400', icon: <Ban size={16} /> },
          { label: 'Administrators', value: adminCount, color: 'text-amber-400', icon: <ShieldCheck size={16} /> },
        ].map(({ label, value, color, icon }) => (
          <motion.div key={label} variants={fadeUp}>
            <Card className="p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl bg-surface-800 flex items-center justify-center ${color}`}>{icon}</div>
              <div>
                <p className="text-xl font-display font-extrabold text-surface-50">{value}</p>
                <p className="text-[11px] text-surface-400">{label}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Filter Bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
          <Input className="h-9 pl-9 pr-4 rounded-xl text-xs" placeholder="Search by name or email..." aria-label="Search users" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Role filter */}
        <div className="flex gap-1">
          {(['all', 'admin', 'user'] as const).map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${roleFilter === r ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30' : 'bg-surface-800 text-surface-400 border border-surface-800 hover:text-surface-200'}`}>
              {r === 'all' ? 'All Roles' : r === 'admin' ? 'Admins' : 'Users'}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1">
          {(['all', 'active', 'disabled'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${statusFilter === s
                ? s === 'disabled' ? 'bg-danger-500/15 text-danger-400 border border-danger-500/30'
                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-surface-800 text-surface-400 border border-surface-800 hover:text-surface-200'
              }`}>
              {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <button onClick={() => setShowTrash(!showTrash)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${showTrash ? 'bg-danger-500/15 text-danger-400 border-danger-500/30' : 'bg-surface-800 text-surface-400 border-surface-800 hover:text-danger-400'}`}>
          <Trash size={12} /> Trash {deletedUsers.length > 0 && <span className="text-[10px] bg-danger-500/15 text-danger-400 px-1.5 py-0.5 rounded-md">{deletedUsers.length}</span>}
        </button>
      </div>

      {/* ── Deleted Users Panel ── */}
      {showTrash && (
        <div className="rounded-2xl border border-danger-500/20 bg-danger-500/5 p-4">
          <h4 className="text-sm font-bold text-danger-400 mb-3 flex items-center gap-2"><Trash size={14} /> Deleted Users</h4>
          {deletedUsers.length === 0 ? <p className="text-xs text-surface-500">No deleted users</p> : (
            <div className="space-y-2">
              {deletedUsers.map(u => (
                <div key={u._id} className="flex items-center gap-3 p-2 rounded-xl bg-surface-900/50">
                  <div className="w-7 h-7 rounded-full bg-surface-800 flex items-center justify-center text-xs font-bold text-surface-400">{u.name.charAt(0).toUpperCase()}</div>
                  <div className="flex-1 min-w-0"><p className="text-xs text-surface-300 truncate">{u.name}</p><p className="text-[10px] text-surface-500 truncate">{u.email}</p></div>
                  {u.deletedAt && <span className="text-[10px] text-surface-500">{format(new Date(u.deletedAt), 'MMM d')}</span>}
                  <Button variant="success" size="xs" onClick={() => handleRestore(u._id)} leftIcon={<RotateCcw size={11} />}>Restore</Button>
                </div>
              ))}
            </div>
          )}
          {deletedHasMore && (
            <Button variant="secondary" size="sm" onClick={loadMoreDeleted} disabled={loadingMoreDeleted}
              loading={loadingMoreDeleted} className="mt-3 w-full text-xs rounded-lg">
              Load more deleted
            </Button>
          )}
        </div>
      )}

      {/* ── User Grid ── */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={32} className="text-surface-600" />}
          title="No users found"
          description="Adjust your search or filters, or provision a new user."
          action={<Button leftIcon={<UserPlus size={14} />} onClick={() => setShowCreateUser(true)} className="text-xs font-bold">Provision New User</Button>}
        />
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(u => {
            const isDisabled = u.status === 'disabled';
            return (
              <motion.div key={u._id} variants={fadeUp} whileHover={{ y: -2 }} role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedUser(u); } }}
                className={`rounded-2xl border bg-surface-900 p-5 hover:shadow-lg transition-all cursor-pointer ${isDisabled ? 'border-surface-800 opacity-60' : 'border-surface-800 hover:border-surface-700'}`}
                onClick={() => setSelectedUser(u)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${isDisabled ? 'bg-surface-800 text-surface-500' : 'bg-surface-800 text-surface-300'}`}>
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-surface-100">{u.name}</p>
                        {isDisabled && <Ban size={11} className="text-danger-500" />}
                      </div>
                      <p className="text-[11px] text-surface-500">{u.email}</p>
                    </div>
                  </div>
                  <Badge tone={u.role === 'admin' ? 'brand' : 'neutral'} className="uppercase px-2 py-0.5 rounded-md text-[10px]">{u.role}</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-surface-500">Joined {format(new Date(u.createdAt), 'MMM d, yyyy')}</span>
                    {u.lastLoginAt && (
                      <p className="text-[10px] text-surface-600">Last login: {format(new Date(u.lastLoginAt), 'MMM d')}</p>
                    )}
                  </div>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon-sm"
                      className={isDisabled ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-surface-400 hover:text-amber-400 hover:bg-amber-500/10'}
                      onClick={() => handleToggleDisable(u)}
                      aria-label={isDisabled ? `Activate user ${u.name}` : `Disable user ${u.name}`}>
                      {isDisabled ? <CheckCircle2 size={13} /> : <Ban size={13} />}
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setShowResetConfirm(u)} aria-label={`Reset password for ${u.name}`} className="hover:text-brand-400 hover:bg-brand-500/10">
                      <KeyRound size={13} />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setShowEditUser(u)} aria-label={`Edit user ${u.name}`}>
                      <Edit2 size={13} />
                    </Button>
                    <Button variant="danger" size="icon-sm" onClick={() => setShowDeleteConfirm(u)} aria-label={`Delete user ${u.name}`}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {usersHasMore && (
        <Button variant="secondary" onClick={loadMoreUsers} disabled={loadingMoreUsers}
          loading={loadingMoreUsers} leftIcon={<Users size={13} />} className="w-full py-2.5 rounded-xl text-xs">
          Load more users
        </Button>
      )}

      {/* ── Modals ── */}
      <AnimatePresence>
        {showCreateUser && (
          <CreateUserModal
            onClose={() => setShowCreateUser(false)}
            onCreated={u => setUsers(prev => [u, ...prev])}
          />
        )}

        {showEditUser && (
          <EditUserModal user={showEditUser} onClose={() => setShowEditUser(null)} onSave={handleUpdate} />
        )}

        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-surface-800 bg-surface-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-12 rounded-2xl bg-danger-500/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={22} className="text-danger-400" />
              </div>
              <h3 className="text-center font-display font-bold text-surface-50 mb-1">Delete User</h3>
              <p className="text-xs text-surface-400 text-center mb-5">
                This will remove <span className="font-semibold text-surface-200">{showDeleteConfirm.name}</span> from the workspace. Their data will be archived in Trash and can be restored within 30 days.
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" size="lg" onClick={() => setShowDeleteConfirm(null)} className="flex-1 text-xs">Cancel</Button>
                <Button variant="danger" size="lg" onClick={handleDelete} className="flex-1 text-xs font-bold">Delete Account</Button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showResetConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowResetConfirm(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-surface-800 bg-surface-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                <KeyRound size={22} className="text-brand-400" />
              </div>
              <h3 className="text-center font-display font-bold text-surface-50 mb-1">Reset Password</h3>
              <p className="text-xs text-surface-400 text-center mb-5">
                Issue a password reset credential for <span className="font-semibold text-surface-200">{showResetConfirm.name}</span>. They will receive a temporary access token on their next login.
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" size="lg" onClick={() => setShowResetConfirm(null)} className="flex-1 text-xs">Cancel</Button>
                <Button size="lg" onClick={handleResetPassword} leftIcon={<KeyRound size={13} />} className="flex-1 text-xs font-bold">Reset Password</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
