import type { WorkLogStatus } from '@worklog/services/useWorkLogStore';

export interface DocMeta {
  title: string;
  projectName: string;
  featureName: string;
  branch: string;
  status: WorkLogStatus;
  statusLabel: string;
  startedAt: string;
  updatedAt: string;
  generatedAt: string;
  author: string;
}

export interface DocSection {
  id: string;
  title: string;
  icon: string;
  content: string;
  hidden?: boolean;
}

export interface DocMilestone {
  text: string;
  done: boolean;
  completedAt?: number;
}

export interface DocWorkEntry {
  date: string;
  what: string;
  activeMs: number;
}

export interface DocLink {
  label: string;
  url: string;
}

export interface DocTimelineEntry {
  timestamp: string;
  title: string;
  description: string;
  type: string;
}

export interface DocDecision {
  title: string;
  context: string;
  decision: string;
  rationale: string;
  alternatives: string;
}

export interface DocBlocker {
  title: string;
  severity: string;
  status: string;
  notes: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface DocTomorrowPlan {
  topPriority: string;
  unfinishedItems: string[];
  attentionRequired: string;
}

export interface DocReflection {
  wentWell: string;
  slowedDown: string;
  learned: string;
  improvement: string;
  rating: number;
}

export interface DocAttachment {
  name: string;
  url: string;
  type: string;
  description: string;
}

export interface DocStats {
  sectionsWritten: number;
  totalSections: number;
  completedMilestones: number;
  totalMilestones: number;
  totalDays: number;
  totalTimeMs: number;
  blockersPresent: boolean;
  completionPercent: number;
  decisionCount: number;
  openBlockerCount: number;
}

export interface DocumentModel {
  meta: DocMeta;
  sections: DocSection[];
  milestones: DocMilestone[];
  workEntries: DocWorkEntry[];
  links: DocLink[];
  stats: DocStats;
  timeline: DocTimelineEntry[];
  decisions: DocDecision[];
  blockerList: DocBlocker[];
  tomorrowPlan: DocTomorrowPlan | null;
  reflection: DocReflection | null;
  attachments: DocAttachment[];
  mood: number;
  tags: string[];
}

export type TemplateType = 'developer' | 'client';

export interface TemplateDefinition {
  id: TemplateType;
  label: string;
  description: string;
  icon: string;
}

export const TEMPLATES: TemplateDefinition[] = [
  { id: 'developer', label: 'Developer Documentation', description: 'Technical documentation for engineering teams', icon: 'code' },
  { id: 'client', label: 'Client Progress Report', description: 'Professional progress report for stakeholders', icon: 'briefcase' },
];
