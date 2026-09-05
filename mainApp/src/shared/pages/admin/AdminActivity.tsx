import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, Globe, Users, Edit2, ShieldCheck, UserX, UserCheck,
  Trash2, Plus, Zap, CheckCircle2, BookMarked, RefreshCw, ChevronDown, Loader2,
} from 'lucide-react';
import { api } from '@shared/utils/api';
import { PageHeader } from '@shared/components/ui/PageHeader';
import { Card } from '@shared/components/ui/Card';
import { EmptyState } from '@shared/components/ui/EmptyState';

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

function ActivityItem({ activity }: { activity: any }) {
  const meta = ACTION_LABELS[activity.action] || { label: activity.action, color: 'text-surface-400', bg: 'bg-surface-800', icon: Activity };
  const Icon = meta.icon;
  const user = activity.userId;
  const timeAgo = (() => {
    const diff = Date.now() - new Date(activity.createdAt).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  })();

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

const FILTERS = [
  { id: '', label: 'All' }, { id: 'login', label: 'Logins' }, { id: 'user', label: 'Users' },
  { id: 'team', label: 'Teams' }, { id: 'task', label: 'Tasks' }, { id: 'session', label: 'Sessions' },
  { id: 'worklog', label: 'Work Logs' },
];

export function AdminActivity() {
  const [activities, setActivities] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (reset = false) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      const cursor = reset ? undefined : nextCursor ?? undefined;
      const data = await api.admin.getActivity(50, cursor, filter || undefined);
      if (reset) setActivities(data.items);
      else setActivities(prev => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch {}
    finally { setLoading(false); setLoadingMore(false); }
  }, [filter, nextCursor]);

  useEffect(() => { load(true); }, [filter]);

  useEffect(() => {
    intervalRef.current = setInterval(() => load(true), 20000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  return (
    <div className="p-6 lg:p-8 max-w-[1500px] mx-auto space-y-5">
      <PageHeader title="Activity" description="Live organization activity feed"
        icon={<Activity size={18} className="text-purple-400" />} />

      <div className="flex items-center gap-3">
        <div className="flex gap-1 bg-surface-800/60 p-1 rounded-xl border border-surface-800 overflow-x-auto">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${filter === f.id ? 'bg-surface-700/80 text-surface-50 shadow-sm' : 'text-surface-400 hover:text-surface-200'}`}>{f.label}</button>
          ))}
        </div>
        <button onClick={() => load(true)} aria-label="Refresh activity" className="p-2 rounded-lg bg-surface-800 text-surface-400 hover:text-surface-200 transition-all">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <Card className="divide-y divide-surface-800 max-h-[600px] overflow-y-auto scrollbar-thin">
        {activities.length === 0 && !loading ? (
          <EmptyState icon={<Activity size={28} className="text-surface-600" />} title="No activity recorded yet" description="" className="!py-12" />
        ) : activities.map((a: any) => <ActivityItem key={a._id} activity={a} />)}
        {loading && activities.length === 0 && (
          <div role="status" className="p-8 text-center"><Loader2 size={20} className="text-purple-400 animate-spin mx-auto" /></div>
        )}
      </Card>
      {hasMore && (
        <button onClick={() => load(false)} disabled={loadingMore}
          className="w-full py-2.5 rounded-xl text-xs font-semibold text-surface-400 hover:text-surface-200 bg-surface-800 border border-surface-800 hover:border-surface-700 transition-all flex items-center justify-center gap-2">
          {loadingMore ? <Loader2 size={13} className="animate-spin" /> : <ChevronDown size={13} />} Load more
        </button>
      )}
    </div>
  );
}
