import { format } from 'date-fns';
import type { WorkLog } from '@worklog/services/useWorkLogStore';
import type {
  DocumentModel, DocSection, DocMilestone, DocStats,
  DocTimelineEntry, DocDecision, DocBlocker, DocTomorrowPlan, DocReflection, DocAttachment,
} from './types';

const STATUS_LABELS: Record<string, string> = {
  'planning': 'Planning',
  'in-progress': 'In Progress',
  'reviewing': 'Reviewing',
  'blocked': 'Blocked',
  'done': 'Done',
};

function buildSections(log: WorkLog): DocSection[] {
  return [
    {
      id: 'problem',
      title: 'Problem Statement',
      icon: '🎯',
      content: log.problem || '',
      hidden: !log.problem,
    },
    {
      id: 'currentWork',
      title: 'Current Development',
      icon: '⚡',
      content: log.currentWork || '',
      hidden: !log.currentWork,
    },
    {
      id: 'designNotes',
      title: 'Architecture & Design Decisions',
      icon: '🏗️',
      content: log.designNotes || '',
      hidden: !log.designNotes,
    },
    {
      id: 'plan',
      title: 'Implementation Plan',
      icon: '📋',
      content: log.plan || '',
      hidden: !log.plan,
    },
    {
      id: 'gitBranch',
      title: 'Git Branch',
      icon: '🔀',
      content: log.gitBranch ? `Branch: \`${log.gitBranch}\`` : '',
      hidden: !log.gitBranch,
    },
  ];
}

function buildMilestones(log: WorkLog): DocMilestone[] {
  return log.completedItems.map(item => ({
    text: item.text,
    done: item.done,
    completedAt: item.createdAt,
  }));
}

function buildTimeline(log: WorkLog): DocTimelineEntry[] {
  return (log.timelineEntries || []).map(entry => ({
    timestamp: entry.timestamp ? format(new Date(entry.timestamp), 'MMM d, yyyy h:mm a') : '',
    title: entry.title || '',
    description: entry.description || '',
    type: entry.type || 'work',
  }));
}

function buildDecisions(log: WorkLog): DocDecision[] {
  return (log.decisions || []).map(d => ({
    title: d.title || '',
    context: d.context || '',
    decision: d.decision || '',
    rationale: d.rationale || '',
    alternatives: d.alternatives || '',
  }));
}

function buildBlockerList(log: WorkLog): DocBlocker[] {
  return (log.blockerList || []).map(b => ({
    title: b.title || '',
    severity: b.severity || 'medium',
    status: b.status || 'open',
    notes: b.notes || '',
    createdAt: b.createdAt ? format(new Date(b.createdAt), 'MMM d, yyyy') : '',
    resolvedAt: b.resolvedAt ? format(new Date(b.resolvedAt), 'MMM d, yyyy') : undefined,
  }));
}

function buildTomorrowPlan(log: WorkLog): DocTomorrowPlan | null {
  const tp = log.tomorrowPlan;
  if (!tp || (!tp.topPriority && (!tp.unfinishedItems || tp.unfinishedItems.length === 0) && !tp.attentionRequired)) {
    return null;
  }
  return {
    topPriority: tp.topPriority || '',
    unfinishedItems: tp.unfinishedItems || [],
    attentionRequired: tp.attentionRequired || '',
  };
}

function buildReflection(log: WorkLog): DocReflection | null {
  const r = log.reflection;
  if (!r || (!r.wentWell && !r.slowedDown && !r.learned && !r.improvement)) {
    return null;
  }
  return {
    wentWell: r.wentWell || '',
    slowedDown: r.slowedDown || '',
    learned: r.learned || '',
    improvement: r.improvement || '',
    rating: r.rating || 0,
  };
}

function buildAttachments(log: WorkLog): DocAttachment[] {
  return (log.attachments || []).map(a => ({
    name: a.name || '',
    url: a.url || '',
    type: a.type || '',
    description: a.description || '',
  }));
}

function buildStats(log: WorkLog, sections: DocSection[], milestones: DocMilestone[]): DocStats {
  const visibleSections = sections.filter(s => !s.hidden);
  const sectionsWritten = visibleSections.filter(s => s.content.trim().length > 0).length;
  const completedMilestones = milestones.filter(m => m.done).length;
  const totalDays = log.workEntries.length;
  const openBlockers = (log.blockerList || []).filter(b => b.status !== 'resolved').length;

  return {
    sectionsWritten,
    totalSections: visibleSections.length,
    completedMilestones,
    totalMilestones: milestones.length,
    totalDays,
    totalTimeMs: log.totalActiveMs,
    blockersPresent: openBlockers > 0,
    completionPercent: milestones.length > 0
      ? Math.round((completedMilestones / milestones.length) * 100)
      : (log.status === 'done' ? 100 : 0),
    decisionCount: (log.decisions || []).length,
    openBlockerCount: openBlockers,
  };
}

export function mapWorkLogToDocument(log: WorkLog, author = 'FocusFlow User'): DocumentModel {
  const sections = buildSections(log);
  const milestones = buildMilestones(log);
  const stats = buildStats(log, sections, milestones);

  return {
    meta: {
      title: log.title,
      projectName: log.projectRef?.name || 'General',
      featureName: log.title,
      branch: log.gitBranch || '',
      status: log.status,
      statusLabel: STATUS_LABELS[log.status] || log.status,
      startedAt: log.createdAt ? format(new Date(log.createdAt), 'MMM d, yyyy') : '—',
      updatedAt: log.updatedAt ? format(new Date(log.updatedAt), 'MMM d, yyyy') : '—',
      generatedAt: format(new Date(), 'MMM d, yyyy \'at\' h:mm a'),
      author,
    },
    sections,
    milestones,
    workEntries: log.workEntries.map(e => ({
      date: format(new Date(e.date), 'MMM d, yyyy'),
      what: e.what || '',
      activeMs: e.activeMs,
    })),
    links: log.links.map(l => ({ label: l.label, url: l.url })),
    stats,
    timeline: buildTimeline(log),
    decisions: buildDecisions(log),
    blockerList: buildBlockerList(log),
    tomorrowPlan: buildTomorrowPlan(log),
    reflection: buildReflection(log),
    attachments: buildAttachments(log),
    mood: log.mood || 0,
    tags: log.tags || [],
  };
}
