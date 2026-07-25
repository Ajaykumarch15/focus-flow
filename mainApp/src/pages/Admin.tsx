import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, User as UserIcon, Search, Loader2, Clock,
  CheckCircle2, BarChart3, BookMarked, ChevronRight, ChevronLeft, GitBranch, ExternalLink,
  Calendar, ArrowLeft, Filter, TrendingUp, Zap, Activity,
  Settings, Plus, Trash2, Edit2, X, Check, ShieldCheck, Mail,
  Star, ArrowUpRight, ArrowDownRight, Globe, Rocket, AlertTriangle, Target,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday as isTodayDateFns, subMonths, addMonths } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  PieChart, Pie, Legend
} from 'recharts';
import { api } from '../utils/api';
import { formatHours, isToday, getWeekDays } from '../utils/time';
import { toast } from '../store/useToastStore';
import { renderMarkdown } from '../components/ui/proEditor';
import { Skeleton, SkeletonStatCard, SkeletonCircle } from '../components/ui/Skeleton';
import { useStore } from '../store/useStore';


interface UserSummary {
  _id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  createdAt: string;
}

interface Team {
  _id: string;
  name: string;
  description?: string;
  members: UserSummary[];
  createdAt: string;
}

interface UserAnalytics {
  summary: {
    totalTasks: number;
    completedTasks: number;
    totalTimeMs: number;
    workLogCount: number;
    sessionCount: number;
  };
  tasks: any[];
  sessions: any[];
  workLogs: any[];
}

interface TeamAnalytics {
  teamName: string;
  summary: {
    totalTimeMs: number;
    totalTasks: number;
    completedTasks: number;
    activeMembers: number;
  };
  memberBreakdown: Array<{
    userId: string;
    name: string;
    totalTimeMs: number;
    completedTasks: number;
    sessionCount: number;
  }>;
}

interface GlobalStats {
  totalUsers: number;
  activeUsers: number;
  todayTotalMs: number;
  todaySessionCount: number;
}

type FilterRange = 'today' | 'week' | 'month' | 'all';
type AdminTab = 'overview' | 'users' | 'teams';

const stagger = { show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };

export function AdminDashboard() {
  const { theme } = useStore();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamAnalytics, setTeamAnalytics] = useState<TeamAnalytics | null>(null);

  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filter, setFilter] = useState<FilterRange>('all');

  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => { loadBaseData(); }, []);

  useEffect(() => {
    if (selectedUser) loadUserDetail(selectedUser);
    if (selectedTeam) loadTeamDetail(selectedTeam);
  }, [filter]);

  const loadBaseData = async () => {
    setLoading(true);
    try {
      const [u, t, s] = await Promise.all([api.admin.listUsers(), api.teams.list(), api.admin.getStats()]);
      setUsers(u); setTeams(t); setStats(s);
    } catch (err: any) {
      toast.error('Failed to load admin data', err.message);
    } finally { setLoading(false); }
  };

  const getRange = (range: FilterRange) => {
    const now = new Date();
    const to = now.getTime();
    let from: number | undefined;
    if (range === 'today') { const d = new Date(); d.setHours(0,0,0,0); from = d.getTime(); }
    else if (range === 'week') { const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(0,0,0,0); from = d.getTime(); }
    else if (range === 'month') { const d = new Date(); d.setMonth(d.getMonth() - 1); d.setHours(0,0,0,0); from = d.getTime(); }
    return { from, to };
  };

  const loadUserDetail = async (user: UserSummary) => {
    setSelectedUser(user); setLoadingDetail(true);
    try { const { from, to } = getRange(filter); setUserAnalytics(await api.admin.getUserAnalytics(user._id, from, to)); }
    catch (err: any) { toast.error('Failed to load user analytics', err.message); }
    finally { setLoadingDetail(false); }
  };

  const loadTeamDetail = async (team: Team) => {
    setSelectedTeam(team); setLoadingDetail(true);
    try { const { from, to } = getRange(filter); setTeamAnalytics(await api.teams.getAnalytics(team._id, from, to)); }
    catch (err: any) { toast.error('Failed to load team analytics', err.message); }
    finally { setLoadingDetail(false); }
  };

  const handleSaveTeam = async () => {
    if (!teamName.trim()) return toast.error('Team name required');
    try {
      if (editingTeam) { await api.teams.update(editingTeam._id, { name: teamName, description: teamDesc, members: teamMembers }); toast.success('Team updated'); }
      else { await api.teams.create({ name: teamName, description: teamDesc, members: teamMembers }); toast.success('Team created'); }
      setShowTeamModal(false); loadBaseData();
    } catch (err: any) { toast.error('Operation failed', err.message); }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm('Are you sure you want to delete this team?')) return;
    try { await api.teams.delete(id); toast.success('Team deleted'); loadBaseData(); }
    catch (err: any) { toast.error('Failed to delete team', err.message); }
  };

  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));
  const filteredTeams = teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  const accent = theme?.accentColor || '#0ea5e9';
  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  if (loading) return (
    <div className="p-6 max-w-[1500px] mx-auto">
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={fadeUp}>
          <Skeleton className="h-10 w-56 rounded-xl mb-2" />
          <Skeleton className="h-4 w-72 rounded" />
        </motion.div>
        <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </motion.div>
        <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
            <Skeleton className="h-5 w-32 rounded mb-6" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 mb-4">
                <SkeletonCircle size={36} />
                <div className="flex-1"><Skeleton className="h-4 w-28 rounded mb-1" /><Skeleton className="h-3 w-20 rounded" /></div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
            <Skeleton className="h-5 w-32 rounded mb-6" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 mb-4">
                <SkeletonCircle size={36} />
                <div className="flex-1"><Skeleton className="h-4 w-32 rounded mb-1" /><Skeleton className="h-3 w-24 rounded" /></div>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1500px] mx-auto space-y-6">
      <AnimatePresence mode="wait">
        {!selectedUser && !selectedTeam ? (
          <motion.div key="admin-main" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>

            {/* ═══ Executive Hero ═══ */}
            <motion.div variants={fadeUp} initial="hidden" animate="show"
              className="relative rounded-2xl border border-surface-800/60 bg-surface-900 p-6 lg:p-8 overflow-hidden mb-6">
              <div className="absolute top-0 right-0 w-[500px] h-[250px] opacity-8 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at top right, ${accent}, transparent 70%)` }} />
              <div className="absolute bottom-0 left-0 w-[300px] h-[150px] opacity-5 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at bottom left, #8b5cf6, transparent 70%)' }} />
              <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                      <ShieldCheck size={20} className="text-purple-400" />
                    </div>
                    <div>
                      <h1 className="text-2xl lg:text-3xl font-display font-extrabold text-surface-50 tracking-tight">Admin Console</h1>
                      <p className="text-surface-400 text-sm font-medium">Organization management & analytics</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-3 flex-wrap">
                    <span className="flex items-center gap-1.5 text-xs text-surface-400 font-medium">
                      <Globe size={12} className="text-sky-400" /> {todayStr}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-surface-400 font-medium">
                      <Users size={12} className="text-emerald-400" /> {users.length} users
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-surface-400 font-medium">
                      <Activity size={12} className="text-purple-400" /> {teams.length} teams
                    </span>
                  </div>
                </div>
                {stats && (
                  <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-semibold text-emerald-400">{stats.activeUsers} active now</span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* ═══ KPI Cards ═══ */}
            <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { icon: Users, label: 'Total Users', value: String(stats?.totalUsers || 0), color: accent, bg: `${accent}10`, desc: 'Registered members' },
                { icon: Activity, label: 'Active Now', value: String(stats?.activeUsers || 0), color: '#22c55e', bg: '#22c55e10', desc: 'Timing focus', sub: stats?.activeUsers ? `${Math.round(stats.activeUsers / (stats.totalUsers || 1) * 100)}% of total` : undefined },
                { icon: Clock, label: 'Today Focus', value: formatHours(stats?.todayTotalMs || 0), color: '#8b5cf6', bg: '#8b5cf610', desc: 'Hours tracked today' },
                { icon: Zap, label: 'Today Sessions', value: String(stats?.todaySessionCount || 0), color: '#f97316', bg: '#f9731610', desc: 'Focus sessions' },
              ].map(({ icon: Icon, label, value, color, bg, desc, sub }, i) => (
                <motion.div key={label} variants={fadeUp}
                  className="rounded-2xl border border-surface-800/60 bg-surface-900 p-5 relative overflow-hidden hover:border-surface-700 hover:shadow-lg transition-all duration-200 group">
                  <div className="absolute top-0 right-0 w-20 h-20 opacity-5 pointer-events-none rounded-bl-full" style={{ backgroundColor: color }} />
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: bg }}>
                      <Icon size={18} style={{ color }} />
                    </div>
                  </div>
                  <p className="text-2xl font-display font-extrabold text-surface-50 mb-0.5">{value}</p>
                  <p className="text-xs text-surface-400 font-medium">{label}</p>
                  <p className="text-[10px] text-surface-500 mt-1">{desc}</p>
                  {sub && <p className="text-[10px] text-emerald-400 font-semibold mt-1">{sub}</p>}
                </motion.div>
              ))}
            </motion.div>

            {/* ═══ Navigation ═══ */}
            <div className="flex items-center gap-1.5 bg-surface-900 p-1.5 rounded-xl border border-surface-800 shadow-sm mb-6 w-fit">
              {(['overview', 'users', 'teams'] as AdminTab[]).map(tab => (
                <button key={tab} onClick={() => { setActiveTab(tab); setSearch(''); }}
                  className={`px-5 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    activeTab === tab ? 'bg-surface-800 text-surface-50 shadow-sm' : 'text-surface-400 hover:text-surface-200 hover:bg-surface-850/50'
                  }`}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* ═══ Overview ═══ */}
            {activeTab === 'overview' && (
              <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Active Teams */}
                  <motion.div variants={fadeUp} className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                          <Users size={14} className="text-sky-400" />
                        </div>
                        <span className="text-sm font-bold text-surface-100">Active Teams</span>
                      </div>
                      <button onClick={() => setActiveTab('teams')} className="text-[10px] font-bold text-brand-400 hover:text-brand-300 bg-brand-500/10 px-2.5 py-1 rounded-md transition-colors">View All</button>
                    </div>
                    <div className="space-y-3">
                      {teams.length === 0 ? (
                        <p className="text-xs text-surface-500 text-center py-4">No teams yet</p>
                      ) : teams.slice(0, 5).map(team => (
                        <div key={team._id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-850/50 border border-surface-800 hover:border-surface-700 transition-all">
                          <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center flex-shrink-0">
                            <Users size={14} className="text-sky-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-surface-100 truncate">{team.name}</p>
                            <p className="text-[10px] text-surface-500">{team.members.length} members</p>
                          </div>
                          <div className="flex -space-x-1.5">
                            {team.members.slice(0, 3).map(m => (
                              <div key={m._id} className="w-6 h-6 rounded-full bg-surface-700 border-2 border-surface-900 flex items-center justify-center text-[8px] font-bold text-surface-300">
                                {m.name.charAt(0)}
                              </div>
                            ))}
                            {team.members.length > 3 && (
                              <div className="w-6 h-6 rounded-full bg-brand-500/20 border-2 border-surface-900 flex items-center justify-center text-[8px] font-bold text-brand-400">
                                +{team.members.length - 3}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Recent Users */}
                  <motion.div variants={fadeUp} className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <UserIcon size={14} className="text-emerald-400" />
                        </div>
                        <span className="text-sm font-bold text-surface-100">Recent Users</span>
                      </div>
                      <button onClick={() => setActiveTab('users')} className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-md transition-colors">View All</button>
                    </div>
                    <div className="space-y-2.5">
                      {users.length === 0 ? (
                        <p className="text-xs text-surface-500 text-center py-4">No users yet</p>
                      ) : users.slice(0, 5).map(u => (
                        <div key={u._id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-850/50 border border-transparent hover:border-surface-800 transition-all group cursor-pointer"
                          onClick={() => loadUserDetail(u)}>
                          <div className="w-9 h-9 rounded-xl bg-surface-800 flex items-center justify-center text-brand-400 font-bold flex-shrink-0 group-hover:bg-brand-500/10 transition-colors">
                            {u.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-surface-100 truncate">{u.name}</p>
                            <p className="text-[10px] text-surface-500 truncate">{u.email}</p>
                          </div>
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-surface-800 text-surface-400 font-bold uppercase border border-surface-700">
                            {u.role}
                          </span>
                          <ChevronRight size={14} className="text-surface-600 group-hover:text-brand-400 transition-colors flex-shrink-0" />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* ═══ Users Tab ═══ */}
            {activeTab === 'users' && (
              <motion.div variants={stagger} initial="hidden" animate="show">
                <motion.div variants={fadeUp} className="relative mb-5">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500" size={16} />
                  <input className="input pl-11 py-3 rounded-xl" placeholder="Search users by name or email…"
                    value={search} onChange={e => setSearch(e.target.value)} />
                </motion.div>
                {filteredUsers.length === 0 ? (
                  <motion.div variants={fadeUp} className="rounded-2xl border border-surface-800 bg-surface-900 p-12 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-surface-800 flex items-center justify-center mx-auto mb-3">
                      <UserIcon size={24} className="text-surface-500" />
                    </div>
                    <p className="text-sm font-semibold text-surface-200">No users found</p>
                    <p className="text-xs text-surface-500 mt-1">Try adjusting your search</p>
                  </motion.div>
                ) : (
                  <motion.div variants={stagger} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredUsers.map(u => (
                      <motion.div key={u._id} variants={fadeUp} whileHover={{ y: -3 }}
                        onClick={() => loadUserDetail(u)}
                        className="rounded-2xl border border-surface-800 bg-surface-900 p-5 cursor-pointer hover:border-brand-500/40 hover:shadow-lg transition-all duration-200 group">
                        <div className="flex items-center gap-3.5">
                          <div className="w-11 h-11 rounded-2xl bg-surface-800 flex items-center justify-center text-brand-400 font-bold group-hover:bg-brand-500/10 transition-colors flex-shrink-0">
                            {u.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-surface-50 truncate">{u.name}</h3>
                            <p className="text-[11px] text-surface-400 truncate">{u.email}</p>
                          </div>
                          <ChevronRight size={16} className="text-surface-600 group-hover:text-brand-400 transition-colors flex-shrink-0" />
                        </div>
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-800">
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-surface-800 text-surface-400 font-bold uppercase border border-surface-700">{u.role}</span>
                          <span className="text-[10px] text-surface-500 ml-auto">Joined {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ═══ Teams Tab ═══ */}
            {activeTab === 'teams' && (
              <motion.div variants={stagger} initial="hidden" animate="show">
                <motion.div variants={fadeUp} className="flex items-center gap-3 mb-5">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500" size={16} />
                    <input className="input pl-11 py-3 rounded-xl" placeholder="Search teams…"
                      value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <button onClick={() => { setEditingTeam(null); setTeamName(''); setTeamDesc(''); setTeamMembers([]); setShowTeamModal(true); }}
                    className="btn-primary flex items-center gap-2 h-[46px] rounded-xl px-5">
                    <Plus size={16} /> New Team
                  </button>
                </motion.div>
                {filteredTeams.length === 0 ? (
                  <motion.div variants={fadeUp} className="rounded-2xl border border-surface-800 bg-surface-900 p-12 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-surface-800 flex items-center justify-center mx-auto mb-3">
                      <Users size={24} className="text-surface-500" />
                    </div>
                    <p className="text-sm font-semibold text-surface-200">No teams found</p>
                    <p className="text-xs text-surface-500 mt-1">Create your first team to get started</p>
                  </motion.div>
                ) : (
                  <motion.div variants={stagger} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredTeams.map(t => (
                      <motion.div key={t._id} variants={fadeUp}
                        className="rounded-2xl border border-surface-800 bg-surface-900 p-6 flex flex-col justify-between hover:border-surface-700 hover:shadow-lg transition-all duration-200 group">
                        <div>
                          <div className="flex items-start justify-between mb-4">
                            <div className="w-11 h-11 rounded-2xl bg-sky-500/10 flex items-center justify-center">
                              <Users size={18} className="text-sky-400" />
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => { setEditingTeam(t); setTeamName(t.name); setTeamDesc(t.description || ''); setTeamMembers(t.members.map(m => m._id)); setShowTeamModal(true); }}
                                className="p-2 rounded-lg hover:bg-surface-800 text-surface-400 hover:text-surface-50 transition-all">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => handleDeleteTeam(t._id)}
                                className="p-2 rounded-lg hover:bg-red-400/10 text-surface-400 hover:text-red-400 transition-all">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          <h3 className="text-base font-bold text-surface-50 mb-1.5">{t.name}</h3>
                          <p className="text-xs text-surface-400 mb-4 line-clamp-2 leading-relaxed">{t.description || 'No description'}</p>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-surface-800">
                          <div className="flex items-center gap-2">
                            <div className="flex -space-x-1.5">
                              {t.members.slice(0, 3).map(m => (
                                <div key={m._id} className="w-7 h-7 rounded-full bg-surface-800 border-2 border-surface-900 flex items-center justify-center text-[9px] font-bold text-surface-300">
                                  {m.name.charAt(0)}
                                </div>
                              ))}
                            </div>
                            <span className="text-[10px] text-surface-500 font-medium">{t.members.length} members</span>
                          </div>
                          <button onClick={() => loadTeamDetail(t)}
                            className="text-[10px] font-bold text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors">
                            Analytics <ChevronRight size={10} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            )}
          </motion.div>
        ) : selectedUser ? (
          <UserDetailView user={selectedUser} analytics={userAnalytics} loading={loadingDetail} filter={filter} setFilter={setFilter} onBack={() => setSelectedUser(null)} />
        ) : selectedTeam ? (
          <TeamDetailView team={selectedTeam} analytics={teamAnalytics} loading={loadingDetail} filter={filter} setFilter={setFilter} onBack={() => setSelectedTeam(null)} />
        ) : null}
      </AnimatePresence>

      {/* ═══ Team Create/Edit Modal ═══ */}
      <AnimatePresence>
        {showTeamModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowTeamModal(false)} className="absolute inset-0 bg-surface-950/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }} transition={{ duration: 0.2 }}
              className="relative bg-surface-900 border border-surface-800 rounded-2xl w-full max-w-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto scrollbar-thin">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-display font-extrabold text-surface-50">{editingTeam ? 'Edit Team' : 'Create New Team'}</h2>
                <button onClick={() => setShowTeamModal(false)} className="p-2 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-surface-300 mb-2">Team Name</label>
                  <input className="input h-12 rounded-xl" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. Frontend Engineering" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-300 mb-2">Description</label>
                  <textarea className="input min-h-[90px] rounded-xl resize-none" value={teamDesc} onChange={e => setTeamDesc(e.target.value)} placeholder="Describe the team's purpose…" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-300 mb-2">Add Members</label>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" size={14} />
                    <input className="input pl-9 py-2 h-10 rounded-xl text-xs" placeholder="Search members…"
                      value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto space-y-1.5 pr-2 scrollbar-thin">
                    {users.filter(u => !memberSearch || u.name.toLowerCase().includes(memberSearch.toLowerCase()) || u.email.toLowerCase().includes(memberSearch.toLowerCase())).map(u => {
                      const isMember = teamMembers.includes(u._id);
                      return (
                        <div key={u._id}
                          onClick={() => { if (isMember) setTeamMembers(teamMembers.filter(id => id !== u._id)); else setTeamMembers([...teamMembers, u._id]); }}
                          className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                            isMember ? 'bg-brand-500/10 border-brand-500/40' : 'bg-surface-850/50 border-surface-800 hover:border-surface-700'
                          }`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            isMember ? 'bg-brand-500 text-white' : 'bg-surface-800 text-surface-400'
                          }`}>
                            {isMember ? <Check size={14} /> : u.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-surface-50">{u.name}</p>
                            <p className="text-[10px] text-surface-500">{u.email}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {teamMembers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {teamMembers.map(id => {
                        const user = users.find(u => u._id === id);
                        if (!user) return null;
                        return (
                          <span key={id} className="inline-flex items-center gap-1 bg-brand-500/10 text-brand-400 text-[10px] font-semibold px-2 py-1 rounded-lg border border-brand-500/20">
                            {user.name}
                            <button onClick={e => { e.stopPropagation(); setTeamMembers(teamMembers.filter(mid => mid !== id)); }} className="hover:text-brand-200">
                              <X size={10} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-surface-800">
                <button onClick={() => setShowTeamModal(false)} className="btn-secondary px-6 rounded-xl">Cancel</button>
                <button onClick={handleSaveTeam} className="btn-primary px-8 rounded-xl">{editingTeam ? 'Update Team' : 'Create Team'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  planning:    'text-purple-400 bg-purple-400/10 border-purple-400/20',
  'in-progress':'text-brand-400 bg-brand-400/10 border-brand-400/20',
  reviewing:   'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  blocked:     'text-red-400 bg-red-400/10 border-red-400/20',
  done:        'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
};
const MOOD_EMOJIS = ['😔', '😐', '🙂', '😊', '🔥'];

const HEAT_STYLES = [
  'bg-surface-800',
  'bg-brand-900/60 border-brand-800',
  'bg-brand-700/50 border-brand-600',
  'bg-brand-500/60 border-brand-500',
  'bg-brand-400    border-brand-300',
];

function heatLevel(hours: number): number {
  if (hours === 0) return 0;
  if (hours < 2)   return 1;
  if (hours < 4)   return 2;
  if (hours < 6)   return 3;
  return 4;
}

function CalendarHeatmap({
  month, summary, onDayClick, selectedDate,
}: {
  month: Date;
  summary: any[];
  onDayClick: (date: string) => void;
  selectedDate: string | null;
}) {
  const days   = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const sumMap = Object.fromEntries(summary.map(s => [s.date, s]));
  const firstDow = startOfMonth(month).getDay();

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="text-center text-[10px] text-surface-500 py-1 font-semibold uppercase tracking-wider">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
        {days.map(day => {
          const ds   = format(day, 'yyyy-MM-dd');
          const data = sumMap[ds];
          const heat = heatLevel(data?.totalHours || 0);
          const sel  = selectedDate === ds;
          const tod  = isTodayDateFns(day);
          return (
            <motion.button key={ds} whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.93 }}
              onClick={() => onDayClick(ds)}
              className={`aspect-square rounded-lg border transition-all text-xs relative ${
                HEAT_STYLES[heat]} ${sel ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-950' : ''} ${tod ? 'ring-1 ring-brand-400' : ''
              }`}
              title={data ? `${ds}: ${data.totalHours}h, ${data.workLogCount} logs, ${data.completedCount} completed` : ds}>
              <span className={`absolute inset-0 flex items-center justify-center text-[10px] md:text-xs ${heat >= 2 ? 'text-surface-50' : 'text-surface-400'} ${tod ? 'font-bold' : ''}`}>
                {day.getDate()}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function UserDetailView({ user, analytics, loading, filter, setFilter, onBack }: any) {
  const { theme } = useStore();
  const [detailTab, setDetailTab] = useState<'analytics' | 'worklogs' | 'reports'>('analytics');
  const [reportMonth, setReportMonth] = useState(new Date());
  const [reportSummary, setReportSummary] = useState<any[]>([]);
  const [loadingReportSummary, setLoadingReportSummary] = useState(false);
  const [selectedReportDate, setSelectedReportDate] = useState<string | null>(null);
  const [dayReportDetail, setDayReportDetail] = useState<any>(null);
  const [loadingDayReportDetail, setLoadingDayReportDetail] = useState(false);

  const accent = theme?.accentColor || '#0ea5e9';

  useEffect(() => {
    if (detailTab !== 'reports') return;
    setLoadingReportSummary(true);
    const from = format(startOfMonth(reportMonth), 'yyyy-MM-dd');
    const to = format(endOfMonth(reportMonth), 'yyyy-MM-dd');
    api.admin.getUserReportsSummary(user._id, from, to)
      .then(setReportSummary)
      .catch(err => toast.error('Failed to load report summary', err.message))
      .finally(() => setLoadingReportSummary(false));
  }, [detailTab, reportMonth, user._id]);

  useEffect(() => {
    if (!selectedReportDate) { setDayReportDetail(null); return; }
    setLoadingDayReportDetail(true);
    api.admin.getUserReportDay(user._id, selectedReportDate)
      .then(setDayReportDetail)
      .catch(err => toast.error('Failed to load day report', err.message))
      .finally(() => setLoadingDayReportDetail(false));
  }, [selectedReportDate, user._id]);

  const chartData = useMemo(() => {
    if (!analytics) return [];
    const days: Record<string, number> = {};
    analytics.sessions.forEach((s: any) => {
      const date = new Date(s.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      days[date] = (days[date] || 0) + (s.activeTime || 0) / 3600000;
    });
    return Object.entries(days)
      .map(([date, hours]) => ({ date, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7);
  }, [analytics]);

  const completionRate = analytics ? (analytics.summary.totalTasks > 0 ? Math.round(analytics.summary.completedTasks / analytics.summary.totalTasks * 100) : 0) : 0;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      {/* Back + User Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2.5 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 transition-all">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-400 font-bold text-lg">
            {user.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-display font-extrabold text-surface-50">{user.name}</h1>
            <p className="text-sm text-surface-400">{user.email}</p>
          </div>
        </div>
        {detailTab === 'analytics' && <div className="ml-auto"><FilterSelector active={filter} onChange={setFilter} /></div>}
      </div>

      {/* Detail Tabs */}
      <div className="flex items-center gap-1 bg-surface-900 p-1 rounded-xl border border-surface-800 mb-6 w-fit">
        {[
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'worklogs', label: 'Work Logs', icon: BookMarked },
          { id: 'reports', label: 'Daily Reports', icon: Calendar }
        ].map(t => (
          <button key={t.id} onClick={() => { setDetailTab(t.id as any); setSelectedReportDate(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              detailTab === t.id ? 'bg-surface-800 text-surface-50 shadow-sm' : 'text-surface-400 hover:text-surface-200'
            }`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? <LoadingPlaceholder /> : (
        <>
          {/* ═══ Analytics Tab ═══ */}
          {detailTab === 'analytics' && analytics && (
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
              <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Clock} label="Focus Time" value={formatHours(analytics.summary.totalTimeMs)} color={accent} />
                <StatCard icon={CheckCircle2} label="Completed" value={`${analytics.summary.completedTasks}/${analytics.summary.totalTasks}`} color="#22c55e" sub={`${completionRate}% rate`} />
                <StatCard icon={BookMarked} label="Work Logs" value={String(analytics.summary.workLogCount)} color="#8b5cf6" />
                <StatCard icon={BarChart3} label="Sessions" value={String(analytics.summary.sessionCount)} color="#f97316" />
              </motion.div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div variants={fadeUp} className="lg:col-span-2 rounded-2xl border border-surface-800 bg-surface-900 p-6">
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                      <TrendingUp size={14} className="text-sky-400" />
                    </div>
                    <span className="text-sm font-bold text-surface-100">Daily Focus</span>
                  </div>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-surface-800)" />
                        <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-800)', borderRadius: 12, fontSize: 12, color: 'var(--color-surface-50)' }} />
                        <Bar dataKey="hours" fill={accent} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>

                <motion.div variants={fadeUp} className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <Star size={14} className="text-purple-400" />
                    </div>
                    <span className="text-sm font-bold text-surface-100">Top Tasks</span>
                  </div>
                  <div className="space-y-2.5">
                    {analytics.tasks.slice(0, 6).map((t: any) => (
                      <div key={t._id} className="p-3 rounded-xl bg-surface-850/50 border border-surface-800">
                        <p className="text-sm font-medium text-surface-100 truncate">{t.title}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-surface-500 uppercase">{t.category}</span>
                          <span className="text-[10px] font-mono font-semibold text-brand-400">{formatHours(t.totalTime)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* ═══ Work Logs Tab ═══ */}
          {detailTab === 'worklogs' && analytics && (
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
              <motion.div variants={fadeUp} className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <BookMarked size={14} className="text-purple-400" />
                </div>
                <span className="text-sm font-bold text-surface-100">Work Logs</span>
                <span className="text-[10px] text-surface-500 font-medium">{analytics.workLogs?.length || 0} entries</span>
              </motion.div>
              {analytics.workLogs && analytics.workLogs.length > 0 ? (
                analytics.workLogs.map((log: any) => (
                  <motion.div key={log._id} variants={fadeUp}
                    className="rounded-2xl border border-surface-800 bg-surface-900 p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-3 flex-wrap justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="font-semibold text-surface-50 text-sm">{log.title}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_COLOR[log.status] || 'text-surface-400 bg-surface-700'}`}>{log.status}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {log.mood && <span className="text-lg">{MOOD_EMOJIS[log.mood - 1]}</span>}
                        <span className="text-[10px] text-surface-500">{new Date(log.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {log.gitBranch && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono bg-emerald-500/5 rounded-lg px-2.5 py-1.5 w-fit">
                        <GitBranch size={12} /> {log.gitBranch}
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {log.problem && (
                        <div className="bg-surface-850/50 p-3.5 rounded-xl border border-surface-800">
                          <span className="block text-[9px] text-surface-500 uppercase tracking-wider mb-1.5 font-semibold">Problem</span>
                          <div className="prose-editor text-xs text-surface-200 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(log.problem) }} />
                        </div>
                      )}
                      {log.currentWork && (
                        <div className="bg-surface-850/50 p-3.5 rounded-xl border border-surface-800">
                          <span className="block text-[9px] text-surface-500 uppercase tracking-wider mb-1.5 font-semibold">What was done</span>
                          <div className="prose-editor text-xs text-surface-200 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(log.currentWork) }} />
                        </div>
                      )}
                    </div>
                    {log.completedItems && log.completedItems.length > 0 && (
                      <div>
                        <span className="block text-[9px] text-surface-500 uppercase tracking-wider mb-2 font-semibold">Completed Checklist</span>
                        <div className="space-y-1.5">
                          {log.completedItems.map((item: any) => (
                            <div key={item._id} className="flex items-center gap-2 text-xs text-surface-300">
                              <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" /> {item.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {log.blockers && (
                      <div className="p-3.5 bg-red-500/5 border border-red-500/10 rounded-xl">
                        <span className="block text-[9px] text-red-400 uppercase tracking-wider mb-1.5 font-semibold">Blockers</span>
                        <div className="prose-editor text-xs text-surface-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(log.blockers) }} />
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {log.plan && (
                        <div>
                          <span className="block text-[9px] text-surface-500 uppercase tracking-wider mb-1.5 font-semibold">Next Plan</span>
                          <div className="prose-editor text-xs text-surface-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(log.plan) }} />
                        </div>
                      )}
                      {log.designNotes && (
                        <div>
                          <span className="block text-[9px] text-surface-500 uppercase tracking-wider mb-1.5 font-semibold">Design & Arch Notes</span>
                          <div className="prose-editor text-xs text-surface-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(log.designNotes) }} />
                        </div>
                      )}
                    </div>
                    {log.links && log.links.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-3 border-t border-surface-800">
                        {log.links.map((link: any) => (
                          <a key={link._id} href={link.url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 bg-cyan-500/5 px-2.5 py-1 rounded-lg border border-cyan-500/10 transition-colors">
                            <ExternalLink size={10} /> {link.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))
              ) : (
                <div className="rounded-2xl border border-surface-800 bg-surface-900 p-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-surface-800 flex items-center justify-center mx-auto mb-3">
                    <BookMarked size={20} className="text-surface-500" />
                  </div>
                  <p className="text-sm font-semibold text-surface-200">No work logs found</p>
                  <p className="text-xs text-surface-500 mt-1">This user hasn't logged any work yet</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ Reports Tab ═══ */}
          {detailTab === 'reports' && (
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
              {selectedReportDate ? (
                <motion.div variants={fadeUp}>
                  <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => setSelectedReportDate(null)}
                      className="p-2.5 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 transition-all">
                      <ArrowLeft size={16} />
                    </button>
                    <div>
                      <h2 className="text-lg font-display font-extrabold text-surface-50">Daily Report — {selectedReportDate}</h2>
                      <p className="text-xs text-surface-400">Viewing work details for {user.name}</p>
                    </div>
                  </div>
                  {loadingDayReportDetail ? <LoadingPlaceholder /> : dayReportDetail ? (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                      <div className="lg:col-span-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard icon={Clock} label="Time Worked" value={formatHours(dayReportDetail.totalMs)} color={accent} />
                        <StatCard icon={BarChart3} label="Sessions" value={String(dayReportDetail.sessionCount)} color="#8b5cf6" />
                        <StatCard icon={Target} label="Tasks Worked" value={String(dayReportDetail.tasks?.length || 0)} color="#f97316" />
                        <StatCard icon={CheckCircle2} label="Completed" value={String(dayReportDetail.completedCount)} color="#22c55e" />
                      </div>
                      <div className="lg:col-span-3 space-y-3">
                        <h3 className="text-sm font-bold text-surface-100 flex items-center gap-2">
                          <BookMarked size={14} className="text-brand-400" /> Work Logs
                        </h3>
                        {dayReportDetail.workLogs?.length === 0 ? (
                          <p className="text-xs text-surface-500 italic">No work logs for this day</p>
                        ) : dayReportDetail.workLogs.map((log: any) => (
                          <div key={log._id} className="rounded-2xl border border-surface-800 bg-surface-900 p-4 flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-surface-50">{log.title}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] border ${STATUS_COLOR[log.status] || 'text-surface-400 bg-surface-700'}`}>{log.status}</span>
                              {log.mood && <span className="text-base ml-auto">{MOOD_EMOJIS[log.mood - 1]}</span>}
                            </div>
                            {log.gitBranch && <p className="text-[11px] font-mono text-emerald-400">Branch: {log.gitBranch}</p>}
                            {log.problem && <p className="text-xs text-surface-300"><strong className="text-surface-400">Problem:</strong> {log.problem}</p>}
                            {log.currentWork && <p className="text-xs text-surface-300"><strong className="text-surface-400">Done:</strong> {log.currentWork}</p>}
                            {log.completedItems?.length > 0 && (
                              <div className="space-y-1 mt-1">
                                {log.completedItems.map((item: any) => (
                                  <div key={item._id} className="flex items-center gap-1.5 text-[11px] text-surface-300">
                                    <CheckCircle2 size={10} className="text-emerald-400" /> {item.text}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="lg:col-span-2 space-y-3">
                        <h3 className="text-sm font-bold text-surface-100 flex items-center gap-2">
                          <Clock size={14} className="text-brand-400" /> Time by Task
                        </h3>
                        {dayReportDetail.tasks?.length === 0 ? (
                          <p className="text-xs text-surface-500 italic">No sessions tracked</p>
                        ) : dayReportDetail.tasks.map((task: any) => {
                          const pct = dayReportDetail.totalMs > 0 ? (task.totalMs / dayReportDetail.totalMs) * 100 : 0;
                          return (
                            <div key={task.taskId} className="rounded-2xl border border-surface-800 bg-surface-900 p-3.5">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-medium text-surface-50 truncate">{task.title}</span>
                                <span className="text-[10px] font-mono font-semibold text-brand-400">{formatHours(task.totalMs)}</span>
                              </div>
                              <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                                <motion.div className="h-full rounded-full" style={{ backgroundColor: task.color }}
                                  initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-surface-400 italic">No report details available</p>
                  )}
                </motion.div>
              ) : (
                <motion.div variants={fadeUp}>
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                        <Calendar size={14} className="text-sky-400" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-surface-100">Heatmap & Month Summary</span>
                        <p className="text-[10px] text-surface-500">Click any day to view details</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-surface-900 p-1 rounded-lg border border-surface-800">
                      <button onClick={() => setReportMonth(m => subMonths(m, 1))} className="p-2 rounded-md hover:bg-surface-800 text-surface-400 transition-all"><ChevronLeft size={14} /></button>
                      <span className="text-xs font-semibold text-surface-50 min-w-[100px] text-center">{format(reportMonth, 'MMMM yyyy')}</span>
                      <button onClick={() => setReportMonth(m => addMonths(m, 1))} className="p-2 rounded-md hover:bg-surface-800 text-surface-400 transition-all"><ChevronRight size={14} /></button>
                    </div>
                  </div>
                  {loadingReportSummary ? <LoadingPlaceholder /> : (
                    <>
                      <div className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
                        <CalendarHeatmap month={reportMonth} summary={reportSummary} onDayClick={setSelectedReportDate} selectedDate={selectedReportDate} />
                      </div>
                      <div className="flex items-center gap-1.5 justify-end mt-3">
                        <span className="text-[10px] text-surface-500 font-semibold">Less</span>
                        {HEAT_STYLES.map((cls, i) => <div key={i} className={`w-3.5 h-3.5 rounded border ${cls}`} />)}
                        <span className="text-[10px] text-surface-500 font-semibold">More</span>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}

function TeamDetailView({ team, analytics, loading, filter, setFilter, onBack }: any) {
  const { theme } = useStore();
  const accent = theme?.accentColor || '#0ea5e9';
  const chartData = useMemo(() => {
    if (!analytics?.memberBreakdown) return [];
    return analytics.memberBreakdown
      .map((m: any) => ({ name: m.name || 'Unknown', hours: Math.round((m.totalTimeMs || 0) / 3600000 * 10) / 10 }))
      .sort((a: any, b: any) => b.hours - a.hours);
  }, [analytics]);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2.5 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 transition-all">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-display font-extrabold text-surface-50">{team?.name || 'Team Analytics'}</h1>
          <p className="text-sm text-surface-400">{team?.members?.length || 0} active members</p>
        </div>
        <div className="ml-auto"><FilterSelector active={filter} onChange={setFilter} /></div>
      </div>

      {loading ? <LoadingPlaceholder /> : analytics && (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
          <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Clock} label="Team Total Focus" value={formatHours(analytics.summary?.totalTimeMs || 0)} color={accent} />
            <StatCard icon={CheckCircle2} label="Tasks Completed" value={String(analytics.summary?.completedTasks || 0)} color="#22c55e" />
            <StatCard icon={Users} label="Team Size" value={String(analytics.summary?.activeMembers || 0)} color="#8b5cf6" />
            <StatCard icon={Zap} label="Avg Time / User" value={formatHours((analytics.summary?.totalTimeMs || 0) / (analytics.summary?.activeMembers || 1))} color="#f97316" />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div variants={fadeUp} className="lg:col-span-2 rounded-2xl border border-surface-800 bg-surface-900 p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <BarChart3 size={14} className="text-purple-400" />
                </div>
                <span className="text-sm font-bold text-surface-100">Team Contribution</span>
              </div>
              <div className="h-[300px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--color-surface-800)" />
                      <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" tick={{ fill: '#a1a1aa', fontSize: 11 }} axisLine={false} width={100} />
                      <Tooltip contentStyle={{ background: 'var(--color-surface-900)', border: '1px solid var(--color-surface-800)', borderRadius: 12, fontSize: 12, color: 'var(--color-surface-50)' }} />
                      <Bar dataKey="hours" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-surface-500 text-sm">No contribution data for this period</div>
                )}
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Users size={14} className="text-emerald-400" />
                </div>
                <span className="text-sm font-bold text-surface-100">Member Activity</span>
              </div>
              <div className="space-y-3">
                {(analytics.memberBreakdown || []).map((m: any) => (
                  <div key={m.userId} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-850/50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-surface-800 flex items-center justify-center text-[10px] font-bold text-surface-50 flex-shrink-0">
                      {(m.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-surface-100 truncate">{m.name || 'Unknown User'}</p>
                      <p className="text-[10px] text-surface-500">{m.completedTasks || 0} tasks</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-surface-200">{formatHours(m.totalTimeMs || 0)}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <motion.div whileHover={{ y: -2 }}
      className="rounded-2xl border border-surface-800/60 bg-surface-900 p-5 relative overflow-hidden hover:border-surface-700 hover:shadow-lg transition-all duration-200">
      <div className="absolute top-0 right-0 w-16 h-16 opacity-5 pointer-events-none rounded-bl-full" style={{ backgroundColor: color }} />
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${color}10` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <p className="text-xl font-display font-extrabold text-surface-50 mb-0.5">{value}</p>
      <p className="text-[11px] text-surface-400 font-medium">{label}</p>
      {sub && <p className="text-[10px] text-emerald-400 font-semibold mt-1">{sub}</p>}
    </motion.div>
  );
}

function FilterSelector({ active, onChange }: any) {
  return (
    <div className="flex items-center gap-1 bg-surface-900 p-1 rounded-xl border border-surface-800">
      {(['today', 'week', 'month', 'all'] as FilterRange[]).map(r => (
        <button key={r} onClick={() => onChange(r)}
          className={`px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
            active === r ? 'bg-surface-800 text-surface-50 shadow-sm' : 'text-surface-400 hover:text-surface-200'
          }`}>
          {r.charAt(0).toUpperCase() + r.slice(1)}
        </button>
      ))}
    </div>
  );
}

function LoadingPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="grid grid-cols-2 gap-4 w-full max-w-md">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
      </div>
    </div>
  );
}
