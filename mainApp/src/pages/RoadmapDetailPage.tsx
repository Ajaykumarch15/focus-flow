import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Map, Plus, Calendar, Clock, Target, CheckCircle2,
  Circle, Trash2, Edit3, Pause, Play, Link,
  ChevronRight, Zap, AlertCircle, Info,
  GraduationCap, Rocket, Trophy, BookOpen, Code, Briefcase,
  Lightbulb, Brain, Palette, Globe, Heart, Star, Award,
} from 'lucide-react';
import { useRoadmapStore } from '../store/useRoadmapStore';
import { useStore } from '../store/useStore';
import { api } from '../utils/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Dialog } from '../components/ui/Dialog';
import { formatMs } from '../utils/time';
import {
  ROADMAP_TYPE_LABELS,
  ROADMAP_STATUS_LABELS,
  ROADMAP_STATUS_COLORS,
  type RoadmapPhaseDoc,
  type RoadmapMilestoneDoc,
} from '../types/roadmap';
import { toast } from '../store/useToastStore';

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

function getHealth(progress: number, targetDate?: string, startDate?: string) {
  if (progress === 100) return { label: 'Completed', color: 'text-emerald-400', className: 'bg-emerald-500/10 border-emerald-500/20', description: 'All milestones are complete.' };
  if (!targetDate || progress === 0) return { label: 'On Track', color: 'text-emerald-400', className: 'bg-emerald-500/10 border-emerald-500/20', description: 'Your current progress is sufficient to reach the target date.' };

  const now = Date.now();
  const target = new Date(targetDate).getTime();
  const totalMs = target - now;
  if (totalMs <= 0) return { label: 'Behind', color: 'text-red-400', className: 'bg-red-500/10 border-red-500/20', description: 'The target date has passed. Consider adjusting your timeline.' };

  const elapsed = now - new Date(startDate || now).getTime();
  const expectedProgress = Math.min(100, (elapsed / totalMs) * 100);

  if (progress >= expectedProgress - 10) return { label: 'On Track', color: 'text-emerald-400', className: 'bg-emerald-500/10 border-emerald-500/20', description: 'Your current progress is sufficient to reach the target date.' };
  if (progress >= expectedProgress - 25) return { label: 'At Risk', color: 'text-yellow-400', className: 'bg-yellow-500/10 border-yellow-500/20', description: 'You\'re slightly behind schedule. A few focused sessions can get you back on track.' };
  return { label: 'Behind', color: 'text-red-400', className: 'bg-red-500/10 border-red-500/20', description: 'You\'re behind schedule. Consider focusing on the most critical milestones.' };
}

export function RoadmapDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const activePhaseRef = useRef<HTMLDivElement>(null);
  const { activeRoadmap, detailLoading, error, getRoadmap, updateRoadmap, deleteRoadmap, createPhase, updatePhase, deletePhase, createMilestone, updateMilestone, deleteMilestone, clearActiveRoadmap } = useRoadmapStore();
  const { startTimer, addTask } = useStore();

  const [showAddPhase, setShowAddPhase] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState<string | null>(null);
  const [editingPhase, setEditingPhase] = useState<string | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showAddTaskToMilestone, setShowAddTaskToMilestone] = useState<string | null>(null);
  const [showLinkTaskForMilestone, setShowLinkTaskForMilestone] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [showHealthDetail, setShowHealthDetail] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id) getRoadmap(id);
    return () => clearActiveRoadmap();
  }, [id, getRoadmap, clearActiveRoadmap]);

  // Auto-expand active phase and scroll to it
  useEffect(() => {
    if (activeRoadmap?.phases) {
      const active = activeRoadmap.phases.find(p => p.status === 'active');
      if (active) {
        setExpandedPhases(prev => {
          const next = new Set(prev);
          next.add(active._id);
          return next;
        });
        // Scroll to active phase after a short delay for DOM update
        setTimeout(() => {
          activePhaseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    }
  }, [activeRoadmap?.phases]);

  const roadmap = activeRoadmap;
  const roadmapId = roadmap?._id;
  const health = useMemo(() => {
    if (!roadmap) return null;
    return getHealth(roadmap.progress, roadmap.targetDate, roadmap.startDate);
  }, [roadmapId, roadmap?.progress, roadmap?.targetDate, roadmap?.startDate]);

  const nextUp = useMemo(() => {
    if (!roadmap) return null;
    const incompleteTasks = (roadmap.tasks || [])
      .filter(t => t.status !== 'completed')
      .sort((a, b) => {
        if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        if (a.deadline) return -1;
        if (b.deadline) return 1;
        return 0;
      });
    return incompleteTasks[0] || null;
  }, [roadmap?.tasks]);

  const recentActivity = useMemo(() => {
    if (!roadmap) return [];
    const activities: { icon: any; text: string; color: string }[] = [];

    const completedTasks = (roadmap.tasks || []).filter(t => t.status === 'completed');
    completedTasks.slice(-5).reverse().forEach(t => {
      activities.push({ icon: CheckCircle2, text: `Completed "${t.title}"`, color: 'text-emerald-400' });
    });

    const completedMilestones = (roadmap.milestones || []).filter(m => m.status === 'completed');
    completedMilestones.slice(-3).reverse().forEach(m => {
      activities.push({ icon: Target, text: `Completed milestone "${m.title}"`, color: 'text-brand-400' });
    });

    return activities.slice(0, 6);
  }, [roadmap?.tasks, roadmap?.milestones]);

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  };

  const handleAddTaskToMilestone = async (milestoneId: string) => {
    if (!newTaskTitle.trim() || !roadmap) return;
    const milestone = roadmap.milestones.find(m => m._id === milestoneId);
    try {
      await addTask({
        title: newTaskTitle,
        description: '',
        priority: 'medium',
        status: 'todo',
        category: 'Work',
        color: roadmap.color,
        tags: [],
        subtasks: [],
        roadmapRef: roadmap._id,
        phaseRef: milestone?.phaseId,
        milestoneRef: milestoneId,
      } as any);
      setNewTaskTitle('');
      setShowAddTaskToMilestone(null);
      getRoadmap(roadmap._id);
    } catch {
      toast.error('Failed to create task');
    }
  };

  const handleDeleteRoadmap = async () => {
    if (!roadmap) return;
    setDeleting(true);
    try {
      await deleteRoadmap(roadmap._id);
      navigate('/roadmaps');
    } catch {
      toast.error('Failed to delete roadmap');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(null);
    }
  };

  // ── Loading skeleton ──
  if (detailLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
        <div className="h-4 w-32 bg-surface-800 rounded animate-pulse" />
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-surface-800 animate-pulse" />
          <div className="space-y-2">
            <div className="h-7 w-64 bg-surface-800 rounded animate-pulse" />
            <div className="h-4 w-48 bg-surface-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-surface-800 rounded-[22px] animate-pulse" />)}
        </div>
        <div className="h-16 bg-surface-800 rounded-[22px] animate-pulse" />
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-surface-800 rounded-[22px] animate-pulse" />)}
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
        <Card className="p-8 text-center">
          <AlertCircle className="mx-auto mb-3 text-red-400" size={32} />
          <p className="text-surface-300 mb-1 font-medium">Something went wrong</p>
          <p className="text-surface-500 text-sm mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="secondary" onClick={() => navigate('/roadmaps')}>Back to Roadmaps</Button>
            <Button onClick={() => id && getRoadmap(id)}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!roadmap) return null;

  const Icon = ICON_MAP[roadmap.icon] || Map;
  const statusTone: BadgeTone = (ROADMAP_STATUS_COLORS[roadmap.status] || 'neutral') as BadgeTone;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5 sm:space-y-6">
      {/* 1. Back navigation */}
      <motion.button
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate('/roadmaps')}
        className="flex items-center gap-2 text-sm text-surface-400 hover:text-surface-200 transition-colors"
        aria-label="Back to Roadmaps"
      >
        <ArrowLeft size={16} />
        Back to Roadmaps
      </motion.button>

      {/* 2. Roadmap header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"
      >
        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
          <div
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${roadmap.color}15`, color: roadmap.color }}
          >
            <Icon size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-display font-extrabold text-surface-50 truncate">{roadmap.title}</h1>
            {roadmap.description && (
              <p className="text-sm text-surface-400 mt-0.5 line-clamp-2 max-w-xl">{roadmap.description}</p>
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
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {roadmap.status !== 'completed' && roadmap.status !== 'archived' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => updateRoadmap(roadmap._id, { status: roadmap.status === 'paused' ? 'active' : 'paused' })}
              leftIcon={roadmap.status === 'paused' ? <Play size={14} /> : <Pause size={14} />}
              aria-label={roadmap.status === 'paused' ? 'Resume roadmap' : 'Pause roadmap'}
            >
              {roadmap.status === 'paused' ? 'Resume' : 'Pause'}
            </Button>
          )}
          {roadmap.status !== 'completed' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => updateRoadmap(roadmap._id, { status: 'completed' })}
              leftIcon={<CheckCircle2 size={14} />}
              aria-label="Mark roadmap as completed"
            >
              Complete
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowDeleteConfirm(roadmap._id)}
            className="text-surface-400 hover:text-red-400"
            aria-label="Delete roadmap"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </motion.div>

      {/* 3. Overall progress + Health */}
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
                  aria-label={`Health: ${health.label}. Click for details.`}
                >
                  {health.label}
                </button>
              )}
            </div>
            <span className="text-sm font-bold text-surface-50">{safeProgress(roadmap.progress)}%</span>
          </div>
          <div className="h-2.5 bg-surface-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: roadmap.color }}
              initial={{ width: 0 }}
              animate={{ width: `${safeProgress(roadmap.progress)}%` }}
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

      {/* 4. Key statistics */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.1 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        {[
          { label: 'Progress', value: `${safeProgress(roadmap.progress)}%`, icon: Target, color: roadmap.color },
          { label: 'Milestones', value: `${roadmap.milestoneCompleted} / ${roadmap.milestoneTotal}`, icon: CheckCircle2, color: '#10b981' },
          { label: 'Tasks', value: `${roadmap.completedTasks} / ${roadmap.totalTasks}`, icon: Zap, color: '#8b5cf6' },
          { label: 'Focused', value: formatMs(roadmap.totalTime), icon: Clock, color: '#f59e0b' },
        ].map(({ label, value, icon: StatIcon, color }) => (
          <Card key={label} className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <StatIcon size={13} style={{ color }} />
              <span className="text-[11px] text-surface-400 font-medium">{label}</span>
            </div>
            <p className="text-base sm:text-lg font-display font-bold text-surface-50">{value}</p>
          </Card>
        ))}
      </motion.div>

      {/* 5. Next Up — prominent */}
      {nextUp && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
        >
          <Card className="p-4 border-brand-500/20 bg-brand-500/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-400 mb-1">Next Up</p>
                <p className="text-sm font-semibold text-surface-50 truncate">{nextUp.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge tone="brand">{nextUp.priority}</Badge>
                  {nextUp.deadline && (
                    <span className="text-xs text-surface-400 flex items-center gap-1">
                      <Calendar size={11} />
                      {new Date(nextUp.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => startTimer(nextUp.id)}
                leftIcon={<Zap size={14} />}
                className="flex-shrink-0"
              >
                Start Task
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* 6-9. Main content: Timeline + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
        {/* Left: Phases */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-display font-bold text-surface-50">Phases</h2>
            <Button size="sm" variant="secondary" onClick={() => setShowAddPhase(true)} leftIcon={<Plus size={14} />}>
              Add Phase
            </Button>
          </div>

          {roadmap.phases.length === 0 && (
            <Card className="p-8 text-center">
              <Map className="mx-auto mb-3 text-surface-500" size={28} />
              <p className="text-sm text-surface-300 mb-1 font-medium">No phases yet</p>
              <p className="text-xs text-surface-500 mb-3">Break your roadmap into phases to track progress.</p>
              <Button size="sm" onClick={() => setShowAddPhase(true)} leftIcon={<Plus size={14} />}>
                Add Phase
              </Button>
            </Card>
          )}

          <AnimatePresence mode="popLayout">
            {roadmap.phases.map((phase, idx) => {
              const isExpanded = expandedPhases.has(phase._id);
              const isActive = phase.status === 'active';
              const isCompleted = phase.status === 'completed';
              const phaseMilestones = roadmap.milestones.filter(m => m.phaseId === phase._id);

              return (
                <motion.div
                  key={phase._id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  ref={isActive ? activePhaseRef : undefined}
                >
                  <Card className={`overflow-hidden transition-all ${isActive ? 'ring-1 ring-brand-500/30' : ''}`}>
                    <button
                      onClick={() => togglePhase(phase._id)}
                      className="w-full flex items-center gap-3 p-3.5 sm:p-4 text-left hover:bg-surface-800/30 transition-colors"
                      aria-expanded={isExpanded}
                      aria-label={`${phase.title} - ${phase.progress}% complete, ${phase.status}`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold transition-colors ${
                        isCompleted ? 'bg-emerald-500/20 text-emerald-400' :
                        isActive ? 'bg-brand-500/20 text-brand-400' :
                        'bg-surface-800 text-surface-400'
                      }`}>
                        {isCompleted ? <CheckCircle2 size={14} /> : idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-surface-50 truncate">{phase.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 h-1 bg-surface-800 rounded-full overflow-hidden max-w-[120px]">
                            <div
                              className="h-full rounded-full bg-brand-500/70 transition-all duration-300"
                              style={{ width: `${safeProgress(phase.progress)}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-surface-400">{safeProgress(phase.progress)}%</span>
                          <span className="text-[11px] text-surface-500">{phase.milestoneCompleted}/{phase.milestoneTotal}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Badge tone={isCompleted ? 'success' : isActive ? 'brand' : 'neutral'} className="hidden sm:inline-flex">
                          {phase.status}
                        </Badge>
                        <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
                          <ChevronRight size={16} className="text-surface-400" />
                        </motion.div>
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3.5 sm:px-4 pb-4 border-t border-surface-800/50">
                            {/* Phase actions */}
                            <div className="flex items-center gap-1.5 mt-3 mb-3">
                              {phase.status !== 'completed' && (
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => updatePhase(phase._id, { status: phase.status === 'active' ? 'completed' : 'active' })}
                                  leftIcon={phase.status === 'active' ? <CheckCircle2 size={12} /> : <Play size={12} />}
                                >
                                  {phase.status === 'active' ? 'Complete' : 'Start'}
                                </Button>
                              )}
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => setEditingPhase(phase._id)}
                                className="text-surface-400"
                                aria-label={`Edit ${phase.title}`}
                              >
                                <Edit3 size={12} />
                              </Button>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => setShowDeleteConfirm(`phase_${phase._id}`)}
                                className="text-surface-400 hover:text-red-400"
                                aria-label={`Delete ${phase.title}`}
                              >
                                <Trash2 size={12} />
                              </Button>
                            </div>

                            {/* Milestones */}
                            {phaseMilestones.length === 0 && (
                              <div className="text-center py-4">
                                <p className="text-xs text-surface-500 mb-2">No milestones yet.</p>
                                <Button size="xs" variant="secondary" onClick={() => setShowAddMilestone(phase._id)} leftIcon={<Plus size={11} />}>
                                  Add Milestone
                                </Button>
                              </div>
                            )}

                            {phaseMilestones.map(milestone => (
                              <div key={milestone._id} className="bg-surface-800/30 rounded-xl p-3 mb-2 last:mb-0">
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {milestone.status === 'completed' ? (
                                      <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                                    ) : milestone.status === 'in-progress' ? (
                                      <div className="w-3.5 h-3.5 rounded-full border-2 border-brand-400 border-t-transparent animate-spin flex-shrink-0" />
                                    ) : (
                                      <Circle size={14} className="text-surface-500 flex-shrink-0" />
                                    )}
                                    <span className={`text-sm font-medium truncate ${milestone.status === 'completed' ? 'text-surface-400 line-through' : 'text-surface-200'}`}>
                                      {milestone.title}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <span className="text-[11px] text-surface-500">{safeProgress(milestone.completedTasks)}/{safeProgress(milestone.totalTasks)}</span>
                                    <Button size="xs" variant="ghost" onClick={() => setEditingMilestone(milestone._id)} className="text-surface-500" aria-label={`Edit ${milestone.title}`}>
                                      <Edit3 size={11} />
                                    </Button>
                                    <Button size="xs" variant="ghost" onClick={() => setShowDeleteConfirm(`milestone_${milestone._id}`)} className="text-surface-500 hover:text-red-400" aria-label={`Delete ${milestone.title}`}>
                                      <Trash2 size={11} />
                                    </Button>
                                  </div>
                                </div>
                                {milestone.totalTasks > 0 && (
                                  <div className="h-1 bg-surface-700 rounded-full overflow-hidden mb-1.5">
                                    <div
                                      className="h-full rounded-full bg-brand-500/60 transition-all duration-300"
                                      style={{ width: `${safeProgress(milestone.progress)}%` }}
                                    />
                                  </div>
                                )}
                                {showAddTaskToMilestone === milestone._id ? (
                                  <div className="mt-2 flex gap-2">
                                    <Input
                                      className="h-8 text-xs rounded-lg flex-1"
                                      placeholder="Task title..."
                                      value={newTaskTitle}
                                      onChange={e => setNewTaskTitle(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') handleAddTaskToMilestone(milestone._id);
                                        if (e.key === 'Escape') { setShowAddTaskToMilestone(null); setNewTaskTitle(''); }
                                      }}
                                      autoFocus
                                    />
                                    <Button size="xs" onClick={() => handleAddTaskToMilestone(milestone._id)} disabled={!newTaskTitle.trim()}>Add</Button>
                                    <Button size="xs" variant="ghost" onClick={() => { setShowAddTaskToMilestone(null); setNewTaskTitle(''); }}>Cancel</Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => setShowAddTaskToMilestone(milestone._id)}
                                      className="text-[11px] text-surface-500 hover:text-brand-400 transition-colors flex items-center gap-1"
                                    >
                                      <Plus size={11} /> Add Task
                                    </button>
                                    <span className="text-surface-700">·</span>
                                    <button
                                      onClick={() => setShowLinkTaskForMilestone(milestone._id)}
                                      className="text-[11px] text-surface-500 hover:text-brand-400 transition-colors flex items-center gap-1"
                                    >
                                      <Link size={11} /> Link Task
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}

                            {/* Add milestone */}
                            {phaseMilestones.length > 0 && (
                              <button
                                onClick={() => setShowAddMilestone(phase._id)}
                                className="w-full mt-2 py-2 border border-dashed border-surface-700 rounded-xl text-xs text-surface-400 hover:text-brand-400 hover:border-brand-500/30 transition-all flex items-center justify-center gap-1"
                              >
                                <Plus size={12} /> Add Milestone
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Right sidebar: Activity + Linked Tasks */}
        <div className="space-y-4">
          {/* Recent Activity */}
          <Card className="p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-surface-400 mb-3">Recent Activity</h3>
            {recentActivity.length === 0 ? (
              <p className="text-xs text-surface-500 text-center py-3">No activity yet.</p>
            ) : (
              <div className="space-y-2.5">
                {recentActivity.map((activity, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <activity.icon size={13} className={`${activity.color} mt-0.5 flex-shrink-0`} />
                    <p className="text-xs text-surface-300 leading-relaxed">{activity.text}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Linked Tasks */}
          <Card className="p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-surface-400 mb-3">
              Linked Tasks ({roadmap.tasks.length})
            </h3>
            {roadmap.tasks.length === 0 ? (
              <p className="text-xs text-surface-500 text-center py-3">No tasks yet. Add tasks from milestones.</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
                {roadmap.tasks.slice(0, 15).map(task => (
                  <div key={task.id} className="flex items-center gap-2 py-1 px-1 rounded-lg hover:bg-surface-800/50 transition-colors">
                    {task.status === 'completed' ? (
                      <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Circle size={12} className="text-surface-500 flex-shrink-0" />
                    )}
                    <span className={`text-xs truncate flex-1 ${task.status === 'completed' ? 'text-surface-500 line-through' : 'text-surface-300'}`}>
                      {task.title}
                    </span>
                    {task.totalTime > 0 && (
                      <span className="text-[10px] text-surface-500 flex-shrink-0">{formatMs(task.totalTime)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Dialogs ── */}
      {showAddPhase && (
        <AddPhaseDialog onClose={() => setShowAddPhase(false)} onSubmit={(data) => { createPhase(roadmap._id, data); setShowAddPhase(false); }} />
      )}
      {showAddMilestone && (
        <AddMilestoneDialog onClose={() => setShowAddMilestone(null)} onSubmit={(data) => { createMilestone(showAddMilestone, data); setShowAddMilestone(null); }} />
      )}
      {editingPhase && (() => {
        const phase = roadmap.phases.find(p => p._id === editingPhase);
        if (!phase) return null;
        return <EditPhaseDialog phase={phase} onClose={() => setEditingPhase(null)} onSubmit={(data) => { updatePhase(editingPhase, data); setEditingPhase(null); }} />;
      })()}
      {editingMilestone && (() => {
        const milestone = roadmap.milestones.find(m => m._id === editingMilestone);
        if (!milestone) return null;
        return <EditMilestoneDialog milestone={milestone} onClose={() => setEditingMilestone(null)} onSubmit={(data) => { updateMilestone(editingMilestone, data); setEditingMilestone(null); }} />;
      })()}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <Dialog
          open={true}
          onClose={() => { setShowDeleteConfirm(null); setDeleting(false); }}
          title="Confirm Delete"
          footer={
            <>
              <Button variant="secondary" onClick={() => { setShowDeleteConfirm(null); setDeleting(false); }}>Cancel</Button>
              <Button
                variant="danger"
                loading={deleting}
                onClick={() => {
                  if (showDeleteConfirm === roadmap._id) {
                    handleDeleteRoadmap();
                  } else if (showDeleteConfirm.startsWith('phase_')) {
                    deletePhase(showDeleteConfirm.replace('phase_', ''));
                    setShowDeleteConfirm(null);
                  } else if (showDeleteConfirm.startsWith('milestone_')) {
                    deleteMilestone(showDeleteConfirm.replace('milestone_', ''));
                    setShowDeleteConfirm(null);
                  }
                }}
              >
                Delete
              </Button>
            </>
          }
        >
          <p className="text-sm text-surface-300">
            {showDeleteConfirm === roadmap._id
              ? `Are you sure you want to delete "${roadmap.title}"? All phases and milestones will be removed. Tasks will remain but become unlinked.`
              : 'Are you sure you want to delete this item? Associated task links will be removed.'}
          </p>
        </Dialog>
      )}

      {/* Link Task Modal */}
      {showLinkTaskForMilestone && roadmap && (
        <LinkTaskModal
          roadmapId={roadmap._id}
          phaseId={roadmap.milestones.find(m => m._id === showLinkTaskForMilestone)?.phaseId || ''}
          milestoneId={showLinkTaskForMilestone}
          onClose={() => setShowLinkTaskForMilestone(null)}
        />
      )}
    </div>
  );
}

// ── Sub-Dialogs ──────────────────────────────────────────────────────────────

function AddPhaseDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: any) => void }) {
  const [form, setForm] = useState({ title: '', description: '', startDate: '', targetDate: '' });
  return (
    <Dialog open={true} onClose={onClose} title="Add Phase" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSubmit(form)} disabled={!form.title.trim()}>Create</Button>
      </>
    }>
      <div className="space-y-4">
        <div>
          <label htmlFor="phase-title" className="block text-sm font-semibold text-surface-200 mb-1.5">Title *</label>
          <Input id="phase-title" className="h-10 rounded-xl" placeholder="e.g. Foundations" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} autoFocus />
        </div>
        <div>
          <label htmlFor="phase-desc" className="block text-sm font-semibold text-surface-200 mb-1.5">Description</label>
          <Textarea id="phase-desc" className="resize-none h-16 rounded-xl py-2" placeholder="Optional description..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="phase-start" className="block text-sm font-semibold text-surface-200 mb-1.5">Start Date</label>
            <Input id="phase-start" type="date" className="h-10 rounded-xl" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="phase-target" className="block text-sm font-semibold text-surface-200 mb-1.5">Target Date</label>
            <Input id="phase-target" type="date" className="h-10 rounded-xl" value={form.targetDate} onChange={e => setForm(p => ({ ...p, targetDate: e.target.value }))} />
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function EditPhaseDialog({ phase, onClose, onSubmit }: { phase: RoadmapPhaseDoc; onClose: () => void; onSubmit: (data: any) => void }) {
  const [form, setForm] = useState({ title: phase.title, description: phase.description, startDate: phase.startDate?.slice(0, 10) || '', targetDate: phase.targetDate?.slice(0, 10) || '' });
  return (
    <Dialog open={true} onClose={onClose} title="Edit Phase" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSubmit(form)} disabled={!form.title.trim()}>Save</Button>
      </>
    }>
      <div className="space-y-4">
        <div>
          <label htmlFor="edit-phase-title" className="block text-sm font-semibold text-surface-200 mb-1.5">Title *</label>
          <Input id="edit-phase-title" className="h-10 rounded-xl" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} autoFocus />
        </div>
        <div>
          <label htmlFor="edit-phase-desc" className="block text-sm font-semibold text-surface-200 mb-1.5">Description</label>
          <Textarea id="edit-phase-desc" className="resize-none h-16 rounded-xl py-2" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="edit-phase-start" className="block text-sm font-semibold text-surface-200 mb-1.5">Start Date</label>
            <Input id="edit-phase-start" type="date" className="h-10 rounded-xl" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="edit-phase-target" className="block text-sm font-semibold text-surface-200 mb-1.5">Target Date</label>
            <Input id="edit-phase-target" type="date" className="h-10 rounded-xl" value={form.targetDate} onChange={e => setForm(p => ({ ...p, targetDate: e.target.value }))} />
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function AddMilestoneDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: any) => void }) {
  const [form, setForm] = useState({ title: '', description: '', targetDate: '' });
  return (
    <Dialog open={true} onClose={onClose} title="Add Milestone" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSubmit(form)} disabled={!form.title.trim()}>Create</Button>
      </>
    }>
      <div className="space-y-4">
        <div>
          <label htmlFor="ms-title" className="block text-sm font-semibold text-surface-200 mb-1.5">Title *</label>
          <Input id="ms-title" className="h-10 rounded-xl" placeholder="e.g. Build ML Project" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} autoFocus />
        </div>
        <div>
          <label htmlFor="ms-desc" className="block text-sm font-semibold text-surface-200 mb-1.5">Description</label>
          <Textarea id="ms-desc" className="resize-none h-16 rounded-xl py-2" placeholder="What does achieving this mean?" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="ms-date" className="block text-sm font-semibold text-surface-200 mb-1.5">Target Date</label>
          <Input id="ms-date" type="date" className="h-10 rounded-xl" value={form.targetDate} onChange={e => setForm(p => ({ ...p, targetDate: e.target.value }))} />
        </div>
      </div>
    </Dialog>
  );
}

function EditMilestoneDialog({ milestone, onClose, onSubmit }: { milestone: RoadmapMilestoneDoc; onClose: () => void; onSubmit: (data: any) => void }) {
  const [form, setForm] = useState({ title: milestone.title, description: milestone.description, targetDate: milestone.targetDate?.slice(0, 10) || '' });
  return (
    <Dialog open={true} onClose={onClose} title="Edit Milestone" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSubmit(form)} disabled={!form.title.trim()}>Save</Button>
      </>
    }>
      <div className="space-y-4">
        <div>
          <label htmlFor="edit-ms-title" className="block text-sm font-semibold text-surface-200 mb-1.5">Title *</label>
          <Input id="edit-ms-title" className="h-10 rounded-xl" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} autoFocus />
        </div>
        <div>
          <label htmlFor="edit-ms-desc" className="block text-sm font-semibold text-surface-200 mb-1.5">Description</label>
          <Textarea id="edit-ms-desc" className="resize-none h-16 rounded-xl py-2" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="edit-ms-date" className="block text-sm font-semibold text-surface-200 mb-1.5">Target Date</label>
          <Input id="edit-ms-date" type="date" className="h-10 rounded-xl" value={form.targetDate} onChange={e => setForm(p => ({ ...p, targetDate: e.target.value }))} />
        </div>
      </div>
    </Dialog>
  );
}

function LinkTaskModal({ roadmapId, phaseId, milestoneId, onClose }: {
  roadmapId: string;
  phaseId: string;
  milestoneId: string;
  onClose: () => void;
}) {
  const { linkTask } = useRoadmapStore();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [linking, setLinking] = useState<string | null>(null);

  useEffect(() => {
    api.personalRoadmaps.availableTasks()
      .then(setTasks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = tasks.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleLink = async (taskId: string) => {
    setLinking(taskId);
    try {
      await linkTask({ taskId, roadmapId, phaseId, milestoneId });
      onClose();
    } catch {
      // toast handled by store
    } finally {
      setLinking(null);
    }
  };

  return (
    <Dialog open={true} onClose={onClose} title="Link Existing Task" size="lg">
      <div className="space-y-3">
        <Input
          className="h-10 rounded-xl"
          placeholder="Search tasks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        {loading ? (
          <div className="py-8 text-center text-sm text-surface-400">Loading tasks...</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-surface-500">
            {tasks.length === 0 ? 'No unlinked tasks available.' : 'No tasks match your search.'}
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1 scrollbar-thin">
            {filtered.map(task => (
              <div
                key={task._id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-surface-800/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-surface-200 truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge tone={task.priority === 'urgent' ? 'danger' : task.priority === 'high' ? 'warning' : 'neutral'}>
                      {task.priority}
                    </Badge>
                    <span className="text-[11px] text-surface-500">{task.category}</span>
                    {task.totalTime > 0 && (
                      <span className="text-[11px] text-surface-500">{formatMs(task.totalTime)}</span>
                    )}
                  </div>
                </div>
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => handleLink(task._id)}
                  loading={linking === task._id}
                  disabled={linking !== null}
                >
                  Link
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
