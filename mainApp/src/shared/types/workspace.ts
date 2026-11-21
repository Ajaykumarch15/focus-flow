import type { LucideIcon } from 'lucide-react';
import { User, Briefcase } from 'lucide-react';

export type WorkspaceType = 'personal' | 'work';

export interface WorkspaceConfig {
  id: WorkspaceType;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  color: string;
  route: string;
  description: string;
}

export const WORKSPACES: Record<WorkspaceType, WorkspaceConfig> = {
  personal: {
    id: 'personal',
    title: 'Personal',
    subtitle: 'Your goals, learning & personal work',
    icon: User,
    color: '#0ea5e9',
    route: '/personal',
    description: 'Your goals, learning & personal work',
  },
  work: {
    id: 'work',
    title: 'WorkLog',
    subtitle: 'Professional work, projects & career',
    icon: Briefcase,
    color: '#8b5cf6',
    route: '/worklog/dashboard',
    description: 'Professional work, projects & career',
  },
};

export const WORKSPACE_LIST = Object.values(WORKSPACES);
