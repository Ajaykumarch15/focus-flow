import type { WorkLog, WorkEntry } from '@worklog/services/useWorkLogStore';

/**
 * Maps a raw API work-log document into the normalized WorkLog shape
 * used across the app. Single source of truth for doc → WorkLog mapping.
 */
export function mapLog(doc: any): WorkLog {
  const pFlow = doc.problemFlow || {};
  const gRef = doc.gitRef || {};
  const tPlan = doc.tomorrowPlan || {};
  const ref = doc.reflection || {};
  const mMets = doc.moodMetrics || {};

  return {
    _id: doc._id,
    title: doc.title || 'Untitled Work Item',
    taskRef: doc.taskRef ? {
      _id: doc.taskRef._id,
      title: doc.taskRef.title,
      color: doc.taskRef.color || '#0ea5e9',
      category: doc.taskRef.category || 'Work',
      totalTime: doc.taskRef.totalTime || 0,
    } : undefined,
    projectRef: doc.projectRef ? {
      _id: doc.projectRef._id,
      name: doc.projectRef.name,
      googleFolderId: doc.projectRef.googleFolderId,
      workLogsFolderId: doc.projectRef.workLogsFolderId,
    } : undefined,
    googleDocId: doc.googleDocId || '',
    googleDocUrl: doc.googleDocUrl || '',

    problemFlow: {
      problem: pFlow.problem || doc.problem || '',
      investigation: pFlow.investigation || '',
      rootCause: pFlow.rootCause || '',
      solution: pFlow.solution || '',
      lessonsLearned: pFlow.lessonsLearned || '',
    },
    problem: doc.problem || '',
    gitBranch: doc.gitBranch || doc.gitRef?.branch || '',
    currentWork: doc.currentWork || '',
    plan: doc.plan || '',
    designNotes: doc.designNotes || '',
    blockers: doc.blockers || '',

    gitRef: {
      repository: gRef.repository || '',
      branch: gRef.branch || doc.gitBranch || '',
      commitIds: gRef.commitIds || [],
      prNumber: gRef.prNumber || '',
      issueNumber: gRef.issueNumber || '',
    },

    timelineEntries: (doc.timelineEntries || []).map((t: any) => ({
      _id: t._id,
      timestamp: t.timestamp || Date.now(),
      type: t.type || 'note',
      title: t.title || 'Event',
      description: t.description || '',
      category: t.category || 'General',
      metadata: t.metadata,
    })).sort((a: any, b: any) => b.timestamp - a.timestamp),

    decisions: (doc.decisions || []).map((d: any) => ({
      _id: d._id,
      title: d.title || '',
      context: d.context || '',
      decision: d.decision || '',
      alternatives: d.alternatives || '',
      rationale: d.rationale || '',
      timestamp: d.timestamp || Date.now(),
    })),

    blockerList: (doc.blockerList || []).map((b: any) => ({
      _id: b._id,
      title: b.title || '',
      severity: b.severity || 'medium',
      status: b.status || 'open',
      notes: b.notes || '',
      resolvedAt: b.resolvedAt,
      createdAt: b.createdAt || Date.now(),
    })),

    progressSnapshots: (doc.progressSnapshots || []).map((ps: any) => ({
      _id: ps._id,
      period: ps.period || 'Morning',
      text: ps.text || '',
      timestamp: ps.timestamp || Date.now(),
    })),

    completedItems: (doc.completedItems || []).map((i: any) => ({
      _id: i._id,
      text: i.text,
      category: i.category || 'feature',
      done: i.done ?? true,
      completedAt: new Date(i.completedAt || Date.now()).getTime(),
      createdAt: new Date(i.createdAt || Date.now()).getTime(),
    })),

    links: (doc.links || []).map((l: any) => ({
      _id: l._id,
      label: l.label,
      url: l.url,
      category: l.category || 'General',
    })),

    attachments: (doc.attachments || []).map((a: any) => ({
      _id: a._id,
      name: a.name,
      type: a.type || 'file',
      url: a.url,
      sizeBytes: a.sizeBytes || 0,
      uploadDate: a.uploadDate || Date.now(),
      description: a.description || '',
    })),

    workEntries: (doc.workEntries || []).map((e: any): WorkEntry => ({
      _id: e._id,
      date: e.date,
      what: e.what || '',
      startedAt: e.startedAt,
      endedAt: e.endedAt,
      activeMs: e.activeMs || 0,
    })).sort((a: WorkEntry, b: WorkEntry) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ),

    tomorrowPlan: {
      topPriority: tPlan.topPriority || '',
      unfinishedItems: tPlan.unfinishedItems || [],
      attentionRequired: tPlan.attentionRequired || '',
    },

    reflection: {
      wentWell: ref.wentWell || '',
      slowedDown: ref.slowedDown || '',
      learned: ref.learned || '',
      improvement: ref.improvement || '',
      rating: ref.rating || 4,
    },

    moodMetrics: {
      energy: mMets.energy || 3,
      focus: mMets.focus || 4,
      stress: mMets.stress || 2,
      confidence: mMets.confidence || 4,
      motivation: mMets.motivation || 4,
    },

    totalActiveMs: doc.totalActiveMs || 0,
    status: doc.status || 'in-progress',
    isActive: doc.isActive ?? true,
    closedAt: doc.closedAt,
    reopenedAt: doc.reopenedAt,
    mood: doc.mood || 3,
    tags: doc.tags || [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
