import { WorkLog } from '../../store/useWorkLogStore';
import { calculateWorkLogMetrics } from '../../utils/workLogMetrics';
import { Clock, CheckCircle2, Lightbulb, Target, BookOpen, GitBranch } from 'lucide-react';
import { format } from 'date-fns';

interface ReadingModeViewProps {
  workLog: WorkLog;
}

export function ReadingModeView({ workLog }: ReadingModeViewProps) {
  const metrics = calculateWorkLogMetrics(workLog);
  const flow = workLog.problemFlow || { problem: workLog.problem };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6 bg-surface-900/40 rounded-3xl border border-surface-800 shadow-xl font-sans text-surface-100 leading-relaxed">
      {/* Title & Metadata Header */}
      <div className="border-b border-surface-800 pb-6 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="badge bg-brand-500/10 text-brand-400 border border-brand-500/20 text-xs font-semibold uppercase tracking-wider">
            {workLog.status}
          </span>
          {workLog.gitBranch && (
            <span className="badge bg-surface-800 text-surface-300 text-xs font-mono">
              <GitBranch size={12} className="mr-1 inline" /> {workLog.gitBranch}
            </span>
          )}
          {workLog.projectRef?.name && (
            <span className="badge bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs">
              Project: {workLog.projectRef.name}
            </span>
          )}
        </div>

        <h1 className="text-3xl font-extrabold text-surface-50 tracking-tight">
          {workLog.title}
        </h1>

        <div className="flex items-center gap-4 text-xs text-surface-400 flex-wrap">
          <span>Date: {format(new Date(workLog.createdAt), 'EEEE, MMMM d, yyyy')}</span>
          <span>•</span>
          <span>Focus Time: <strong className="text-brand-400">{metrics.formattedTotalFocus}</strong> ({metrics.sessionCount} sessions)</span>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-surface-800/40 border border-surface-700/40 text-center">
          <span className="text-[10px] uppercase font-bold text-surface-400 block">Total Focus</span>
          <span className="text-base font-bold text-brand-400">{metrics.formattedTotalFocus}</span>
        </div>
        <div className="p-3 rounded-xl bg-surface-800/40 border border-surface-700/40 text-center">
          <span className="text-[10px] uppercase font-bold text-surface-400 block">Sessions</span>
          <span className="text-base font-bold text-surface-100">{metrics.sessionCount}</span>
        </div>
        <div className="p-3 rounded-xl bg-surface-800/40 border border-surface-700/40 text-center">
          <span className="text-[10px] uppercase font-bold text-surface-400 block">Deliverables</span>
          <span className="text-base font-bold text-emerald-400">{metrics.completedCount} / {metrics.totalItemsCount}</span>
        </div>
        <div className="p-3 rounded-xl bg-surface-800/40 border border-surface-700/40 text-center">
          <span className="text-[10px] uppercase font-bold text-surface-400 block">Blockers</span>
          <span className={`text-base font-bold ${metrics.openBlockerCount > 0 ? 'text-red-400' : 'text-surface-400'}`}>{metrics.openBlockerCount}</span>
        </div>
      </div>

      {/* Problem & Solution */}
      {(flow.problem || flow.solution) && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-surface-50 border-b border-surface-800/60 pb-1 flex items-center gap-2">
            <BookOpen size={18} className="text-brand-400" /> Problem & Solution
          </h2>
          {flow.problem && (
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-sm">
              <strong className="text-red-400 block mb-1">Problem:</strong>
              <p className="text-surface-200">{flow.problem}</p>
            </div>
          )}
          {flow.solution && (
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-sm">
              <strong className="text-emerald-400 block mb-1">Solution:</strong>
              <p className="text-surface-200">{flow.solution}</p>
            </div>
          )}
        </section>
      )}

      {/* Timeline */}
      {workLog.timelineEntries?.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-surface-50 border-b border-surface-800/60 pb-1 flex items-center gap-2">
            <Clock size={18} className="text-brand-400" /> Daily Timeline
          </h2>
          <div className="space-y-2">
            {workLog.timelineEntries.map(t => (
              <div key={t._id} className="flex items-baseline gap-3 text-xs">
                <span className="font-mono text-brand-400 font-semibold">{format(new Date(t.timestamp), 'h:mm a')}</span>
                <span className="font-semibold text-surface-100">{t.title}</span>
                {t.description && <span className="text-surface-400">— {t.description}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Technical Decisions */}
      {workLog.decisions?.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-surface-50 border-b border-surface-800/60 pb-1 flex items-center gap-2">
            <Lightbulb size={18} className="text-amber-400" /> Architecture Decisions
          </h2>
          <div className="space-y-3">
            {workLog.decisions.map(d => (
              <div key={d._id} className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1 text-xs">
                <h4 className="font-bold text-amber-300 text-sm">{d.title}</h4>
                {d.decision && <p className="text-surface-200"><strong className="text-amber-400">Decision: </strong>{d.decision}</p>}
                {d.rationale && <p className="text-surface-300"><strong className="text-surface-400">Rationale: </strong>{d.rationale}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Completed Items */}
      {workLog.completedItems?.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-surface-50 border-b border-surface-800/60 pb-1 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-400" /> Completed Deliverables
          </h2>
          <ul className="space-y-1 text-xs text-surface-200">
            {workLog.completedItems.map(item => (
              <li key={item._id} className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                <span className="badge bg-surface-800 text-surface-400 text-[10px] uppercase font-bold">{item.category}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Plan for Tomorrow */}
      {(workLog.tomorrowPlan?.topPriority || workLog.tomorrowPlan?.unfinishedItems?.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-surface-50 border-b border-surface-800/60 pb-1 flex items-center gap-2">
            <Target size={18} className="text-sky-400" /> Plan for Tomorrow
          </h2>
          {workLog.tomorrowPlan.topPriority && (
            <p className="text-xs text-surface-200"><strong className="text-sky-400">Top Priority: </strong>{workLog.tomorrowPlan.topPriority}</p>
          )}
          {workLog.tomorrowPlan.unfinishedItems?.map((u, i) => (
            <p key={i} className="text-xs text-surface-300">• {u}</p>
          ))}
        </section>
      )}
    </div>
  );
}
