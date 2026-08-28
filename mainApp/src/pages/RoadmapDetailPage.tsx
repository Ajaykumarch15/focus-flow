import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Map, Calendar, CheckCircle2,
  ChevronRight, ChevronUp, ChevronDown, Zap, AlertCircle, Target,
  GraduationCap, Rocket, Trophy, BookOpen, Code, Briefcase,
  Lightbulb, Brain, Palette, Globe, Heart, Star, Award, Info,
  Pencil, Trash2, Plus,
} from 'lucide-react';
import { useRoadmapStore } from '../store/useRoadmapStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import { ConfirmDialog } from '../components/roadmap/ConfirmDialog';
import { EditRoadmapModal } from '../components/roadmap/EditRoadmapModal';
import { PhaseFormModal } from '../components/roadmap/PhaseFormModal';
import type { RoadmapPhaseDoc } from '../types/roadmap';
import {
  ROADMAP_TYPE_LABELS,
  ROADMAP_STATUS_LABELS,
  ROADMAP_STATUS_COLORS,
} from '../types/roadmap';
import { safeProgress, getDetailHealth, formatProgress } from '../utils/roadmapProgress';
import { PersonalRoadmapTimeline } from '../components/roadmap/PersonalRoadmapTimeline';

const ICON_MAP: Record<string, any> = {
  Map, GraduationCap, Rocket, Target, Trophy, BookOpen,
  Code, Briefcase, Lightbulb, Brain, Palette, Globe,
  Heart, Star, Zap, Award,
};

const STATUS_COLORS: Record<string, BadgeTone> = {
  upcoming: 'neutral',
  active: 'brand',
  completed: 'success',
  paused: 'warning',
};

export function RoadmapDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeRoadmap, detailLoading, error, getRoadmap, clearActiveRoadmap, deleteRoadmap, deletePhase, reorderPhases } = useRoadmapStore();

  const [showHealthDetail, setShowHealthDetail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'phases' | 'timeline'>('phases');
  /** null → closed; 'create' → new-phase form; otherwise the phase being edited. */
  const [phaseFormTarget, setPhaseFormTarget] = useState<'create' | RoadmapPhaseDoc | null>(null);
  const [phaseDeleteTarget, setPhaseDeleteTarget] = useState<RoadmapPhaseDoc | null>(null);
  const [phaseDeleting, setPhaseDeleting] = useState(false);

  useEffect(() => {
    if (id) getRoadmap(id);
    return () => clearActiveRoadmap();
  }, [id, getRoadmap, clearActiveRoadmap]);

  const roadmap = activeRoadmap;

  const health = useMemo(() => {
    if (!roadmap) return null;
    return getDetailHealth(roadmap);
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
            <button onClick={() => id && getRoadmap(id)} className="px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors">Retry</button>
          </div>
        </Card>
      </div>
    );
  }

  if (!roadmap) return null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteRoadmap(roadmap._id);
      navigate('/personal/roadmaps');
    } catch {
      // Failure toast is surfaced by the store.
    } finally {
      setDeleting(false);
    }
  };

  const handleDeletePhase = async () => {
    if (!phaseDeleteTarget || phaseDeleting) return;
    setPhaseDeleting(true);
    try {
      await deletePhase(phaseDeleteTarget._id);
      setPhaseDeleteTarget(null);
    } catch {
      // Failure toast is surfaced by the store.
    } finally {
      setPhaseDeleting(false);
    }
  };

  const movePhase = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= sortedPhases.length) return;
    const ids = sortedPhases.map(p => p._id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    reorderPhases(roadmap._id, ids);
  };

  const Icon = ICON_MAP[roadmap.icon] || Map;
  const statusTone: BadgeTone = (ROADMAP_STATUS_COLORS[roadmap.status] || 'neutral') as BadgeTone;
  const progress = safeProgress(roadmap.progress);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[900px] mx-auto space-y-4">
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
            {roadmap.startDate && (
              <span className="text-xs text-surface-400 flex items-center gap-1">
                <Calendar size={11} />
                Start: {new Date(roadmap.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
            {roadmap.targetDate && (
              <span className="text-xs text-surface-400 flex items-center gap-1">
                <Calendar size={11} />
                Target: {new Date(roadmap.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setShowEdit(true)}
            className="p-2 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-all"
            title="Edit roadmap"
            aria-label="Edit roadmap"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-2 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="Delete roadmap"
            aria-label="Delete roadmap"
          >
            <Trash2 size={15} />
          </button>
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
            <span className="text-sm font-bold text-surface-50">{formatProgress(roadmap.progress, roadmap.milestoneTotal)}</span>
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

      {/* Timeline / Phases toggle */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.08 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-900 border border-surface-800">
          {(['phases', 'timeline'] as const).map(view => (
            <button
              key={view}
              onClick={() => setViewMode(view)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                viewMode === view ? 'bg-brand-500/15 text-brand-400' : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              {view}
            </button>
          ))}
        </div>
      </motion.div>

      {viewMode === 'timeline' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <PersonalRoadmapTimeline
            milestones={roadmap.milestones}
            startDate={roadmap.startDate}
            targetDate={roadmap.targetDate}
            status={roadmap.status}
            progress={roadmap.progress}
            onOpen={(m) => navigate(`/personal/roadmaps/${id}/phases/${m.phaseId}/milestones/${m._id}`)}
          />
        </motion.div>
      )}

      {/* Phases */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.1 }}
        className={viewMode === 'timeline' ? 'hidden' : undefined}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-surface-400">Phases</h2>
          <div className="flex items-center gap-3">
            {sortedPhases.length > 0 && (
              <span className="text-xs text-surface-500">{sortedPhases.length} phase{sortedPhases.length !== 1 ? 's' : ''}</span>
            )}
            <Button size="sm" variant="secondary" onClick={() => setPhaseFormTarget('create')} leftIcon={<Plus size={14} />}>
              Add Phase
            </Button>
          </div>
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
                  <div
                    role="link"
                    tabIndex={0}
                    aria-label={`${phase.title}, ${phaseProgress}% complete`}
                    onClick={() => navigate(`/personal/roadmaps/${roadmap._id}/phases/${phase._id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/personal/roadmaps/${roadmap._id}/phases/${phase._id}`); }}
                    className={`w-full text-left rounded-2xl border bg-surface-900/90 p-4 cursor-pointer transition-all duration-200 hover:border-surface-700 hover:bg-surface-800/50 group ${
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
                        {(phase.startDate || phase.targetDate) && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Calendar size={10} className="text-surface-500" />
                            <span className="text-[10px] text-surface-500">
                              {phase.startDate && phase.targetDate
                                ? `${new Date(phase.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(phase.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                                : phase.startDate
                                  ? `Start: ${new Date(phase.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                                  : `Target: ${new Date(phase.targetDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                              }
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-surface-800 rounded-full overflow-hidden max-w-[140px]">
                            <div
                              className="h-full rounded-full bg-brand-500/70 transition-all duration-300"
                              style={{ width: `${phaseProgress}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-medium text-surface-300">{formatProgress(phase.progress, phase.milestoneTotal)}</span>
                          <span className="text-[11px] text-surface-500">{phase.milestoneCompleted}/{phase.milestoneTotal} milestones</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <Badge tone={STATUS_COLORS[phase.status] || 'neutral'} className="text-[10px]">
                          {phase.status}
                        </Badge>
                        <div className="flex flex-col">
                          <button
                            onClick={(e) => { e.stopPropagation(); movePhase(idx, -1); }}
                            disabled={idx === 0}
                            className="p-0.5 rounded text-surface-600 hover:text-surface-200 hover:bg-surface-800 transition-all disabled:opacity-30 disabled:pointer-events-none"
                            title="Move up"
                            aria-label={`Move ${phase.title} up`}
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); movePhase(idx, 1); }}
                            disabled={idx === sortedPhases.length - 1}
                            className="p-0.5 rounded text-surface-600 hover:text-surface-200 hover:bg-surface-800 transition-all disabled:opacity-30 disabled:pointer-events-none"
                            title="Move down"
                            aria-label={`Move ${phase.title} down`}
                          >
                            <ChevronDown size={12} />
                          </button>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPhaseFormTarget(phase); }}
                          className="p-1.5 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-all"
                          title="Edit phase"
                          aria-label={`Edit ${phase.title}`}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPhaseDeleteTarget(phase); }}
                          className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Delete phase"
                          aria-label={`Delete ${phase.title}`}
                        >
                          <Trash2 size={13} />
                        </button>
                        <ChevronRight size={16} className="text-surface-600 group-hover:text-surface-300 transition-colors" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Edit / Delete roadmap */}
      <AnimatePresence>
        {showEdit && (
          <EditRoadmapModal roadmap={roadmap} onClose={() => setShowEdit(false)} />
        )}
        {confirmDelete && (
          <ConfirmDialog
            open
            title="Delete Roadmap?"
            description={`This permanently removes "${roadmap.title}" along with its phases and milestones. Linked tasks stay on your board but will be unlinked.`}
            confirmLabel="Delete"
            busy={deleting}
            onCancel={() => { if (!deleting) setConfirmDelete(false); }}
            onConfirm={handleDelete}
          />
        )}
      </AnimatePresence>

      {/* Phase management */}
      <AnimatePresence>
        {phaseFormTarget && (
          <PhaseFormModal
            roadmapId={roadmap._id}
            phase={phaseFormTarget === 'create' ? null : phaseFormTarget}
            onClose={() => setPhaseFormTarget(null)}
          />
        )}
        {phaseDeleteTarget && (
          <ConfirmDialog
            open
            title="Delete Phase?"
            description={`This removes "${phaseDeleteTarget.title}" and its milestones. Tasks stay on your board but will be unlinked from this phase.`}
            confirmLabel="Delete"
            busy={phaseDeleting}
            onCancel={() => { if (!phaseDeleting) setPhaseDeleteTarget(null); }}
            onConfirm={handleDeletePhase}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
