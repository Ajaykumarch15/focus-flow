export type ProjectStatus = 'active' | 'in_progress' | 'completed' | 'on_hold';

export type ProjectType =
  | 'Web App'
  | 'Mobile'
  | 'UI/UX'
  | 'Internal'
  | 'Client'
  | 'Research'
  | 'Website'
  | 'Dashboard'
  | 'Tools';

export type CardTint = 'purple' | 'green' | 'pink' | 'blue' | 'orange' | 'gray';

export interface ProjectData {
  id: string;
  name: string;
  client: string;
  description: string;
  type: ProjectType[];
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  tags: string[];
  completedTasks: number;
  totalTasks: number;
  progress: number;
  bookmarked: boolean;
  tint: CardTint;
  iconEmoji: string;
  memberIds?: string[];
}

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  in_progress: 'In Progress',
  completed: 'Completed',
  on_hold: 'On Hold',
};

const STATUS_MAP: Record<string, ProjectStatus> = {
  planning: 'active',
  active: 'in_progress',
  completed: 'completed',
  on_hold: 'on_hold',
};

const TINT_OPTIONS: CardTint[] = ['purple', 'green', 'pink', 'blue', 'orange', 'gray'];

export function mapProjectToCardData(project: any, tasks: any[]): ProjectData {
  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const completedTasks = projectTasks.filter((t) => t.status === 'done').length;
  const totalTasks = projectTasks.length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    id: project.id,
    name: project.name,
    client: project.key || 'Workspace',
    description: project.description || '',
    type: ['Internal'],
    status: STATUS_MAP[project.status] || 'active',
    startDate: project.createdAt || new Date().toISOString(),
    endDate: new Date().toISOString(),
    tags: [],
    completedTasks,
    totalTasks,
    progress,
    bookmarked: false,
    tint: TINT_OPTIONS[Math.floor(Math.random() * TINT_OPTIONS.length)],
    iconEmoji: project.key?.charAt(0) || project.name.charAt(0),
    memberIds: (project.members ?? []).map((m: any) => String(m.userId ?? m._id ?? m.id ?? m)),
  };
}

export const SAMPLE_PROJECTS: ProjectData[] = [
  {
    id: 'proj-1',
    name: 'Zerro PDF Service',
    client: 'Zerro Technologies',
    description: 'PDF generation and digital signature service for project reports.',
    type: ['Web App', 'Internal'],
    status: 'active',
    startDate: '2026-05-20',
    endDate: '2026-08-15',
    tags: ['Web App', 'Internal', 'Active'],
    completedTasks: 8,
    totalTasks: 12,
    progress: 67,
    bookmarked: false,
    tint: 'purple',
    iconEmoji: 'Z',
  },
  {
    id: 'proj-2',
    name: 'Client Portal',
    client: 'Google',
    description: 'A unified portal for client collaboration and document sharing.',
    type: ['Web App', 'Client'],
    status: 'in_progress',
    startDate: '2026-02-04',
    endDate: '2026-07-30',
    tags: ['Web App', 'Client', 'Planning'],
    completedTasks: 2,
    totalTasks: 10,
    progress: 20,
    bookmarked: false,
    tint: 'green',
    iconEmoji: 'G',
  },
  {
    id: 'proj-3',
    name: 'Design System',
    client: 'Dribbble',
    description: 'Build a reusable component library for faster development.',
    type: ['UI/UX', 'Internal'],
    status: 'in_progress',
    startDate: '2026-01-29',
    endDate: '2026-06-15',
    tags: ['UI/UX', 'Internal', 'In Progress'],
    completedTasks: 6,
    totalTasks: 8,
    progress: 75,
    bookmarked: false,
    tint: 'pink',
    iconEmoji: 'D',
  },
  {
    id: 'proj-4',
    name: 'Marketing Website',
    client: 'Twitter',
    description: 'Corporate website redesign with modern UI and improved performance.',
    type: ['Website', 'Client'],
    status: 'completed',
    startDate: '2026-04-11',
    endDate: '2026-07-20',
    tags: ['Website', 'Client', 'Completed'],
    completedTasks: 10,
    totalTasks: 10,
    progress: 100,
    bookmarked: false,
    tint: 'blue',
    iconEmoji: 'X',
  },
  {
    id: 'proj-5',
    name: 'Mobile App',
    client: 'Airbnb',
    description: 'iOS and Android app for seamless travel experience.',
    type: ['Mobile', 'Client'],
    status: 'in_progress',
    startDate: '2026-04-02',
    endDate: '2026-09-30',
    tags: ['Mobile', 'Client', 'In Progress'],
    completedTasks: 5,
    totalTasks: 14,
    progress: 36,
    bookmarked: false,
    tint: 'orange',
    iconEmoji: 'A',
  },
  {
    id: 'proj-6',
    name: 'Analytics Dashboard',
    client: 'Apple',
    description: 'Real-time analytics dashboard for product insights.',
    type: ['Dashboard', 'Internal'],
    status: 'on_hold',
    startDate: '2026-01-18',
    endDate: '2026-05-10',
    tags: ['Dashboard', 'Internal', 'On Hold'],
    completedTasks: 3,
    totalTasks: 9,
    progress: 33,
    bookmarked: false,
    tint: 'gray',
    iconEmoji: 'A',
  },
  {
    id: 'proj-7',
    name: 'AI Research Platform',
    client: 'Microsoft',
    description: 'AI powered platform for research and data analysis.',
    type: ['Research', 'Client'],
    status: 'active',
    startDate: '2026-06-05',
    endDate: '2026-12-20',
    tags: ['Research', 'Client', 'Planning'],
    completedTasks: 1,
    totalTasks: 8,
    progress: 12,
    bookmarked: false,
    tint: 'purple',
    iconEmoji: 'M',
  },
  {
    id: 'proj-8',
    name: 'E-commerce Solution',
    client: 'Shopify',
    description: 'Scalable e-commerce platform with payment integration.',
    type: ['Web App', 'Client'],
    status: 'in_progress',
    startDate: '2026-03-14',
    endDate: '2026-08-25',
    tags: ['Web App', 'Client', 'In Progress'],
    completedTasks: 4,
    totalTasks: 11,
    progress: 36,
    bookmarked: false,
    tint: 'green',
    iconEmoji: 'S',
  },
  {
    id: 'proj-9',
    name: 'Internal Tools',
    client: 'Figma',
    description: 'Collection of productivity tools for internal use.',
    type: ['Tools', 'Internal'],
    status: 'active',
    startDate: '2026-01-10',
    endDate: '2026-04-30',
    tags: ['Tools', 'Internal', 'Active'],
    completedTasks: 7,
    totalTasks: 10,
    progress: 70,
    bookmarked: false,
    tint: 'blue',
    iconEmoji: 'F',
  },
];
