import { format } from 'date-fns';
import type { WorkLog } from '../../store/useWorkLogStore';
import type { DocumentModel, DocSection, DocMilestone, DocStats } from './types';

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
    {
      id: 'blockers',
      title: 'Current Blockers',
      icon: '🚧',
      content: log.blockers || '',
      hidden: !log.blockers,
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

function buildStats(log: WorkLog, sections: DocSection[], milestones: DocMilestone[]): DocStats {
  const visibleSections = sections.filter(s => !s.hidden);
  const sectionsWritten = visibleSections.filter(s => s.content.trim().length > 0).length;
  const completedMilestones = milestones.filter(m => m.done).length;
  const totalDays = log.workEntries.length;

  return {
    sectionsWritten,
    totalSections: visibleSections.length,
    completedMilestones,
    totalMilestones: milestones.length,
    totalDays,
    totalTimeMs: log.totalActiveMs,
    blockersPresent: !!log.blockers && log.blockers.trim().length > 0,
    completionPercent: milestones.length > 0
      ? Math.round((completedMilestones / milestones.length) * 100)
      : (log.status === 'done' ? 100 : 0),
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
  };
}
