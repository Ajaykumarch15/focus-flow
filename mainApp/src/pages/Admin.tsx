import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, User as UserIcon, Search, Loader2, Clock, 
  CheckCircle2, BarChart3, BookMarked, ChevronRight, ChevronLeft, GitBranch, ExternalLink,
  Calendar, ArrowLeft, Filter, TrendingUp, Zap, Activity,
  Settings, Plus, Trash2, Edit2, X, Check, ShieldCheck, Mail
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

export function AdminDashboard() {
  const { theme } = useStore();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Selection state
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamAnalytics, setTeamAnalytics] = useState<TeamAnalytics | null>(null);
  
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filter, setFilter] = useState<FilterRange>('all');
  
  // Team Management Modals
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');
  const [teamMembers, setTeamMembers] = useState<string[]>([]);

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    if (selectedUser) loadUserDetail(selectedUser);
    if (selectedTeam) loadTeamDetail(selectedTeam);
  }, [filter]);

  const loadBaseData = async () => {
    setLoading(true);
    try {
      const [u, t, s] = await Promise.all([
        api.admin.listUsers(),
        api.teams.list(),
        api.admin.getStats()
      ]);
      setUsers(u);
      setTeams(t);
      setStats(s);
    } catch (err: any) {
      toast.error('Failed to load admin data', err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRange = (range: FilterRange) => {
    const now = new Date();
    const to = now.getTime();
    let from: number | undefined;
    if (range === 'today') {
      const d = new Date(); d.setHours(0,0,0,0); from = d.getTime();
    } else if (range === 'week') {
      const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(0,0,0,0); from = d.getTime();
    } else if (range === 'month') {
      const d = new Date(); d.setMonth(d.getMonth() - 1); d.setHours(0,0,0,0); from = d.getTime();
    }
    return { from, to };
  };

  const loadUserDetail = async (user: UserSummary) => {
    setSelectedUser(user);
    setLoadingDetail(true);
    try {
      const { from, to } = getRange(filter);
      const data = await api.admin.getUserAnalytics(user._id, from, to);
      setUserAnalytics(data);
    } catch (err: any) {
      toast.error('Failed to load user analytics', err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const loadTeamDetail = async (team: Team) => {
    setSelectedTeam(team);
    setLoadingDetail(true);
    try {
      const { from, to } = getRange(filter);
      const data = await api.teams.getAnalytics(team._id, from, to);
      setTeamAnalytics(data);
    } catch (err: any) {
      toast.error('Failed to load team analytics', err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSaveTeam = async () => {
    if (!teamName.trim()) return toast.error('Team name required');
    try {
      if (editingTeam) {
        await api.teams.update(editingTeam._id, { name: teamName, description: teamDesc, members: teamMembers });
        toast.success('Team updated');
      } else {
        await api.teams.create({ name: teamName, description: teamDesc, members: teamMembers });
        toast.success('Team created');
      }
      setShowTeamModal(false);
      loadBaseData();
    } catch (err: any) {
      toast.error('Operation failed', err.message);
    }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm('Are you sure you want to delete this team?')) return;
    try {
      await api.teams.delete(id);
      toast.success('Team deleted');
      loadBaseData();
    } catch (err: any) {
      toast.error('Failed to delete team', err.message);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <Skeleton className="h-8 w-48 rounded mb-2" />
          <Skeleton className="h-4 w-64 rounded" />
        </div>
        <Skeleton className="h-10 w-48 rounded-2xl" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card p-6">
          <Skeleton className="h-5 w-32 rounded mb-6" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 mb-4">
              <SkeletonCircle size={36} />
              <div className="flex-1">
                <Skeleton className="h-4 w-28 rounded mb-1" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
            </div>
          ))}
        </div>
        <div className="card p-6">
          <Skeleton className="h-5 w-32 rounded mb-6" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 mb-4">
              <SkeletonCircle size={36} />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 rounded mb-1" />
                <Skeleton className="h-3 w-24 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      <AnimatePresence mode="wait">
        {!selectedUser && !selectedTeam ? (
          <motion.div key="admin-main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl lg:text-4xl font-display font-extrabold text-surface-50 tracking-tight flex items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xl">🛡️</span>
                  Admin Console
                </h1>
                <p className="text-surface-400 font-medium text-sm mt-1.5">Manage users, teams, and track global productivity</p>
              </div>
              <div className="flex items-center gap-2 bg-surface-900 p-1.5 rounded-[14px] border border-surface-800 shadow-sm">
                {(['overview', 'users', 'teams'] as AdminTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setSearch(''); }}
                    className={`px-5 py-2 rounded-[10px] text-xs font-semibold transition-all ${
                      activeTab === tab ? 'bg-brand-500 text-white shadow-sm' : 'text-surface-400 hover:text-surface-50'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Scoped by Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  <StatCard icon={Users} label="Total Users" value={String(stats?.totalUsers)} color={theme?.accentColor || "#0ea5e9"} />
                  <StatCard icon={Activity} label="Active Now" value={String(stats?.activeUsers)} color="#22c55e" sub="timing focus" />
                  <StatCard icon={Clock} label="Today Focus" value={formatHours(stats?.todayTotalMs || 0)} color="#8b5cf6" />
                  <StatCard icon={BarChart3} label="Today Sessions" value={String(stats?.todaySessionCount)} color="#f97316" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Top Teams Preview */}
                  <div className="card p-6 rounded-[22px] shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="font-display font-bold text-surface-50 flex items-center gap-2">
                        <Users size={18} className="text-brand-400" /> Active Teams
                      </h2>
                      <button onClick={() => setActiveTab('teams')} className="text-xs text-brand-400 hover:underline">View All</button>
                    </div>
                    <div className="space-y-4">
                      {teams.slice(0, 5).map(team => (
                        <div key={team._id} className="p-4 bg-surface-900/50 rounded-2xl border border-surface-800 flex items-center justify-between">
                          <div>
                            <h3 className="text-surface-50 font-semibold">{team.name}</h3>
                            <p className="text-xs text-surface-500">{team.members.length} members</p>
                          </div>
                          <div className="flex -space-x-2">
                            {team.members.slice(0, 4).map(m => (
                              <div key={m._id} className="w-8 h-8 rounded-full bg-surface-700 border-2 border-surface-950 flex items-center justify-center text-[10px] font-bold text-surface-50">
                                {m.name.charAt(0)}
                              </div>
                            ))}
                            {team.members.length > 4 && (
                              <div className="w-8 h-8 rounded-full bg-brand-500/20 border-2 border-surface-950 flex items-center justify-center text-[10px] font-bold text-brand-400">
                                +{team.members.length - 4}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick User List */}
                  <div className="card p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="font-display font-bold text-surface-50 flex items-center gap-2">
                        <UserIcon size={18} className="text-emerald-400" /> Recent Users
                      </h2>
                      <button onClick={() => setActiveTab('users')} className="text-xs text-emerald-400 hover:underline">View All</button>
                    </div>
                    <div className="space-y-3">
                      {users.slice(0, 5).map(u => (
                        <div key={u._id} className="flex items-center gap-3 p-3 bg-surface-900/50 rounded-xl border border-surface-800">
                          <div className="w-10 h-10 rounded-xl bg-surface-800 flex items-center justify-center text-brand-400 font-bold">
                            {u.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-surface-50 truncate">{u.name}</p>
                            <p className="text-[10px] text-surface-500 truncate">{u.email}</p>
                          </div>
                          <div className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 font-bold uppercase">
                            {u.role}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <>
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500" size={18} />
                  <input
                    className="input pl-11 py-3"
                    placeholder="Search users..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredUsers.map(u => (
                    <motion.div
                      key={u._id}
                      whileHover={{ y: -4 }}
                      onClick={() => loadUserDetail(u)}
                      className="card p-5 cursor-pointer hover:border-brand-500/50 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-surface-800 flex items-center justify-center text-brand-400 group-hover:bg-brand-500/10 transition-colors">
                          <UserIcon size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-surface-50 font-semibold truncate">{u.name}</h3>
                          <p className="text-sm text-surface-400 truncate">{u.email}</p>
                        </div>
                        <ChevronRight size={18} className="text-surface-600 group-hover:text-brand-400 transition-colors" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            )}

            {activeTab === 'teams' && (
              <>
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500" size={18} />
                    <input
                      className="input pl-11 py-3"
                      placeholder="Search teams..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={() => {
                      setEditingTeam(null);
                      setTeamName('');
                      setTeamDesc('');
                      setTeamMembers([]);
                      setShowTeamModal(true);
                    }}
                    className="btn-primary flex items-center gap-2 h-full"
                  >
                    <Plus size={18} /> New Team
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredTeams.map(t => (
                    <div key={t._id} className="card p-6 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-3 rounded-2xl bg-brand-500/10 text-brand-400">
                            <Users size={24} />
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => {
                                setEditingTeam(t);
                                setTeamName(t.name);
                                setTeamDesc(t.description || '');
                                setTeamMembers(t.members.map(m => m._id));
                                setShowTeamModal(true);
                              }}
                              className="p-2 rounded-lg hover:bg-surface-800 text-surface-400 hover:text-surface-50 transition-all"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteTeam(t._id)}
                              className="p-2 rounded-lg hover:bg-red-400/10 text-surface-400 hover:text-red-400 transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <h3 className="text-xl font-bold text-surface-50 mb-2">{t.name}</h3>
                        <p className="text-sm text-surface-400 mb-6 line-clamp-2">{t.description || 'No description'}</p>
                      </div>
                      
                      <div className="flex items-center justify-between pt-6 border-t border-surface-800">
                        <div className="flex -space-x-2">
                          {t.members.slice(0, 3).map(m => (
                            <div key={m._id} className="w-8 h-8 rounded-full bg-surface-800 border-2 border-surface-950 flex items-center justify-center text-[10px] font-bold text-surface-50">
                              {m.name.charAt(0)}
                            </div>
                          ))}
                        </div>
                        <button 
                          onClick={() => loadTeamDetail(t)}
                          className="text-xs font-bold text-brand-400 hover:text-brand-300 flex items-center gap-1"
                        >
                          Team Analytics <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        ) : selectedUser ? (
          <UserDetailView 
            user={selectedUser} 
            analytics={userAnalytics} 
            loading={loadingDetail} 
            filter={filter} 
            setFilter={setFilter} 
            onBack={() => setSelectedUser(null)} 
          />
        ) : selectedTeam ? (
          <TeamDetailView 
            team={selectedTeam} 
            analytics={teamAnalytics} 
            loading={loadingDetail} 
            filter={filter} 
            setFilter={setFilter} 
            onBack={() => setSelectedTeam(null)} 
          />
        ) : null}
      </AnimatePresence>

      {/* Team Create/Edit Modal */}
      <AnimatePresence>
        {showTeamModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTeamModal(false)} className="absolute inset-0 bg-surface-950/80 backdrop-blur-sm" />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-surface-900 border border-surface-800 rounded-3xl w-full max-w-2xl shadow-2xl p-8"
            >
              <h2 className="text-2xl font-display font-bold text-surface-50 mb-6">
                {editingTeam ? 'Edit Team' : 'Create New Team'}
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-2">Team Name</label>
                  <input className="input" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. Frontend Engineering" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-2">Description</label>
                  <textarea className="input min-h-[100px]" value={teamDesc} onChange={e => setTeamDesc(e.target.value)} placeholder="Describe the team's purpose..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-3">Add Members</label>
                  <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {users.map(u => {
                      const isMember = teamMembers.includes(u._id);
                      return (
                        <div 
                          key={u._id} 
                          onClick={() => {
                            if (isMember) setTeamMembers(teamMembers.filter(id => id !== u._id));
                            else setTeamMembers([...teamMembers, u._id]);
                          }}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            isMember ? 'bg-brand-500/10 border-brand-500/50' : 'bg-surface-800/50 border-surface-800 hover:border-surface-700'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                            isMember ? 'bg-brand-500 text-white' : 'bg-surface-800 text-surface-400'
                          }`}>
                            {isMember ? <Check size={18} /> : u.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-surface-50">{u.name}</p>
                            <p className="text-xs text-surface-500">{u.email}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-8">
                <button onClick={() => setShowTeamModal(false)} className="px-6 py-2.5 text-sm font-medium text-surface-400 hover:text-surface-50 transition-colors">Cancel</button>
                <button onClick={handleSaveTeam} className="btn-primary px-8">{editingTeam ? 'Update Team' : 'Create Team'}</button>
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
  const firstDow = startOfMonth(month).getDay(); // 0=Sun

  return (
    <div>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="text-center text-xs text-surface-500 py-1 font-semibold">{d}</div>
        ))}
      </div>
      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells before first day */}
        {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}

        {days.map(day => {
          const ds   = format(day, 'yyyy-MM-dd');
          const data = sumMap[ds];
          const heat = heatLevel(data?.totalHours || 0);
          const sel  = selectedDate === ds;
          const tod  = isTodayDateFns(day);

          return (
            <motion.button
              key={ds}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onDayClick(ds)}
              className={`
                aspect-square rounded-lg border transition-all text-xs relative
                ${HEAT_STYLES[heat]}
                ${sel  ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-950' : ''}
                ${tod  ? 'ring-1 ring-brand-400' : ''}
              `}
              title={data ? `${ds}: ${data.totalHours}h, ${data.workLogCount} logs, ${data.completedCount} completed` : ds}
            >
              <span className={`absolute inset-0 flex items-center justify-center text-[10px] md:text-xs
                ${heat >= 2 ? 'text-surface-50' : 'text-surface-400'} ${tod ? 'font-bold' : ''}`}>
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

  // Reports tab state
  const [reportMonth, setReportMonth] = useState(new Date());
  const [reportSummary, setReportSummary] = useState<any[]>([]);
  const [loadingReportSummary, setLoadingReportSummary] = useState(false);
  const [selectedReportDate, setSelectedReportDate] = useState<string | null>(null);
  const [dayReportDetail, setDayReportDetail] = useState<any>(null);
  const [loadingDayReportDetail, setLoadingDayReportDetail] = useState(false);

  // Load reports summary for user
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

  // Load day report detail
  useEffect(() => {
    if (!selectedReportDate) {
      setDayReportDetail(null);
      return;
    }
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

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 transition-all"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-2xl font-display font-bold text-surface-50">{user.name}</h1>
            <p className="text-surface-400">{user.email}</p>
          </div>
        </div>
        {detailTab === 'analytics' && <FilterSelector active={filter} onChange={setFilter} />}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-surface-800 mb-6">
        {[
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'worklogs', label: 'Work Logs', icon: BookMarked },
          { id: 'reports', label: 'Daily Reports', icon: Calendar }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => {
              setDetailTab(t.id as any);
              setSelectedReportDate(null);
            }}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-all ${
              detailTab === t.id
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-surface-400 hover:text-surface-50'
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingPlaceholder />
      ) : (
        <>
          {detailTab === 'analytics' && analytics && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Clock} label="Focus Time" value={formatHours(analytics.summary.totalTimeMs)} color={theme?.accentColor || "#0ea5e9"} />
                <StatCard icon={CheckCircle2} label="Tasks Done" value={String(analytics.summary.completedTasks)} color="#22c55e" />
                <StatCard icon={BookMarked} label="Work Logs" value={String(analytics.summary.workLogCount)} color="#8b5cf6" />
                <StatCard icon={BarChart3} label="Sessions" value={String(analytics.summary.sessionCount)} color="#f97316" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 card p-6">
                  <h2 className="text-lg font-bold text-surface-50 mb-6 flex items-center gap-2"><TrendingUp size={18} className="text-brand-400" /> Daily Focus</h2>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                        <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: '#27272a', radius: 8 }} contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} />
                        <Bar dataKey="hours" fill={theme?.accentColor || "#0ea5e9"} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="card p-6">
                  <h2 className="text-lg font-bold text-surface-50 mb-4">Top Tasks</h2>
                  <div className="space-y-3">
                    {analytics.tasks.slice(0, 6).map((t: any) => (
                      <div key={t._id} className="p-3 bg-surface-900/50 rounded-xl border border-surface-800">
                        <p className="text-surface-50 text-sm font-medium truncate">{t.title}</p>
                        <p className="text-[10px] text-surface-500 uppercase mt-1">{t.category} · {formatHours(t.totalTime)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {detailTab === 'worklogs' && analytics && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-surface-50 mb-2 flex items-center gap-2">
                <BookMarked className="text-brand-400" size={18} /> User Work Logs
              </h2>
              {analytics.workLogs && analytics.workLogs.length > 0 ? (
                analytics.workLogs.map((log: any) => (
                  <div key={log._id} className="card p-5 border border-surface-800 flex flex-col gap-4">
                    <div className="flex items-center gap-3 flex-wrap justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-surface-50 text-base">{log.title}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLOR[log.status] || 'text-surface-400 bg-surface-700'}`}>
                          {log.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {log.mood && <span className="text-xl">{MOOD_EMOJIS[log.mood - 1]}</span>}
                        <span className="text-xs text-surface-500">Updated {new Date(log.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {log.gitBranch && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                        <GitBranch size={12} /> {log.gitBranch}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {log.problem && (
                        <div className="bg-surface-900/30 p-3 rounded-xl border border-surface-800/40">
                          <span className="block text-[10px] text-surface-500 uppercase tracking-wider mb-1 font-semibold">Problem</span>
                          <div className="prose-editor text-sm text-surface-200" dangerouslySetInnerHTML={{ __html: renderMarkdown(log.problem) }} />
                        </div>
                      )}
                      {log.currentWork && (
                        <div className="bg-surface-900/30 p-3 rounded-xl border border-surface-800/40">
                          <span className="block text-[10px] text-surface-500 uppercase tracking-wider mb-1 font-semibold">What was done</span>
                          <div className="prose-editor text-sm text-surface-200" dangerouslySetInnerHTML={{ __html: renderMarkdown(log.currentWork) }} />
                        </div>
                      )}
                    </div>

                    {log.completedItems && log.completedItems.length > 0 && (
                      <div>
                        <span className="block text-[10px] text-surface-500 uppercase tracking-wider mb-2 font-semibold">Completed Checklist</span>
                        <div className="space-y-1.5 pl-1">
                          {log.completedItems.map((item: any) => (
                            <div key={item._id} className="flex items-start gap-2 text-xs text-surface-300">
                              <CheckCircle2 size={13} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                              <span>{item.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {log.blockers && (
                      <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                        <span className="block text-[10px] text-red-400 uppercase tracking-wider mb-1 font-semibold">Blockers</span>
                        <div className="prose-editor text-sm text-surface-300" dangerouslySetInnerHTML={{ __html: renderMarkdown(log.blockers) }} />
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {log.plan && (
                        <div>
                          <span className="block text-[10px] text-surface-500 uppercase tracking-wider mb-1 font-semibold">Next Plan</span>
                          <div className="prose-editor text-xs text-surface-300" dangerouslySetInnerHTML={{ __html: renderMarkdown(log.plan) }} />
                        </div>
                      )}
                      {log.designNotes && (
                        <div>
                          <span className="block text-[10px] text-surface-500 uppercase tracking-wider mb-1 font-semibold">Design & Arch Notes</span>
                          <div className="prose-editor text-xs text-surface-300" dangerouslySetInnerHTML={{ __html: renderMarkdown(log.designNotes) }} />
                        </div>
                      )}
                    </div>

                    {log.links && log.links.length > 0 && (
                      <div className="flex flex-wrap gap-3 pt-4 border-t border-surface-800/40">
                        {log.links.map((link: any) => (
                          <a key={link._id} href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                            <ExternalLink size={12} /> {link.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="card p-8 text-center text-surface-400 italic">No work logs found for this user.</div>
              )}
            </div>
          )}

          {detailTab === 'reports' && (
            <div className="space-y-6">
              {selectedReportDate ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedReportDate(null)}
                      className="p-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 transition-all"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <div>
                      <h2 className="text-xl font-bold text-surface-50">Daily Report - {selectedReportDate}</h2>
                      <p className="text-xs text-surface-400">Viewing work details for {user.name}</p>
                    </div>
                  </div>

                  {loadingDayReportDetail ? (
                    <LoadingPlaceholder />
                  ) : dayReportDetail ? (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                      {/* Stats Row */}
                      <div className="lg:col-span-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="card p-4">
                          <span className="block text-xs text-surface-400 mb-1">Time Worked</span>
                          <span className="text-lg font-bold text-brand-400">{formatHours(dayReportDetail.totalMs)}</span>
                        </div>
                        <div className="card p-4">
                          <span className="block text-xs text-surface-400 mb-1">Sessions Count</span>
                          <span className="text-lg font-bold text-purple-400">{dayReportDetail.sessionCount}</span>
                        </div>
                        <div className="card p-4">
                          <span className="block text-xs text-surface-400 mb-1">Tasks Worked</span>
                          <span className="text-lg font-bold text-yellow-400">{dayReportDetail.tasks?.length || 0}</span>
                        </div>
                        <div className="card p-4">
                          <span className="block text-xs text-surface-400 mb-1">Completed Items</span>
                          <span className="text-lg font-bold text-emerald-400">{dayReportDetail.completedCount}</span>
                        </div>
                      </div>

                      {/* Work Logs */}
                      <div className="lg:col-span-3 space-y-4">
                        <h3 className="font-semibold text-surface-50 flex items-center gap-2">
                          <BookMarked size={16} className="text-brand-400" /> Work Logs
                        </h3>
                        {dayReportDetail.workLogs?.length === 0 ? (
                          <p className="text-sm text-surface-500 italic">No work logs for this day</p>
                        ) : (
                          dayReportDetail.workLogs.map((log: any) => (
                            <div key={log._id} className="card p-4 border border-surface-800 flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-surface-50 text-sm">{log.title}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] border ${STATUS_COLOR[log.status] || 'text-surface-400 bg-surface-700'}`}>
                                  {log.status}
                                </span>
                                {log.mood && <span className="text-base ml-auto">{MOOD_EMOJIS[log.mood - 1]}</span>}
                              </div>
                              {log.gitBranch && <p className="text-xs font-mono text-emerald-400">Branch: {log.gitBranch}</p>}
                              {log.problem && <p className="text-xs text-surface-300"><strong className="text-surface-400">Problem:</strong> {log.problem}</p>}
                              {log.currentWork && <p className="text-xs text-surface-300"><strong className="text-surface-400">What I did:</strong> {log.currentWork}</p>}
                              {log.completedItems?.length > 0 && (
                                <div className="space-y-1 mt-1">
                                  {log.completedItems.map((item: any) => (
                                    <div key={item._id} className="flex items-center gap-1 text-[11px] text-surface-300">
                                      <CheckCircle2 size={10} className="text-emerald-400" />
                                      <span>{item.text}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      {/* Tasks & Times */}
                      <div className="lg:col-span-2 space-y-4">
                        <h3 className="font-semibold text-surface-50 flex items-center gap-2">
                          <Clock size={16} className="text-brand-400" /> Time by Task
                        </h3>
                        {dayReportDetail.tasks?.length === 0 ? (
                          <p className="text-sm text-surface-500 italic">No sessions tracked</p>
                        ) : (
                          dayReportDetail.tasks.map((task: any) => {
                            const pct = dayReportDetail.totalMs > 0 ? (task.totalMs / dayReportDetail.totalMs) * 100 : 0;
                            return (
                              <div key={task.taskId} className="card p-3 flex flex-col gap-1.5">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-medium text-surface-50 truncate">{task.title}</span>
                                  <span className="text-xs font-mono text-brand-400">{formatHours(task.totalMs)}</span>
                                </div>
                                <div className="h-1 bg-surface-800 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: task.color }} />
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-surface-400 italic">No report details available for this day.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h2 className="text-lg font-bold text-surface-50 flex items-center gap-2">
                        <Calendar size={18} className="text-brand-400" /> Heatmap & Month Summary
                      </h2>
                      <p className="text-xs text-surface-400">Click any day to view detailed daily reports</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setReportMonth(m => subMonths(m, 1))}
                        className="p-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 transition-all"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-sm font-semibold text-surface-50 min-w-[100px] text-center">
                        {format(reportMonth, 'MMMM yyyy')}
                      </span>
                      <button
                        onClick={() => setReportMonth(m => addMonths(m, 1))}
                        className="p-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 transition-all"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>

                  {loadingReportSummary ? (
                    <LoadingPlaceholder />
                  ) : (
                    <>
                      <div className="card p-6">
                        <CalendarHeatmap
                          month={reportMonth}
                          summary={reportSummary}
                          onDayClick={setSelectedReportDate}
                          selectedDate={selectedReportDate}
                        />
                      </div>
                      {/* Legend */}
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs text-surface-500 font-semibold">Less</span>
                        {['bg-surface-800', 'bg-brand-900/60 border border-brand-800', 'bg-brand-700/50 border border-brand-600', 'bg-brand-500/60 border border-brand-500', 'bg-brand-400 border border-brand-300'].map((cls, i) => (
                          <div key={i} className={`w-4 h-4 rounded border ${cls}`} />
                        ))}
                        <span className="text-xs text-surface-500 font-semibold font-medium">More</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

function TeamDetailView({ team, analytics, loading, filter, setFilter, onBack }: any) {
  const { theme } = useStore();
  const chartData = useMemo(() => {
    if (!analytics?.memberBreakdown) return [];
    return analytics.memberBreakdown
      .map((m: any) => ({ 
        name: m.name || 'Unknown', 
        hours: Math.round((m.totalTimeMs || 0) / 3600000 * 10) / 10 
      }))
      .sort((a: any, b: any) => b.hours - a.hours);
  }, [analytics]);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 transition-all"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-2xl font-display font-bold text-surface-50">{team?.name || 'Team Analytics'}</h1>
            <p className="text-surface-400">{team?.members?.length || 0} active members</p>
          </div>
        </div>
        <FilterSelector active={filter} onChange={setFilter} />
      </div>

      {loading ? <LoadingPlaceholder /> : analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Clock} label="Team Total Focus" value={formatHours(analytics.summary?.totalTimeMs || 0)} color={theme?.accentColor || "#0ea5e9"} />
            <StatCard icon={CheckCircle2} label="Tasks Completed" value={String(analytics.summary?.completedTasks || 0)} color="#22c55e" />
            <StatCard icon={Users} label="Team Size" value={String(analytics.summary?.activeMembers || 0)} color="#8b5cf6" />
            <StatCard icon={Zap} label="Avg Time / User" value={formatHours((analytics.summary?.totalTimeMs || 0) / (analytics.summary?.activeMembers || 1))} color="#f97316" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card p-6">
              <h2 className="text-lg font-bold text-surface-50 mb-6">Team Contribution (Hours)</h2>
              <div className="h-[300px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#27272a" />
                      <XAxis type="number" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} />
                      <YAxis dataKey="name" type="category" tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={false} width={100} />
                      <Tooltip cursor={{ fill: '#27272a', radius: 8 }} contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} />
                      <Bar dataKey="hours" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-surface-500 italic">No contribution data for this period</div>
                )}
              </div>
            </div>
            <div className="card p-6">
              <h2 className="text-lg font-bold text-surface-50 mb-4">Member Activity</h2>
              <div className="space-y-4">
                {(analytics.memberBreakdown || []).map((m: any) => (
                  <div key={m.userId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-800 flex items-center justify-center text-[10px] font-bold text-surface-50">
                        {(m.name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-surface-200">{m.name || 'Unknown User'}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-surface-50">{formatHours(m.totalTimeMs || 0)}</p>
                      <p className="text-[10px] text-surface-500 uppercase">{m.completedTasks || 0} tasks</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <div className="card p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-20 h-20 opacity-5 rounded-full -mr-6 -mt-6" style={{ background: color }} />
      <div className="flex items-center gap-3 text-surface-400 text-sm mb-3">
        <Icon size={16} style={{ color }} /> {label}
      </div>
      <div className="text-2xl font-display font-bold text-surface-50">{value}</div>
      {sub && <p className="text-[10px] text-surface-500 mt-1 uppercase tracking-wider">{sub}</p>}
    </div>
  );
}

function FilterSelector({ active, onChange }: any) {
  return (
    <div className="flex items-center gap-2 bg-surface-900 p-1 rounded-xl border border-surface-800">
      {(['today', 'week', 'month', 'all'] as FilterRange[]).map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            active === r ? 'bg-brand-500 text-white' : 'text-surface-400 hover:text-surface-50'
          }`}
        >
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
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
    </div>
  );
}
