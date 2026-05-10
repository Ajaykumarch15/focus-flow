import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, CheckCircle2, GitBranch, ExternalLink,
  Share2, Copy, Check, ChevronLeft, ChevronRight,
  BarChart3, Zap, BookMarked, AlertTriangle, Link2,
  Loader2, TrendingUp, ArrowLeft,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval,
         isSameDay, isToday, subMonths, addMonths, parseISO } from 'date-fns';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../utils/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DaySummary {
  date: string;
  totalMs: number;
  totalHours: number;
  sessionCount: number;
  taskCount: number;
  workLogCount: number;
  completedCount: number;
}

interface DayDetail {
  date: string;
  totalMs: number;
  totalHours: number;
  tasks: {
    taskId: string; title: string; color: string;
    category: string; priority: string; totalMs: number;
    sessions: { _id: string; startTime: number; endTime: number; activeTime: number; totalPauseDuration: number }[];
  }[];
  workLogs: {
    _id: string; title: string; problem: string; gitBranch: string;
    currentWork: string; plan: string; designNotes: string; blockers: string;
    completedItems: { _id: string; text: string }[];
    links: { _id: string; label: string; url: string }[];
    status: string; mood: number; tags: string[];
  }[];
  sessionCount: number;
  workLogCount: number;
  completedCount: number;
  branches: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatMs(ms: number): string {
  if (!ms) return '0m';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const MOOD_EMOJIS = ['😔', '😐', '🙂', '😊', '🔥'];

const STATUS_COLOR: Record<string, string> = {
  planning:    'text-purple-400 bg-purple-400/10',
  'in-progress':'text-brand-400 bg-brand-400/10',
  reviewing:   'text-yellow-400 bg-yellow-400/10',
  blocked:     'text-red-400 bg-red-400/10',
  done:        'text-emerald-400 bg-emerald-400/10',
};

// ── Heatmap intensity: 0-4 based on hours worked ─────────────────────────────
function heatLevel(hours: number): number {
  if (hours === 0) return 0;
  if (hours < 2)   return 1;
  if (hours < 4)   return 2;
  if (hours < 6)   return 3;
  return 4;
}
const HEAT_STYLES = [
  'bg-surface-800',
  'bg-brand-900/60 border-brand-800',
  'bg-brand-700/50 border-brand-600',
  'bg-brand-500/60 border-brand-500',
  'bg-brand-400    border-brand-300',
];

// ── Share link button ─────────────────────────────────────────────────────────
function ShareButton({ userId, date }: { userId: string; date: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/reports/share/${userId}/${date}`;

  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 px-3 py-2 bg-surface-800 rounded-xl text-xs text-surface-300 font-mono truncate border border-surface-700">
        {url}
      </div>
      <button
        onClick={copy}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
          copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-brand-500/15 hover:bg-brand-500/25 text-brand-400'
        }`}
      >
        {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
      </button>
    </div>
  );
}

// ── Day detail panel ─────────────────────────────────────────────────────────
function DayDetailPanel({ date, onBack }: { date: string; onBack: () => void }) {
  const { user } = useAuthStore();
  const [data, setData]       = useState<DayDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.reports.day(date)
      .then(d => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [date]);

  const dateLabel = format(parseISO(date), 'EEEE, MMMM d, yyyy');

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={28} className="animate-spin text-brand-400" />
    </div>
  );

  if (!data) return (
    <div className="card p-10 text-center">
      <p className="text-surface-400">No data for this day</p>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-white transition-all">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="font-display font-bold text-white">{dateLabel}</h2>
            <p className="text-xs text-surface-400 mt-0.5">
              {data.workLogCount} work log{data.workLogCount !== 1 ? 's' : ''} · {data.sessionCount} timer session{data.sessionCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowShare(!showShare)}
          className="flex items-center gap-2 px-3 py-2 bg-surface-800 hover:bg-surface-700 rounded-xl text-sm text-surface-300 hover:text-white transition-all"
        >
          <Share2 size={14} /> Share with Lead
        </button>
      </div>

      {/* Share link */}
      <AnimatePresence>
        {showShare && user && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="card p-4 mb-5 border-brand-500/20 bg-brand-500/5"
          >
            <p className="text-xs text-brand-300 mb-2 flex items-center gap-1.5">
              <Link2 size={12} /> Share this link with your lead — no login required
            </p>
            <ShareButton userId={user._id} date={date} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { icon: Clock,       label: 'Time Worked',  value: formatMs(data.totalMs),         color: 'text-brand-400'   },
          { icon: CheckCircle2,label: 'Completed',     value: String(data.completedCount),    color: 'text-emerald-400' },
          { icon: BarChart3,   label: 'Tasks Tracked', value: String(data.tasks.length),      color: 'text-purple-400'  },
          { icon: GitBranch,   label: 'Branches',      value: String(data.branches.length),   color: 'text-yellow-400'  },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="card p-3 flex items-center gap-3">
            <Icon size={16} className={color} />
            <div>
              <p className={`text-lg font-display font-bold ${color}`}>{value}</p>
              <p className="text-xs text-surface-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Active branches */}
      {data.branches.length > 0 && (
        <div className="card p-3 mb-5 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-surface-400 font-medium">Branches:</span>
          {data.branches.map(b => (
            <span key={b} className="flex items-center gap-1 text-xs text-emerald-300 font-mono bg-emerald-400/10 px-2 py-1 rounded-lg">
              <GitBranch size={10} />{b}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Work Logs — 3 cols */}
        <div className="lg:col-span-3 space-y-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <BookMarked size={15} className="text-brand-400" /> Work Logs
          </h3>
          {data.workLogs.length === 0 ? (
            <p className="text-sm text-surface-500">No work logs for this day</p>
          ) : data.workLogs.map(log => (
            <div key={log._id} className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-medium text-white text-sm">{log.title}</span>
                <span className={`badge text-xs ${STATUS_COLOR[log.status] || 'text-surface-400 bg-surface-700'}`}>
                  {log.status}
                </span>
                <span className="text-lg ml-auto">{MOOD_EMOJIS[(log.mood || 3) - 1]}</span>
              </div>

              {log.gitBranch && (
                <div className="flex items-center gap-1.5 mb-2 text-xs text-emerald-400 font-mono">
                  <GitBranch size={11} />{log.gitBranch}
                </div>
              )}

              {log.problem && (
                <div className="mb-2">
                  <p className="text-xs text-surface-400 mb-0.5">Problem</p>
                  <p className="text-sm text-surface-200">{log.problem}</p>
                </div>
              )}

              {log.currentWork && (
                <div className="mb-2">
                  <p className="text-xs text-surface-400 mb-0.5">What I did</p>
                  <p className="text-sm text-surface-200">{log.currentWork}</p>
                </div>
              )}

              {log.completedItems.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-surface-400 mb-1">Completed</p>
                  <div className="space-y-1">
                    {log.completedItems.map(item => (
                      <div key={item._id} className="flex items-start gap-1.5 text-xs text-surface-200">
                        <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                        {item.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {log.blockers && (
                <div className="mb-2 p-2 bg-yellow-400/5 border border-yellow-400/15 rounded-lg">
                  <p className="text-xs text-yellow-400 mb-0.5 flex items-center gap-1">
                    <AlertTriangle size={10} /> Blockers
                  </p>
                  <p className="text-xs text-surface-200">{log.blockers}</p>
                </div>
              )}

              {log.plan && (
                <div className="mb-2">
                  <p className="text-xs text-surface-400 mb-0.5">Plan</p>
                  <p className="text-xs text-surface-300 whitespace-pre-wrap">{log.plan}</p>
                </div>
              )}

              {log.designNotes && (
                <div className="mb-2">
                  <p className="text-xs text-surface-400 mb-0.5">Design / Architecture</p>
                  <p className="text-xs text-surface-300 whitespace-pre-wrap">{log.designNotes}</p>
                </div>
              )}

              {log.links.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {log.links.map(l => (
                    <a key={l._id} href={l.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors">
                      <ExternalLink size={10} />{l.label}
                    </a>
                  ))}
                </div>
              )}

              {log.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {log.tags.map(t => (
                    <span key={t} className="text-xs bg-surface-700 text-surface-300 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Tasks + Time — 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Clock size={15} className="text-brand-400" /> Time by Task
          </h3>
          {data.tasks.length === 0 ? (
            <p className="text-sm text-surface-500">No time tracked for this day</p>
          ) : (
            <div className="space-y-2">
              {data.tasks.map(task => {
                const pct = data.totalMs > 0 ? (task.totalMs / data.totalMs) * 100 : 0;
                return (
                  <div key={task.taskId} className="card p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }} />
                        <span className="text-sm text-white font-medium truncate">{task.title}</span>
                      </div>
                      <span className="text-sm font-mono text-brand-400 flex-shrink-0 ml-2">{formatMs(task.totalMs)}</span>
                    </div>
                    <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden mb-1.5">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: task.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-surface-500">
                      <span>{task.category}</span>
                      <span>{task.sessions.length} session{task.sessions.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                );
              })}

              {/* Total */}
              <div className="card p-3 bg-brand-500/5 border-brand-500/20">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-white">Total time</span>
                  <span className="text-lg font-display font-bold text-brand-400">{formatMs(data.totalMs)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Calendar heatmap ──────────────────────────────────────────────────────────
function CalendarHeatmap({
  month, summary, onDayClick, selectedDate,
}: {
  month: Date;
  summary: DaySummary[];
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
          <div key={d} className="text-center text-xs text-surface-500 py-1">{d}</div>
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
          const tod  = isToday(day);

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
              <span className={`absolute inset-0 flex items-center justify-center text-xs
                ${heat >= 2 ? 'text-white' : 'text-surface-400'} ${tod ? 'font-bold' : ''}`}>
                {day.getDate()}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Reports Page ─────────────────────────────────────────────────────────
export function ReportsPage() {
  const [month, setMonth]             = useState(new Date());
  const [summary, setSummary]         = useState<DaySummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Load summary whenever month changes
  useEffect(() => {
    setLoadingSummary(true);
    const from = format(startOfMonth(month), 'yyyy-MM-dd');
    const to   = format(endOfMonth(month),   'yyyy-MM-dd');
    api.reports.summary(from, to)
      .then(data => setSummary(data))
      .catch(console.error)
      .finally(() => setLoadingSummary(false));
  }, [month]);

  // Totals for the viewed month
  const monthHours  = summary.reduce((a, d) => a + d.totalHours, 0);
  const monthDays   = summary.filter(d => d.totalHours > 0).length;
  const monthDone   = summary.reduce((a, d) => a + d.completedCount, 0);
  const avgPerDay   = monthDays > 0 ? (monthHours / monthDays).toFixed(1) : '0';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-display font-bold text-white flex items-center gap-2">
          <BarChart3 size={22} className="text-brand-400" /> Daily Reports
        </h1>
        <p className="text-surface-400 text-sm mt-1">
          Your full work history — click any day to drill in. Share a day's report with your lead.
        </p>
      </motion.div>

      {selectedDate ? (
        <DayDetailPanel date={selectedDate} onBack={() => setSelectedDate(null)} />
      ) : (
        <>
          {/* Month stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { icon: Clock,        label: `${format(month,'MMMM')} hours`, value: `${monthHours.toFixed(1)}h`, color: 'text-brand-400'   },
              { icon: TrendingUp,   label: 'Avg per work day',               value: `${avgPerDay}h`,            color: 'text-purple-400'  },
              { icon: Calendar,     label: 'Days worked',                    value: String(monthDays),          color: 'text-yellow-400'  },
              { icon: CheckCircle2, label: 'Items completed',                value: String(monthDone),          color: 'text-emerald-400' },
            ].map(({ icon: Icon, label, value, color }) => (
              <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-4">
                <p className={`text-2xl font-display font-bold ${color}`}>{value}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Icon size={12} className={color} />
                  <p className="text-xs text-surface-400">{label}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Calendar */}
          <div className="card p-5 mb-6">
            {/* Nav */}
            <div className="flex items-center justify-between mb-5">
              <button onClick={() => setMonth(m => subMonths(m, 1))}
                className="p-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-white transition-all">
                <ChevronLeft size={16} />
              </button>
              <div className="text-center">
                <h2 className="font-display font-semibold text-white">
                  {format(month, 'MMMM yyyy')}
                </h2>
                {loadingSummary && <p className="text-xs text-surface-500 mt-0.5">Loading…</p>}
              </div>
              <button onClick={() => setMonth(m => addMonths(m, 1))}
                className="p-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-white transition-all">
                <ChevronRight size={16} />
              </button>
            </div>

            <CalendarHeatmap
              month={month}
              summary={summary}
              onDayClick={setSelectedDate}
              selectedDate={selectedDate}
            />

            {/* Legend */}
            <div className="flex items-center gap-2 mt-4 justify-end">
              <span className="text-xs text-surface-500">Less</span>
              {HEAT_STYLES.map((cls, i) => (
                <div key={i} className={`w-4 h-4 rounded border ${cls}`} />
              ))}
              <span className="text-xs text-surface-500">More</span>
            </div>
          </div>

          {/* Recent active days list */}
          <div className="space-y-2">
            <h3 className="font-semibold text-white mb-3">Recent Days</h3>
            {summary
              .filter(d => d.totalHours > 0 || d.workLogCount > 0)
              .slice(0, 10)
              .map(day => (
                <motion.div
                  key={day.date}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="card p-4 flex items-center gap-4 cursor-pointer hover:border-surface-600 transition-all group"
                  onClick={() => setSelectedDate(day.date)}
                >
                  <div className="text-center w-12 flex-shrink-0">
                    <p className="text-lg font-display font-bold text-white">
                      {format(parseISO(day.date), 'd')}
                    </p>
                    <p className="text-xs text-surface-400">
                      {format(parseISO(day.date), 'EEE')}
                    </p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      {day.totalHours > 0 && (
                        <span className="flex items-center gap-1 text-sm text-brand-400 font-medium">
                          <Clock size={13} />{day.totalHours}h tracked
                        </span>
                      )}
                      {day.workLogCount > 0 && (
                        <span className="flex items-center gap-1 text-sm text-purple-400">
                          <BookMarked size={13} />{day.workLogCount} log{day.workLogCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {day.completedCount > 0 && (
                        <span className="flex items-center gap-1 text-sm text-emerald-400">
                          <CheckCircle2 size={13} />{day.completedCount} done
                        </span>
                      )}
                    </div>
                    {/* Mini bar */}
                    {day.totalHours > 0 && (
                      <div className="h-1 bg-surface-800 rounded-full mt-2 overflow-hidden w-48">
                        <div
                          className="h-full bg-brand-500 rounded-full"
                          style={{ width: `${Math.min(100, (day.totalHours / 8) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-surface-500 group-hover:text-surface-300 transition-colors">
                    <Share2 size={14} />
                    <ChevronRight size={14} />
                  </div>
                </motion.div>
              ))}

            {summary.filter(d => d.totalHours > 0 || d.workLogCount > 0).length === 0 && (
              <div className="card p-10 text-center">
                <Calendar size={32} className="text-surface-700 mx-auto mb-3" />
                <p className="text-surface-400">No work logged this month yet</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
