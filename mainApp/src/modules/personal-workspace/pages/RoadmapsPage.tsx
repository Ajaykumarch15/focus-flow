import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Map, Plus, Calendar, Target, Clock, ArrowRight, Zap,
  GraduationCap, Rocket, Trophy, BookOpen, Code, Briefcase,
  Lightbulb, Brain, Palette, Globe, Heart, Star, Award,
  AlertCircle, Search, X, FileText, FileJson,
} from 'lucide-react';
import { useRoadmapStore } from '@personal/services/useRoadmapStore';
import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { Badge } from '@shared/components/ui/Badge';
import { Input } from '@shared/components/ui/Input';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { formatMs } from '@shared/utils/time';
import {
  ROADMAP_TYPE_LABELS,
  ROADMAP_STATUS_LABELS,
} from '../types/roadmap';
import { CreateRoadmapModal } from '@personal/components/roadmap/CreateRoadmapModal';
import { safeProgress, getListHealth } from '@personal/services/roadmapProgress';

const ICON_MAP: Record<string, any> = {
  Map, GraduationCap, Rocket, Target, Trophy, BookOpen,
  Code, Briefcase, Lightbulb, Brain, Palette, Globe,
  Heart, Star, Zap, Award,
};

function SkeletonCard() {
  return (
    <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-800 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-4 w-32 bg-surface-800 rounded animate-pulse" />
            <div className="h-3 w-20 bg-surface-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-5 w-16 bg-surface-800 rounded-full animate-pulse" />
      </div>
      <div className="h-1.5 w-full bg-surface-800 rounded-full animate-pulse" />
      <div className="flex gap-3">
        <div className="h-3 w-24 bg-surface-800 rounded animate-pulse" />
        <div className="h-3 w-16 bg-surface-800 rounded animate-pulse" />
      </div>
    </div>
  );
}

export function RoadmapsPage() {
  const navigate = useNavigate();
  const { roadmaps, loading, error, loadRoadmaps } = useRoadmapStore();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'progress' | 'target'>('newest');

  useEffect(() => { loadRoadmaps(); }, [loadRoadmaps]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadRoadmaps();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadRoadmaps]);

  const filteredRoadmaps = useMemo(() => {
    let result = [...roadmaps];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r => r.title.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q));
    }
    if (typeFilter !== 'all') result = result.filter(r => r.type === typeFilter);
    if (statusFilter !== 'all') result = result.filter(r => r.status === statusFilter);
    if (sortBy === 'progress') result.sort((a, b) => (b.progress || 0) - (a.progress || 0));
    else if (sortBy === 'target') result.sort((a, b) => (a.targetDate || '9999').localeCompare(b.targetDate || '9999'));
    else result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }, [roadmaps, search, typeFilter, statusFilter, sortBy]);

  const stats = useMemo(() => {
    const total = roadmaps.length;
    let onTrack = 0, atRisk = 0, behind = 0;
    for (const r of roadmaps) {
      const health = getListHealth(r);
      if (health.tone === 'success') onTrack++;
      else if (health.tone === 'warning') atRisk++;
      else if (health.tone === 'danger') behind++;
    }
    return { total, onTrack, atRisk, behind };
  }, [roadmaps]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5 sm:space-y-6">
      {/* Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-3xl min-h-[220px] sm:min-h-[260px]"
      >
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/SVG/roadmap-mountain.svg)' }}
        />
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/85 via-white/60 to-transparent" />

        <div className="relative z-10 p-6 sm:p-8 lg:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 min-h-[220px] sm:min-h-[260px]">
          {/* Left: Text content */}
          <div className="flex-1 max-w-md">
            <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-2">Roadmaps</p>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-800 leading-tight">
              Your Journey,<br />Your Way
            </h1>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Plan your long-term goals and turn them into focused execution.
            </p>
            {/* Quote pill */}
            <div className="mt-4 p-3 rounded-xl bg-white/70 backdrop-blur-sm border border-slate-200/80 max-w-sm">
              <p className="text-xs text-slate-700 italic leading-relaxed">
                "A goal without a plan is just a wish."
              </p>
              <p className="text-[10px] text-slate-500 mt-1">— Antoine de Saint-Exupéry</p>
            </div>
          </div>

          {/* Right: Person illustration */}
          <div className="hidden sm:block flex-shrink-0 w-44 h-44 lg:w-52 lg:h-52">
            <img src="/SVG/roadmap.png" alt="" className="w-full h-full object-contain drop-shadow-md" />
          </div>
        </div>

        {/* Handwritten decoration */}
        <div className="absolute top-5 right-5 sm:top-7 sm:right-7 lg:top-8 lg:right-10 text-right pointer-events-none">
          <p className="text-sm text-blue-600/80 font-medium italic" style={{ transform: 'rotate(2deg)' }}>
            "Small steps<br />lead to big<br />achievements!"
          </p>
        </div>
      </motion.div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <Card className="p-8 text-center">
          <AlertCircle className="mx-auto mb-3 text-red-400" size={32} />
          <p className="text-surface-300 font-medium mb-1">Failed to load roadmaps</p>
          <p className="text-surface-500 text-sm mb-4">{error}</p>
          <Button variant="secondary" onClick={loadRoadmaps}>Retry</Button>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !error && roadmaps.length === 0 && (
        <EmptyState
          illustration="/SVG/roadmap-mountain.svg"
          title="No roadmaps yet"
          description="Turn a long-term goal into focused execution. Create your first roadmap to get started."
          action={
            <div className="flex gap-3">
              <Button onClick={() => setShowCreate(true)} leftIcon={<Plus size={16} />}>
                Create Roadmap
              </Button>
              <Button variant="secondary" onClick={() => navigate('/personal/roadmaps/import')} leftIcon={<FileJson size={16} />}>
                Import from JSON
              </Button>
            </div>
          }
        />
      )}

      {/* Search + Filters */}
      {!loading && !error && roadmaps.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search roadmaps..."
              className="pl-9 h-9 text-xs"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300">
                <X size={12} />
              </button>
            )}
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="h-9 px-2.5 rounded-lg bg-surface-900 border border-surface-700 text-xs text-surface-300 outline-none focus:border-brand-500/50">
            <option value="all">All Types</option>
            {Object.entries(ROADMAP_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="h-9 px-2.5 rounded-lg bg-surface-900 border border-surface-700 text-xs text-surface-300 outline-none focus:border-brand-500/50">
            <option value="all">All Status</option>
            {Object.entries(ROADMAP_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="h-9 px-2.5 rounded-lg bg-surface-900 border border-surface-700 text-xs text-surface-300 outline-none focus:border-brand-500/50">
            <option value="newest">Newest First</option>
            <option value="progress">Progress</option>
            <option value="target">Target Date</option>
          </select>
          <Button onClick={() => setShowCreate(true)} leftIcon={<Plus size={14} />} className="sm:ml-auto">
            Create Roadmap
          </Button>
          <Button variant="secondary" onClick={() => navigate('/personal/roadmaps/import')} leftIcon={<FileJson size={14} />}>
            Import from JSON
          </Button>
        </motion.div>
      )}

      {/* KPI Cards */}
      {!loading && !error && roadmaps.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Roadmaps', value: stats.total, icon: <FileText size={18} />, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
            { label: 'On Track', value: stats.onTrack, icon: <Target size={18} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
            { label: 'At Risk', value: stats.atRisk, icon: <AlertCircle size={18} />, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
            { label: 'Behind', value: stats.behind, icon: <Clock size={18} />, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
          ].map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className={`flex items-center gap-3 p-4 rounded-2xl bg-surface-900 border border-surface-800 hover:border-surface-700 transition-colors`}
            >
              <div className={`w-10 h-10 rounded-xl ${kpi.bg} ${kpi.border} border flex items-center justify-center ${kpi.color}`}>
                {kpi.icon}
              </div>
              <div>
                <p className="text-2xl font-bold text-surface-50">{kpi.value}</p>
                <p className="text-[11px] text-surface-400">{kpi.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Roadmap Grid */}
      {!loading && !error && filteredRoadmaps.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredRoadmaps.map((roadmap, i) => {
              const Icon = ICON_MAP[roadmap.icon] || Map;
              const health = getListHealth(roadmap);
              const progress = safeProgress(roadmap.progress);

              return (
                <motion.div
                  key={roadmap._id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                >
                  <Card
                    className="p-5 cursor-pointer group hover:border-surface-700 transition-all duration-200 hover:shadow-lg hover:shadow-black/10"
                    onClick={() => navigate(`/personal/roadmaps/${roadmap._id}`)}
                    role="link"
                    aria-label={`${roadmap.title} roadmap, ${progress}% complete`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                          style={{ backgroundColor: `${roadmap.color}15`, color: roadmap.color }}
                        >
                          <Icon size={20} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-display font-bold text-surface-50 truncate text-sm">
                            {roadmap.title}
                          </h3>
                          <p className="text-xs text-surface-400 truncate">
                            {ROADMAP_TYPE_LABELS[roadmap.type]}
                          </p>
                        </div>
                      </div>
                      <Badge tone={health.tone}>
                        {health.label}
                      </Badge>
                    </div>

                    {roadmap.description && (
                      <p className="text-xs text-surface-400 line-clamp-2 mb-3">
                        {roadmap.description}
                      </p>
                    )}

                    {/* Progress bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-surface-300">{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: roadmap.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 text-xs text-surface-400">
                      <span className="flex items-center gap-1">
                        <Target size={12} />
                        {roadmap.milestoneCompleted}/{roadmap.milestoneTotal} milestones
                      </span>
                      {roadmap.totalTime > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {formatMs(roadmap.totalTime)}
                        </span>
                      )}
                      {roadmap.targetDate && (
                        <span className="flex items-center gap-1 ml-auto">
                          <Calendar size={12} />
                          {new Date(roadmap.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </div>

                    {/* Continue button */}
                    {roadmap.status !== 'completed' && roadmap.status !== 'archived' && (
                      <div className="mt-3 pt-3 border-t border-surface-800/50">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/personal/roadmaps/${roadmap._id}`);
                          }}
                          rightIcon={<ArrowRight size={14} />}
                        >
                          Continue
                        </Button>
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}

            {/* Create new roadmap card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: filteredRoadmaps.length * 0.03 }}
            >
              <button
                onClick={() => setShowCreate(true)}
                className="w-full h-full min-h-[200px] rounded-2xl border-2 border-dashed border-surface-700 hover:border-brand-500/50 bg-surface-900/50 hover:bg-surface-900 transition-all duration-200 flex flex-col items-center justify-center gap-3 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-surface-800 group-hover:bg-brand-500/10 flex items-center justify-center transition-colors">
                  <Plus size={24} className="text-surface-500 group-hover:text-brand-400 transition-colors" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-surface-300 group-hover:text-surface-100 transition-colors">Create a new roadmap</p>
                  <p className="text-xs text-surface-500 mt-1">Turn your goals into a clear step-by-step plan.</p>
                </div>
              </button>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Filtered empty state */}
      {!loading && !error && roadmaps.length > 0 && filteredRoadmaps.length === 0 && (
        <Card className="p-8 text-center">
          <Search className="mx-auto mb-3 text-surface-600" size={28} />
          <p className="text-sm text-surface-300 font-medium mb-1">No roadmaps match your filters</p>
          <p className="text-xs text-surface-500 mb-3">Try adjusting your search or filter criteria.</p>
          <Button variant="secondary" size="sm" onClick={() => { setSearch(''); setTypeFilter('all'); setStatusFilter('all'); }}>
            Clear Filters
          </Button>
        </Card>
      )}

      {showCreate && <CreateRoadmapModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}