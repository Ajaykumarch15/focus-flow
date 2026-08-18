import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Map, Calendar, CheckCircle2,
  ChevronRight, Zap, AlertCircle, Target,
  GraduationCap, Rocket, Trophy, BookOpen, Code, Briefcase,
  Lightbulb, Brain, Palette, Globe, Heart, Star, Award, Info,
} from 'lucide-react';
import { useRoadmapStore } from '../store/useRoadmapStore';
import { Card } from '../components/ui/Card';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import {
  ROADMAP_TYPE_LABELS,
  ROADMAP_STATUS_LABELS,
  ROADMAP_STATUS_COLORS,
} from '../types/roadmap';

const ICON_MAP: Record<string, any> = {
  Map, GraduationCap, Rocket, Target, Trophy, BookOpen,
  Code, Briefcase, Lightbulb, Brain, Palette, Globe,
  Heart, Star, Zap, Award,
};

function safeProgress(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(100, Math.round(n));
}

function getHealth(progress: number, targetDate?: string, startDate?: string, createdAt?: string) {
  if (progress === 100) return { label: 'Completed', color: 'text-emerald-400', className: 'bg-emerald-500/10 border-emerald-500/20', description: 'All milestones are complete.' };
  if (!targetDate || progress === 0) return { label: 'On Track', color: 'text-emerald-400', className: 'bg-emerald-500/10 border-emerald-500/20', description: 'Your current progress is sufficient to reach the target date.' };

  const now = Date.now();
  const target = new Date(targetDate).getTime();
  const startMs = new Date(startDate || createdAt || new Date(0).toISOString()).getTime();
  const totalMs = target - startMs;
  if (totalMs <= 0) return { label: 'Behind', color: 'text-red-400', className: 'bg-red-500/10 border-red-500/20', description: 'The target date has passed.' };

  const elapsed = now - startMs;
  const expectedProgress = Math.min(100, (elapsed / totalMs) * 100);

  if (progress >= expectedProgress - 10) return { label: 'On Track', color: 'text-emerald-400', className: 'bg-emerald-500/10 border-emerald-500/20', description: 'Your current progress is sufficient to reach the target date.' };
  if (progress >= expectedProgress - 25) return { label: 'At Risk', color: 'text-yellow-400', className: 'bg-yellow-500/10 border-yellow-500/20', description: 'You\'re slightly behind schedule.' };
  return { label: 'Behind', color: 'text-red-400', className: 'bg-red-500/10 border-red-500/20', description: 'You\'re behind schedule.' };
}

const STATUS_COLORS: Record<string, BadgeTone> = {
  upcoming: 'neutral',
  active: 'brand',
  completed: 'success',
  paused: 'warning',
};

export function RoadmapDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeRoadmap, detailLoading, error, getRoadmap, clearActiveRoadmap } = useRoadmapStore();

  const [showHealthDetail, setShowHealthDetail] = useState(false);

  useEffect(() => {
    if (id) getRoadmap(id);
    return () => clearActiveRoadmap();
  }, [id, getRoadmap, clearActiveRoadmap]);

  const roadmap = activeRoadmap;

  const health = useMemo(() => {
    if (!roadmap) return null;
    return getHealth(roadmap.progress, roadmap.targetDate, roadmap.startDate, roadmap.createdAt);
  }, [roadmap?.progress, roadmap?.targetDate, roadmap?.startDate, roadmap?.createdAt]);

  const sortedPhases = useMemo(() => {
    if (!roadmap) return [];
    return [...roadmap.phases].sort((a, b) => a.order - b.order);
  }, [roadmap?.phases]);

  if (detailLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-[900px] mx-auto space-y-6">
        <div className="h-4 w-32 bg-surface-800 rounded animate-pulse" />
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-surface-800 animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-7 w-64 bg-surface-800 rounded animate-pulse" />
            <div className="h-4 w-48 bg-surface-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-20 bg-surface-800 rounded-[22px] animate-pulse" />
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-surface-800 rounded-[22px] animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 lg:p-8 max-w-[900px] mx-auto">
        <Card className="p-8 text-center">
          <AlertCircle className="mx-auto mb-3 text-red-400" size={32} />
          <p className="text-surface-300 mb-1 font-medium">Something went wrong</p>
          <p className="text-surface-500 text-sm mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/roadmaps')} className="px-4 py-2 rounded-xl bg-surface-800 text-surface-200 text-sm font-medium hover:bg-surface-700 transition-colors">Back to Roadmaps</button>
            <button onClick={() => id && getRoadmap(id)} className="px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors">Retry</button>
          </div>
        </Card>
      </div>
    );
  }

  if (!roadmap) return null;

  const Icon = ICON_MAP[roadmap.icon] || Map;
  const statusTone: BadgeTone = (ROADMAP_STATUS_COLORS[roadmap.status] || 'neutral') as BadgeTone;
  const progress = safeProgress(roadmap.progress);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[900px] mx-auto space-y-4">
      {/* Back */}
      <motion.button
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate('/roadmaps')}
        className="flex items-center gap-2 text-sm text-surface-400 hover:text-surface-200 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Roadmaps
      </motion.button>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-start gap-4"
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${roadmap.color}15`, color: roadmap.color }}
        >
          <Icon size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-display font-extrabold text-surface-50 truncate">{roadmap.title}</h1>
          {roadmap.description && (
            <p className="text-sm text-surface-400 mt-1 line-clamp-2">{roadmap.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge tone={statusTone}>{ROADMAP_STATUS_LABELS[roadmap.status]}</Badge>
            <span className="text-xs text-surface-400">{ROADMAP_TYPE_LABELS[roadmap.type]}</span>
            {roadmap.targetDate && (
              <span className="text-xs text-surface-400 flex items-center gap-1">
                <Calendar size={11} />
                Target: {new Date(roadmap.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Overall Progress */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.05 }}
      >
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-surface-200">Overall Progress</span>
              {health && (
                <button
                  onClick={() => setShowHealthDetail(!showHealthDetail)}
                  className={`text-xs font-medium px-2 py-0.5 rounded-full border cursor-pointer transition-all ${health.className} ${health.color}`}
                >
                  {health.label}
                </button>
              )}
            </div>
            <span className="text-sm font-bold text-surface-50">{progress}%</span>
          </div>
          <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: roadmap.color }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <AnimatePresence>
            {showHealthDetail && health && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <p className="text-xs text-surface-400 mt-2 flex items-center gap-1.5">
                  <Info size={12} className="flex-shrink-0" />
                  {health.description}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>

      {/* Phases */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.1 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-surface-400">Phases</h2>
          {sortedPhases.length > 0 && (
            <span className="text-xs text-surface-500">{sortedPhases.length} phase{sortedPhases.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {sortedPhases.length === 0 ? (
          <Card className="p-8 text-center">
            <Map className="mx-auto mb-3 text-surface-500" size={28} />
            <p className="text-sm text-surface-300 mb-1 font-medium">No phases yet</p>
            <p className="text-xs text-surface-500">Break your roadmap into phases to track progress.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {sortedPhases.map((phase, idx) => {
              const phaseProgress = safeProgress(phase.progress);
              const isActive = phase.status === 'active';
              const isCompleted = phase.status === 'completed';

              return (
                <motion.div
                  key={phase._id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <button
                    onClick={() => navigate(`/roadmaps/${roadmap._id}/phases/${phase._id}`)}
                    className={`w-full text-left rounded-2xl border bg-surface-900/90 p-4 transition-all duration-200 hover:border-surface-700 hover:bg-surface-800/50 group ${
                      isActive ? 'border-brand-500/30 ring-1 ring-brand-500/10' : 'border-surface-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                        isCompleted ? 'bg-emerald-500/20 text-emerald-400' :
                        isActive ? 'bg-brand-500/20 text-brand-400' :
                        'bg-surface-800 text-surface-400'
                      }`}>
                        {isCompleted ? <CheckCircle2 size={18} /> : String(idx + 1).padStart(2, '0')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-surface-50 truncate">{phase.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-surface-800 rounded-full overflow-hidden max-w-[140px]">
                            <div
                              className="h-full rounded-full bg-brand-500/70 transition-all duration-300"
                              style={{ width: `${phaseProgress}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-medium text-surface-300">{phaseProgress}%</span>
                          <span className="text-[11px] text-surface-500">{phase.milestoneCompleted}/{phase.milestoneTotal} milestones</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge tone={STATUS_COLORS[phase.status] || 'neutral'} className="text-[10px]">
                          {phase.status}
                        </Badge>
                        <ChevronRight size={16} className="text-surface-600 group-hover:text-surface-300 transition-colors" />
                      </div>
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
