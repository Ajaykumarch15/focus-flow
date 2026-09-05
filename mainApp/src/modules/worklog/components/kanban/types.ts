export type KanbanStatus = 'todo' | 'doing' | 'review' | 'done';
export type KanbanPriority = 'low' | 'medium' | 'high' | 'urgent';
export type KanbanView = 'board' | 'list' | 'calendar';
export type SortBy = 'default' | 'priority' | 'dueDate' | 'createdAt';

export interface KanbanLabel {
  name: string;
  color: string;
}

export interface KanbanAssignee {
  id: string;
  name: string;
  avatar?: string;
}

export interface KanbanSubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface KanbanTask {
  id: string;
  title: string;
  description: string;
  status: KanbanStatus;
  priority: KanbanPriority;
  labels: KanbanLabel[];
  assignees: KanbanAssignee[];
  dueDate?: string;
  subtasks: KanbanSubtask[];
  comments: number;
  attachments: number;
  createdAt: string;
  order: number;
}

export interface KanbanColumnData {
  id: KanbanStatus;
  title: string;
  color: string;
  dotColor: string;
}

export const KANBAN_COLUMNS: KanbanColumnData[] = [
  { id: 'todo', title: 'To Do', color: 'bg-surface-300', dotColor: 'bg-surface-400' },
  { id: 'doing', title: 'Doing', color: 'bg-orange-400', dotColor: 'bg-orange-400' },
  { id: 'review', title: 'In Review', color: 'bg-blue-400', dotColor: 'bg-blue-400' },
  { id: 'done', title: 'Done', color: 'bg-emerald-400', dotColor: 'bg-emerald-400' },
];

export const LABEL_PRESETS: KanbanLabel[] = [
  { name: 'Review', color: '#6366f1' },
  { name: 'Testing', color: '#f97316' },
  { name: 'UI Design', color: '#8b5cf6' },
  { name: 'Wireframe', color: '#06b6d4' },
  { name: 'Design system', color: '#10b981' },
  { name: 'Branding', color: '#ec4899' },
];

export const SAMPLE_ASSIGNEES: KanbanAssignee[] = [
  { id: 'u1', name: 'Ajay Kumar', avatar: undefined },
  { id: 'u2', name: 'Sarah Chen', avatar: undefined },
  { id: 'u3', name: 'Mike Ross', avatar: undefined },
  { id: 'u4', name: 'Emma Wilson', avatar: undefined },
];

export const SAMPLE_KANBAN_TASKS: KanbanTask[] = [
  {
    id: 'kt-1',
    title: 'Testing Menu Dashboard',
    description: 'Reviewing dashboard menu for the mailly product.',
    status: 'todo',
    priority: 'high',
    labels: [{ name: 'Review', color: '#6366f1' }, { name: 'Testing', color: '#f97316' }],
    assignees: [SAMPLE_ASSIGNEES[0], SAMPLE_ASSIGNEES[1]],
    dueDate: '2026-09-15',
    subtasks: [
      { id: 'st-1', title: 'Test navigation menu', completed: true },
      { id: 'st-2', title: 'Verify responsive layout', completed: true },
      { id: 'st-3', title: 'Check dark mode', completed: true },
      { id: 'st-4', title: 'Test dropdown menus', completed: true },
      { id: 'st-5', title: 'Verify icons', completed: true },
      { id: 'st-6', title: 'Test search functionality', completed: true },
      { id: 'st-7', title: 'Check notifications', completed: false },
      { id: 'st-8', title: 'Verify user menu', completed: false },
      { id: 'st-9', title: 'Test breadcrumbs', completed: false },
      { id: 'st-10', title: 'Check accessibility', completed: false },
      { id: 'st-11', title: 'Performance test', completed: false },
      { id: 'st-12', title: 'Cross-browser check', completed: false },
    ],
    comments: 12,
    attachments: 1,
    createdAt: '2026-09-01T10:00:00Z',
    order: 0,
  },
  {
    id: 'kt-2',
    title: 'Testing report error mail page',
    description: 'Reviewing dashboard menu for the mailly product.',
    status: 'todo',
    priority: 'medium',
    labels: [{ name: 'Review', color: '#6366f1' }, { name: 'Testing', color: '#f97316' }],
    assignees: [SAMPLE_ASSIGNEES[0], SAMPLE_ASSIGNEES[2]],
    dueDate: '2026-09-20',
    subtasks: [
      { id: 'st-13', title: 'Test error reporting', completed: true },
      { id: 'st-14', title: 'Verify email templates', completed: true },
      { id: 'st-15', title: 'Check mail delivery', completed: false },
      { id: 'st-16', title: 'Test retry logic', completed: false },
      { id: 'st-17', title: 'Verify error logging', completed: false },
      { id: 'st-18', title: 'Cross-browser check', completed: false },
    ],
    comments: 4,
    attachments: 2,
    createdAt: '2026-09-02T14:30:00Z',
    order: 1,
  },
  {
    id: 'kt-3',
    title: 'User list menu',
    description: 'This page showing user list for this product.',
    status: 'doing',
    priority: 'medium',
    labels: [{ name: 'UI Design', color: '#8b5cf6' }, { name: 'Wireframe', color: '#06b6d4' }],
    assignees: [SAMPLE_ASSIGNEES[1]],
    dueDate: '2026-09-18',
    subtasks: [
      { id: 'st-19', title: 'Design user list layout', completed: true },
      { id: 'st-20', title: 'Implement search filter', completed: false },
      { id: 'st-21', title: 'Add pagination', completed: false },
    ],
    comments: 3,
    attachments: 5,
    createdAt: '2026-09-03T09:15:00Z',
    order: 0,
  },
  {
    id: 'kt-4',
    title: 'FnQ list menu',
    description: 'This page showing FnQ list for this product.',
    status: 'review',
    priority: 'low',
    labels: [{ name: 'Review', color: '#6366f1' }, { name: 'UI Design', color: '#8b5cf6' }],
    assignees: [SAMPLE_ASSIGNEES[0], SAMPLE_ASSIGNEES[3]],
    dueDate: '2026-09-12',
    subtasks: [
      { id: 'st-21', title: 'Create FAQ layout', completed: true },
      { id: 'st-22', title: 'Add accordion component', completed: true },
      { id: 'st-23', title: 'Implement search', completed: true },
      { id: 'st-24', title: 'Test responsive', completed: true },
      { id: 'st-25', title: 'Accessibility audit', completed: false },
    ],
    comments: 14,
    attachments: 3,
    createdAt: '2026-09-04T11:00:00Z',
    order: 0,
  },
  {
    id: 'kt-5',
    title: 'Help center menu',
    description: 'This page showing help center for this product.',
    status: 'review',
    priority: 'high',
    labels: [{ name: 'Review', color: '#6366f1' }, { name: 'UI Design', color: '#8b5cf6' }],
    assignees: [SAMPLE_ASSIGNEES[2]],
    dueDate: '2026-09-14',
    subtasks: [
      { id: 'st-26', title: 'Design help center layout', completed: true },
      { id: 'st-27', title: 'Create article templates', completed: true },
      { id: 'st-28', title: 'Implement search', completed: true },
      { id: 'st-29', title: 'Add category navigation', completed: true },
      { id: 'st-30', title: 'Test responsive design', completed: true },
      { id: 'st-31', title: 'Verify dark mode', completed: true },
      { id: 'st-32', title: 'Accessibility check', completed: true },
      { id: 'st-33', title: 'Performance optimization', completed: false },
    ],
    comments: 14,
    attachments: 6,
    createdAt: '2026-09-05T08:45:00Z',
    order: 1,
  },
  {
    id: 'kt-6',
    title: 'Create fondation color',
    description: 'All about Fondation color for make the designer easy to work',
    status: 'done',
    priority: 'medium',
    labels: [{ name: 'Design system', color: '#10b981' }],
    assignees: [SAMPLE_ASSIGNEES[1], SAMPLE_ASSIGNEES[3]],
    dueDate: '2026-09-08',
    subtasks: [
      { id: 'st-34', title: 'Define primary palette', completed: true },
      { id: 'st-35', title: 'Create color tokens', completed: true },
      { id: 'st-36', title: 'Build color picker', completed: true },
    ],
    comments: 5,
    attachments: 3,
    createdAt: '2026-08-28T16:00:00Z',
    order: 0,
  },
  {
    id: 'kt-7',
    title: 'Branding, visual identity for brand',
    description: 'Branding for the brand',
    status: 'done',
    priority: 'low',
    labels: [{ name: 'Branding', color: '#ec4899' }],
    assignees: [SAMPLE_ASSIGNEES[0], SAMPLE_ASSIGNEES[2]],
    dueDate: '2026-09-06',
    subtasks: [
      { id: 'st-37', title: 'Create logo variations', completed: true },
      { id: 'st-38', title: 'Define brand guidelines', completed: true },
      { id: 'st-39', title: 'Build brand kit', completed: true },
    ],
    comments: 5,
    attachments: 3,
    createdAt: '2026-08-25T12:00:00Z',
    order: 1,
  },
  {
    id: 'kt-8',
    title: 'Dashboard analytics widget',
    description: 'Build analytics dashboard widget for real-time data visualization.',
    status: 'todo',
    priority: 'urgent',
    labels: [{ name: 'UI Design', color: '#8b5cf6' }, { name: 'Testing', color: '#f97316' }],
    assignees: [SAMPLE_ASSIGNEES[0]],
    dueDate: '2026-09-22',
    subtasks: [
      { id: 'st-40', title: 'Design chart components', completed: false },
      { id: 'st-41', title: 'Implement data fetching', completed: false },
      { id: 'st-42', title: 'Add real-time updates', completed: false },
      { id: 'st-43', title: 'Test with mock data', completed: false },
    ],
    comments: 2,
    attachments: 0,
    createdAt: '2026-09-05T15:30:00Z',
    order: 2,
  },
  {
    id: 'kt-9',
    title: 'Notification system overhaul',
    description: 'Redesign notification system with better grouping and priority.',
    status: 'doing',
    priority: 'high',
    labels: [{ name: 'UI Design', color: '#8b5cf6' }],
    assignees: [SAMPLE_ASSIGNEES[3], SAMPLE_ASSIGNEES[1]],
    dueDate: '2026-09-25',
    subtasks: [
      { id: 'st-44', title: 'Design notification center', completed: true },
      { id: 'st-45', title: 'Implement grouping logic', completed: true },
      { id: 'st-46', title: 'Add priority levels', completed: false },
      { id: 'st-47', title: 'Test push notifications', completed: false },
    ],
    comments: 8,
    attachments: 2,
    createdAt: '2026-09-04T10:00:00Z',
    order: 1,
  },
];
