import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, User as UserIcon, Search, Loader2, Clock, 
  CheckCircle2, BarChart3, BookMarked, ChevronRight,
  Calendar, ArrowLeft, Filter, TrendingUp, Zap, Activity,
  Settings, Plus, Trash2, Edit2, X, Check, ShieldCheck, Mail
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  PieChart, Pie, Legend
} from 'recharts';
import { api } from '../utils/api';
import { formatHours, isToday, getWeekDays } from '../utils/time';
import { toast } from '../store/useToastStore';

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
    <div className="flex items-center justify-center h-screen">
      <Loader2 size={32} className="animate-spin text-brand-400" />
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <AnimatePresence mode="wait">
        {!selectedUser && !selectedTeam ? (
          <motion.div key="admin-main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
              <div>
                <h1 className="text-2xl font-display font-bold text-white flex items-center gap-2">
                  <ShieldCheck size={24} className="text-brand-400" /> Admin Console
                </h1>
                <p className="text-surface-400 mt-1">Manage users, teams, and track global productivity</p>
              </div>
              <div className="flex items-center gap-2 bg-surface-900 p-1 rounded-2xl border border-surface-800">
                {(['overview', 'users', 'teams'] as AdminTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setSearch(''); }}
                    className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${
                      activeTab === tab ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-surface-400 hover:text-white'
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard icon={Users} label="Total Users" value={String(stats?.totalUsers)} color="#0ea5e9" />
                  <StatCard icon={Activity} label="Active Now" value={String(stats?.activeUsers)} color="#22c55e" sub="timing focus" />
                  <StatCard icon={Clock} label="Today Focus" value={formatHours(stats?.todayTotalMs || 0)} color="#8b5cf6" />
                  <StatCard icon={BarChart3} label="Today Sessions" value={String(stats?.todaySessionCount)} color="#f97316" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Top Teams Preview */}
                  <div className="card p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="font-display font-bold text-white flex items-center gap-2">
                        <Users size={18} className="text-brand-400" /> Active Teams
                      </h2>
                      <button onClick={() => setActiveTab('teams')} className="text-xs text-brand-400 hover:underline">View All</button>
                    </div>
                    <div className="space-y-4">
                      {teams.slice(0, 5).map(team => (
                        <div key={team._id} className="p-4 bg-surface-900/50 rounded-2xl border border-surface-800 flex items-center justify-between">
                          <div>
                            <h3 className="text-white font-semibold">{team.name}</h3>
                            <p className="text-xs text-surface-500">{team.members.length} members</p>
                          </div>
                          <div className="flex -space-x-2">
                            {team.members.slice(0, 4).map(m => (
                              <div key={m._id} className="w-8 h-8 rounded-full bg-surface-700 border-2 border-surface-950 flex items-center justify-center text-[10px] font-bold text-white">
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
                      <h2 className="font-display font-bold text-white flex items-center gap-2">
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
                            <p className="text-sm font-medium text-white truncate">{u.name}</p>
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
                          <h3 className="text-white font-semibold truncate">{u.name}</h3>
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
                              className="p-2 rounded-lg hover:bg-surface-800 text-surface-400 hover:text-white transition-all"
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
                        <h3 className="text-xl font-bold text-white mb-2">{t.name}</h3>
                        <p className="text-sm text-surface-400 mb-6 line-clamp-2">{t.description || 'No description'}</p>
                      </div>
                      
                      <div className="flex items-center justify-between pt-6 border-t border-surface-800">
                        <div className="flex -space-x-2">
                          {t.members.slice(0, 3).map(m => (
                            <div key={m._id} className="w-8 h-8 rounded-full bg-surface-800 border-2 border-surface-950 flex items-center justify-center text-[10px] font-bold text-white">
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
              <h2 className="text-2xl font-display font-bold text-white mb-6">
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
                            <p className="text-sm font-medium text-white">{u.name}</p>
                            <p className="text-xs text-surface-500">{u.email}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-8">
                <button onClick={() => setShowTeamModal(false)} className="px-6 py-2.5 text-sm font-medium text-surface-400 hover:text-white transition-colors">Cancel</button>
                <button onClick={handleSaveTeam} className="btn-primary px-8">{editingTeam ? 'Update Team' : 'Create Team'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserDetailView({ user, analytics, loading, filter, setFilter, onBack }: any) {
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
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 transition-all"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-2xl font-display font-bold text-white">{user.name}</h1>
            <p className="text-surface-400">{user.email}</p>
          </div>
        </div>
        <FilterSelector active={filter} onChange={setFilter} />
      </div>

      {loading ? <LoadingPlaceholder /> : analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Clock} label="Focus Time" value={formatHours(analytics.summary.totalTimeMs)} color="#0ea5e9" />
            <StatCard icon={CheckCircle2} label="Tasks Done" value={String(analytics.summary.completedTasks)} color="#22c55e" />
            <StatCard icon={BookMarked} label="Work Logs" value={String(analytics.summary.workLogCount)} color="#8b5cf6" />
            <StatCard icon={BarChart3} label="Sessions" value={String(analytics.summary.sessionCount)} color="#f97316" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card p-6">
              <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><TrendingUp size={18} className="text-brand-400" /> Daily Focus</h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                    <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: '#27272a', radius: 8 }} contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }} />
                    <Bar dataKey="hours" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card p-6">
              <h2 className="text-lg font-bold text-white mb-4">Top Tasks</h2>
              <div className="space-y-3">
                {analytics.tasks.slice(0, 6).map((t: any) => (
                  <div key={t._id} className="p-3 bg-surface-900/50 rounded-xl border border-surface-800">
                    <p className="text-white text-sm font-medium truncate">{t.title}</p>
                    <p className="text-[10px] text-surface-500 uppercase mt-1">{t.category} · {formatHours(t.totalTime)}</p>
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

function TeamDetailView({ team, analytics, loading, filter, setFilter, onBack }: any) {
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
            <h1 className="text-2xl font-display font-bold text-white">{team?.name || 'Team Analytics'}</h1>
            <p className="text-surface-400">{team?.members?.length || 0} active members</p>
          </div>
        </div>
        <FilterSelector active={filter} onChange={setFilter} />
      </div>

      {loading ? <LoadingPlaceholder /> : analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Clock} label="Team Total Focus" value={formatHours(analytics.summary?.totalTimeMs || 0)} color="#0ea5e9" />
            <StatCard icon={CheckCircle2} label="Tasks Completed" value={String(analytics.summary?.completedTasks || 0)} color="#22c55e" />
            <StatCard icon={Users} label="Team Size" value={String(analytics.summary?.activeMembers || 0)} color="#8b5cf6" />
            <StatCard icon={Zap} label="Avg Time / User" value={formatHours((analytics.summary?.totalTimeMs || 0) / (analytics.summary?.activeMembers || 1))} color="#f97316" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card p-6">
              <h2 className="text-lg font-bold text-white mb-6">Team Contribution (Hours)</h2>
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
              <h2 className="text-lg font-bold text-white mb-4">Member Activity</h2>
              <div className="space-y-4">
                {(analytics.memberBreakdown || []).map((m: any) => (
                  <div key={m.userId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-800 flex items-center justify-center text-[10px] font-bold text-white">
                        {(m.name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-surface-200">{m.name || 'Unknown User'}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">{formatHours(m.totalTimeMs || 0)}</p>
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
      <div className="text-2xl font-display font-bold text-white">{value}</div>
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
            active === r ? 'bg-brand-500 text-white' : 'text-surface-400 hover:text-white'
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
      <Loader2 size={32} className="animate-spin text-brand-400" />
      <p className="text-surface-400">Loading data...</p>
    </div>
  );
}
