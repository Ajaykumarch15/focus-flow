import type { LucideIcon } from 'lucide-react';
import { User, Briefcase, Users } from 'lucide-react';

export type WorkspaceType = 'personal' | 'work' | 'collab';

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
    route: '/dashboard',
    description: 'Your goals, learning & personal work',
  },
  work: {
    id: 'work',
    title: 'WorkLog',
    subtitle: 'Professional work, projects & career',
    icon: Briefcase,
    color: '#8b5cf6',
    route: '/worklog',
    description: 'Professional work, projects & career',
  },
  collab: {
    id: 'collab',
    title: 'Collab',
    subtitle: 'Team projects, shared tasks & collaboration',
    icon: Users,
    color: '#10b981',
    route: '/collab',
    description: 'Team projects, shared tasks & collaboration',
  },
};

export const WORKSPACE_LIST = Object.values(WORKSPACES);
