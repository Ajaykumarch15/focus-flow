import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, Loader2, Edit2, Trash2, Plus, X, Check, ArrowLeft,
  TrendingUp, Clock, CheckCircle2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { api } from '../../utils/api';
import { toast } from '../../store/useToastStore';
import { SkeletonStatCard } from '../../components/ui/Skeleton';

const stagger = { show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

function formatMs(ms: number): string { if (!ms) return '0h'; const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); return h > 0 ? `${h}h ${m}m` : `${m}m`; }

interface UserSummary { _id: string; name: string; email: string; role: string; }
interface Team { _id: string; name: string; description?: string; members: UserSummary[]; createdAt: string; }

function TeamModal({ editing, users, onClose, onSave }: {
  editing: Team | null; users: UserSummary[]; onClose: () => void;
  onSave: (data: { name: string; description: string; members: string[] }) => Promise<void>;
}) {
  const [name, setName] = useState(editing?.name || '');
  const [desc, setDesc] = useState(editing?.description || '');
  const [members, setMembers] = useState<string[]>(editing?.members.map(m => m._id) || []);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const filtered = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg rounded-2xl border border-surface-800 bg-surface-900 p-6 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-surface-50">{editing ? 'Edit Team' : 'New Team'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400"><X size={16} /></button>
        </div>
        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div><label className="text-xs text-surface-400 font-medium mb-1 block">Team Name</label>
            <input className="input w-full rounded-xl text-sm" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Frontend Team" /></div>
          <div><label className="text-xs text-surface-400 font-medium mb-1 block">Description</label>
            <textarea className="input w-full rounded-xl text-sm resize-none" rows={2} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional..." /></div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <label className="text-xs text-surface-400 font-medium mb-1 block">Members ({members.length})</label>
            <input className="input w-full rounded-xl text-sm mb-2" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin max-h-48">
              {filtered.map(u => (
                <button key={u._id} onClick={() => setMembers(prev => prev.includes(u._id) ? prev.filter(x => x !== u._id) : [...prev, u._id])}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${members.includes(u._id) ? 'bg-purple-500/10 border border-purple-500/30' : 'hover:bg-surface-850 border border-transparent'}`}>
                  <div className="w-7 h-7 rounded-full bg-surface-800 flex items-center justify-center text-xs font-bold text-surface-300">{u.name.charAt(0).toUpperCase()}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm text-surface-200 truncate">{u.name}</p></div>
                  {members.includes(u._id) && <Check size={14} className="text-purple-400" />}
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

function TeamDetailPanel({ team, onBack }: { team: Team; onBack: () => void }) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.teams.getAnalytics(team._id).then(d => { setAnalytics(d); setLoading(false); }).catch(() => setLoading(false));
  }, [team._id]);

  const chartData = useMemo(() => {
    if (!analytics?.memberBreakdown) return [];
    return analytics.memberBreakdown.map((m: any) => ({ name: m.name, hours: Math.round(m.totalTimeMs / 3600000 * 10) / 10 })).sort((a: any, b: any) => b.hours - a.hours);
  }, [analytics]);

  if (loading) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}</div>;

  const s = analytics?.summary;
  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-surface-800 text-surface-400"><ArrowLeft size={18} /></button>
        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center"><Users size={20} className="text-purple-400" /></div>
        <div><h2 className="text-lg font-display font-bold text-surface-50">{team.name}</h2><p className="text-xs text-surface-400">{team.members.length} members</p></div>
      </div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5"><p className="text-2xl font-display font-extrabold text-surface-50">{(s?.totalTimeMs || 0) / 3600000}h</p><p className="text-xs text-surface-400">Total Focus</p></div>
        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5"><p className="text-2xl font-display font-extrabold text-surface-50">{s?.completedTasks || 0}</p><p className="text-xs text-surface-400">Tasks Done</p></div>
        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5"><p className="text-2xl font-display font-extrabold text-surface-50">{s?.activeMembers || team.members.length}</p><p className="text-xs text-surface-400">Active Members</p></div>
        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5"><p className="text-2xl font-display font-extrabold text-surface-50">{formatMs((s?.totalTimeMs || 0) / Math.max(s?.activeMembers || 1, 1))}</p><p className="text-xs text-surface-400">Avg / User</p></div>
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
                <Bar dataKey="hours" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
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
                <div className="flex-1 min-w-0"><p className="text-sm text-surface-200 font-medium">{m.name}</p><p className="text-[11px] text-surface-500">{m.completedTasks} tasks · {m.sessionCount} sessions</p></div>
                <span className="text-xs text-surface-400 font-mono">{formatMs(m.totalTimeMs)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  useEffect(() => {
    Promise.all([api.teams.list(), api.admin.listUsers()])
      .then(([t, u]) => { setTeams(t); setUsers(u); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return teams;
    return teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  }, [teams, search]);

  const handleSave = async (data: { name: string; description: string; members: string[] }) => {
    if (editing) {
      const updated = await api.teams.update(editing._id, data);
      setTeams(prev => prev.map(t => t._id === updated._id ? updated : t));
      toast.success('Team updated');
    } else {
      const created = await api.teams.create(data);
      setTeams(prev => [created, ...prev]);
      toast.success('Team created');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this team?')) return;
    await api.teams.delete(id);
    setTeams(prev => prev.filter(t => t._id !== id));
    toast.success('Team deleted');
  };

  if (loading) return <div className="p-6 lg:p-8 max-w-[1500px] mx-auto"><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}</div></div>;

  if (selectedTeam) return (
    <div className="p-6 lg:p-8 max-w-[1500px] mx-auto">
      <TeamDetailPanel team={selectedTeam} onBack={() => setSelectedTeam(null)} />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1500px] mx-auto space-y-5">
      <div><h1 className="text-2xl font-display font-extrabold text-surface-50 mb-1">Teams</h1><p className="text-sm text-surface-400">Manage organization teams and groups</p></div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
          <input className="input h-10 pl-9 pr-4 rounded-xl text-sm" placeholder="Search teams..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm">
          <Plus size={14} /> New Team
        </button>
      </div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(t => (
          <motion.div key={t._id} variants={fadeUp} whileHover={{ y: -3 }}
            className="rounded-2xl border border-surface-800 bg-surface-900 p-5 hover:border-surface-700 hover:shadow-lg transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedTeam(t)}>
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center"><Users size={16} className="text-purple-400" /></div>
                <div><p className="text-sm font-semibold text-surface-100">{t.name}</p>
                  {t.description && <p className="text-[11px] text-surface-500 truncate max-w-[180px]">{t.description}</p>}</div>
              </div>
            </div>
            <div className="flex items-center gap-1 mb-3">
              {t.members.slice(0, 5).map((m, i) => (
                <div key={m._id} className="w-6 h-6 rounded-full bg-surface-800 flex items-center justify-center text-[9px] font-bold text-surface-400 -ml-1 first:ml-0 border border-surface-900">{m.name.charAt(0).toUpperCase()}</div>
              ))}
              {t.members.length > 5 && <span className="text-[10px] text-surface-500 ml-1">+{t.members.length - 5}</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSelectedTeam(t)} className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-surface-800 text-surface-300 hover:text-surface-100 transition-all">Analytics</button>
              <button onClick={() => { setEditing(t); setShowModal(true); }} className="p-1.5 rounded-lg bg-surface-800 text-surface-400 hover:text-surface-200 transition-all"><Edit2 size={13} /></button>
              <button onClick={() => handleDelete(t._id)} className="p-1.5 rounded-lg bg-surface-800 text-surface-400 hover:text-red-400 transition-all"><Trash2 size={13} /></button>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <AnimatePresence>
        {showModal && <TeamModal editing={editing} users={users} onClose={() => { setShowModal(false); setEditing(null); }} onSave={handleSave} />}
      </AnimatePresence>
    </div>
  );
}
