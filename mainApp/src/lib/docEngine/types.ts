import type { WorkLog, WorkLogStatus } from '../../store/useWorkLogStore';

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

export interface DocStats {
  sectionsWritten: number;
  totalSections: number;
  completedMilestones: number;
  totalMilestones: number;
  totalDays: number;
  totalTimeMs: number;
  blockersPresent: boolean;
  completionPercent: number;
}

export interface DocumentModel {
  meta: DocMeta;
  sections: DocSection[];
  milestones: DocMilestone[];
  workEntries: DocWorkEntry[];
  links: DocLink[];
  stats: DocStats;
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
