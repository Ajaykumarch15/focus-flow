import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, Target, CheckCircle2, Map, Clock,
  ChevronRight, Calendar, Flame, BarChart3, AlertTriangle,
} from 'lucide-react';
import { api } from '../utils/api';
import { Card, CardBody } from '../components/ui/Card';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import { Progress } from '../components/ui/Progress';

const formatFocusedTime = (ms: number): string => {
  if (!ms || ms <= 0) return '0m';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const TIME_FILTERS = [
  { label: '7 Days', value: 7 },
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
  { label: 'All Time', value: 0 },
] as const;

const STATUS_BADGE: Record<string, BadgeTone> = {
  active: 'brand',
  planning: 'neutral',
  completed: 'success',
  paused: 'warning',
  archived: 'neutral',
};

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

interface AnalyticsOverview {
  progress: number;
  activeRoadmaps: number;
  completedMilestones: number;
  totalMilestones: number;
  completedTasks: number;
  totalTasks: number;
  focusedTimeMs: number;
}

interface RoadmapStat {
  _id: string;
  title: string;
  description: string;
  status: string;
  color: string;
  icon: string;
  targetDate?: string;
  progress: number;
  phaseTotal: number;
  phaseCompleted: number;
  milestoneTotal: number;
  milestoneCompleted: number;
  taskTotal: number;
  taskCompleted: number;
  focusedTimeMs?: number;
}

interface PhaseStat {
  _id: string;
  title: string;
  status: string;
  order: number;
  roadmapId: string;
  roadmapTitle: string;
  progress: number;
  milestoneTotal: number;
  milestoneCompleted: number;
}

interface ActivityData {
  activeDays: number;
  completedMilestones: number;
  completedTasks: number;
}

interface TodayData {
  tasksCompleted: number;
  milestonesCompleted: number;
  activeRoadmaps: number;
}

interface RecentItem {
  type: 'task' | 'milestone';
  title: string;
  date: string;
  roadmapId: string;
}

interface AnalyticsResponse {
  overview: AnalyticsOverview;
  today: TodayData;
  roadmaps: RoadmapStat[];
  phases: PhaseStat[];
  activity: ActivityData;
  recentActivity: RecentItem[];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="text-surface-400 mb-0.5">{label}</p>
      <p className="text-surface-50 font-semibold">{payload[0].value}%</p>
    </div>
  );
}

export function PersonalAnalyticsPage() {
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setLoading(true);
    setError(null);
    api.personalRoadmaps.analytics(days)
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e?.message || 'Failed to load analytics'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [days]);

  const overview = data?.overview;
  const today = data?.today;
  const roadmaps = data?.roadmaps || [];
  const phases = data?.phases || [];
  const activity = data?.activity;
  const recentActivity = data?.recentActivity || [];

  // Build simple progress-over-time data from roadmap target/completion dates
  const chartData = useMemo(() => {
    if (!roadmaps.length) return [];
    // Use each roadmap's progress as a snapshot point
    // Since we don't have historical data, we show a simple bar of current progress per roadmap
    return roadmaps.map(r => ({
      name: r.title.length > 16 ? r.title.slice(0, 16) + '…' : r.title,
      progress: r.progress,
    }));
  }, [roadmaps]);

  if (loading && !data) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1100px] mx-auto space-y-6">
        <div className="space-y-2">
          <div className="h-7 w-56 bg-surface-800 rounded animate-pulse" />
          <div className="h-4 w-80 bg-surface-800 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-surface-800 rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-64 bg-surface-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1100px] mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-display font-extrabold text-surface-50">Personal Analytics</h1>
        <p className="text-sm text-surface-400">Understand your progress, consistency, and growth across your personal roadmaps.</p>
      </motion.div>

      {/* Time Filter */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
        className="flex items-center gap-1.5">
        {TIME_FILTERS.map(f => (
          <button key={f.value} onClick={() => setDays(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              days === f.value
                ? 'bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/30'
                : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'
            }`}>
            {f.label}
          </button>
        ))}
      </motion.div>

      {/* Section 1 — Overview */}
      {overview && (
        <motion.div variants={stagger} initial="hidden" animate="show"
          className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Overall Progress', value: `${overview.progress}%`, icon: TrendingUp, color: 'text-brand-400' },
            { label: 'Active Roadmaps', value: overview.activeRoadmaps, icon: Map, color: 'text-sky-400' },
            { label: 'Milestones', value: `${overview.completedMilestones}/${overview.totalMilestones}`, icon: Target, color: 'text-violet-400' },
            { label: 'Tasks', value: `${overview.completedTasks}/${overview.totalTasks}`, icon: CheckCircle2, color: 'text-emerald-400' },
            { label: 'Focused Time', value: formatFocusedTime(overview.focusedTimeMs ?? 0), icon: Clock, color: 'text-amber-400' },
          ].map((m) => (
            <motion.div key={m.label} variants={fadeUp}>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-surface-800 ${m.color}`}>
                    <m.icon size={17} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-surface-400 font-medium uppercase tracking-wider">{m.label}</p>
                    <p className="text-lg font-bold text-surface-50 leading-tight">{m.value}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Today */}
      {today && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Today</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Tasks Done', value: today.tasksCompleted, icon: CheckCircle2, color: 'text-emerald-400' },
              { label: 'Milestones Done', value: today.milestonesCompleted, icon: Target, color: 'text-violet-400' },
              { label: 'Active Roadmaps', value: today.activeRoadmaps, icon: Map, color: 'text-sky-400' },
            ].map((c) => (
              <Card key={c.label} className="p-4 text-center">
                <c.icon size={18} className={`mx-auto mb-1.5 ${c.color}`} />
                <p className="text-lg font-bold text-surface-50">{c.value}</p>
                <p className="text-[11px] text-surface-400 font-medium">{c.label}</p>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* Section 2 — Roadmap Progress */}
      {roadmaps.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Roadmap Progress</h2>
          <div className="space-y-2">
            {roadmaps.map((r, idx) => (
              <motion.div key={r._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + idx * 0.04 }}>
                <button onClick={() => navigate(`/roadmaps/${r._id}`)}
                  className="w-full text-left rounded-2xl border border-surface-800 bg-surface-900/80 p-4 hover:border-surface-700 hover:bg-surface-800/50 transition-all group">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
                      style={{ backgroundColor: `${r.color}18`, color: r.color }}>
                      <Map size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-surface-50 truncate">{r.title}</p>
                        <Badge tone={STATUS_BADGE[r.status] || 'neutral'} className="text-[10px]">{r.status}</Badge>
                      </div>
                      {r.description && (
                        <p className="text-xs text-surface-500 truncate mb-2">{r.description}</p>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <Progress value={r.progress} className="flex-1 max-w-[200px] h-1.5" />
                        <span className="text-xs font-semibold text-surface-300">{r.progress}%</span>
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-surface-500">
                        <span>Phases {r.phaseCompleted}/{r.phaseTotal}</span>
                        <span>Milestones {r.milestoneCompleted}/{r.milestoneTotal}</span>
                        <span>Tasks {r.taskCompleted}/{r.taskTotal}</span>
                        {r.targetDate && (
                          <span className="flex items-center gap-1">
                            <Calendar size={10} />
                            {formatDate(r.targetDate)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-surface-600 group-hover:text-surface-300 transition-colors mt-1 flex-shrink-0" />
                  </div>
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Section 3 — Progress Overview Chart */}
      {chartData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Progress by Roadmap</h2>
          <Card>
            <CardBody className="pt-4 pb-2">
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="progressGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false}
                      tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="progress" stroke="#0ea5e9" strokeWidth={2}
                      fill="url(#progressGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Empty chart state */}
      {chartData.length === 0 && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Progress Overview</h2>
          <Card>
            <CardBody className="py-10 text-center">
              <BarChart3 className="mx-auto mb-2 text-surface-600" size={28} />
              <p className="text-sm text-surface-400 font-medium">No progress data yet</p>
              <p className="text-xs text-surface-500 mt-1">Create roadmaps and complete milestones to see progress.</p>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Section 4 — Phase Progress */}
      {phases.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Phase Progress</h2>
          <Card>
            <CardBody className="space-y-3 py-4">
              {phases.slice(0, 12).map((p, idx) => (
                <motion.div key={p._id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.27 + idx * 0.03 }}>
                  <button onClick={() => navigate(`/roadmaps/${p.roadmapId}/phases/${p._id}`)}
                    className="w-full text-left group">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] text-surface-500 font-mono w-5">
                            {String(p.order + 1).padStart(2, '0')}
                          </span>
                          <p className="text-sm text-surface-200 truncate group-hover:text-surface-50 transition-colors">{p.title}</p>
                          {p.roadmapTitle && (
                            <span className="text-[10px] text-surface-600 hidden sm:inline">in {p.roadmapTitle}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-7">
                          <Progress value={p.progress} className="flex-1 h-1.5" />
                          <span className="text-[11px] font-medium text-surface-400 w-8 text-right">{p.progress}%</span>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-surface-600 group-hover:text-surface-300 transition-colors flex-shrink-0" />
                    </div>
                  </button>
                </motion.div>
              ))}
              {phases.length > 12 && (
                <p className="text-[11px] text-surface-500 text-center pt-1">+{phases.length - 12} more phases</p>
              )}
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Section 5 — Consistency */}
      {activity && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Consistency</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Active Days', value: activity.activeDays, icon: Flame, color: 'text-orange-400' },
              { label: 'Milestones Done', value: activity.completedMilestones, icon: Target, color: 'text-violet-400' },
              { label: 'Tasks Done', value: activity.completedTasks, icon: CheckCircle2, color: 'text-emerald-400' },
            ].map((c) => (
              <Card key={c.label} className="p-4 text-center">
                <c.icon size={18} className={`mx-auto mb-1.5 ${c.color}`} />
                <p className="text-lg font-bold text-surface-50">{c.value}</p>
                <p className="text-[11px] text-surface-400 font-medium">{c.label}</p>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* Section 6 — Recent Personal Progress */}
      {recentActivity.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Recent Progress</h2>
          <Card>
            <CardBody className="py-3 divide-y divide-surface-800/60">
              {recentActivity.slice(0, 10).map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    item.type === 'milestone' ? 'bg-violet-500/15 text-violet-400' : 'bg-emerald-500/15 text-emerald-400'
                  }`}>
                    {item.type === 'milestone' ? <Target size={12} /> : <CheckCircle2 size={12} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-surface-200 truncate">
                      <span className="text-surface-500">
                        {item.type === 'milestone' ? 'Completed milestone' : 'Completed'}
                      </span>{' '}
                      "{item.title}"
                    </p>
                  </div>
                  <span className="text-[11px] text-surface-500 flex-shrink-0">{formatDate(item.date)}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto mb-3 text-amber-400" size={32} />
          <p className="text-sm text-surface-300 font-medium mb-1">Failed to load analytics</p>
          <p className="text-xs text-surface-500 mb-4">{error}</p>
          <button onClick={() => setDays(d => d)}
            className="px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* Empty state when no data at all */}
      {!loading && !error && roadmaps.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
          <Map className="mx-auto mb-3 text-surface-600" size={32} />
          <p className="text-sm text-surface-300 font-medium mb-1">No personal roadmaps yet</p>
          <p className="text-xs text-surface-500 mb-4">Create your first roadmap to start tracking your personal growth.</p>
          <button onClick={() => navigate('/roadmaps')}
            className="px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors">
            Go to Roadmaps
          </button>
        </motion.div>
      )}
    </div>
  );
}
