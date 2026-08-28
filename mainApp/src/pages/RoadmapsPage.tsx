import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Map, Plus, Calendar, Target, Clock, ArrowRight, Zap,
  GraduationCap, Rocket, Trophy, BookOpen, Code, Briefcase,
  Lightbulb, Brain, Palette, Globe, Heart, Star, Award,
  AlertCircle,
} from 'lucide-react';
import { useRoadmapStore } from '../store/useRoadmapStore';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { formatMs } from '../utils/time';
import {
  ROADMAP_TYPE_LABELS,
} from '../types/roadmap';
import { CreateRoadmapModal } from '../components/roadmap/CreateRoadmapModal';
import { safeProgress, getListHealth } from '../utils/roadmapProgress';

const ICON_MAP: Record<string, any> = {
  Map, GraduationCap, Rocket, Target, Trophy, BookOpen,
  Code, Briefcase, Lightbulb, Brain, Palette, Globe,
  Heart, Star, Zap, Award,
};

function SkeletonCard() {
  return (
    <div className="bg-surface-900 border border-surface-800 rounded-[22px] p-5 space-y-3">
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

  useEffect(() => { loadRoadmaps(); }, [loadRoadmaps]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5 sm:space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-extrabold text-surface-50">Roadmaps</h1>
          <p className="text-sm text-surface-400 mt-0.5">
            Plan your long-term goals and turn them into focused execution.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} leftIcon={<Plus size={16} />}>
          Create Roadmap
        </Button>
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

      {/* Empty */}
      {!loading && !error && roadmaps.length === 0 && (
        <EmptyState
          icon={<Map size={28} />}
          title="No roadmaps yet"
          description="Turn a long-term goal into focused execution. Create your first roadmap to get started."
          action={
            <Button onClick={() => setShowCreate(true)} leftIcon={<Plus size={16} />}>
              Create Roadmap
            </Button>
          }
        />
      )}

      {/* Roadmap Grid */}
      {!loading && !error && roadmaps.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {roadmaps.map((roadmap, i) => {
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

                    {/* Continue button for active roadmaps */}
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
          </AnimatePresence>
        </div>
      )}

      {showCreate && <CreateRoadmapModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
