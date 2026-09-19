import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Users, FolderOpen, LayoutGrid, Settings, Activity,
  ChevronRight, Folder, Plus, BookOpen, UserPlus, Kanban,
  Clock, FileText,
} from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useWorkspaceId } from '@collab/hooks/useWorkspaceId';
import { useWorkspacePath } from '@collab/hooks/useWorkspacePath';
import { Button } from '@shared/components/ui/Button';
import { Badge } from '@shared/components/ui/Badge';
import { Avatar } from '@shared/components/ui/Avatar';
import { cn } from '@shared/utils/cn';

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } } };
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

const SECTION_CARDS = [
  {
    id: 'overview',
    title: 'Overview',
    description: 'Dashboard with stats, recent projects, and quick links',
    icon: LayoutGrid,
    sub: 'dashboard',
    tags: ['View progress', 'Key insights'],
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
    cardBg: 'bg-blue-50 dark:bg-surface-900/80',
    cardBorder: 'border-blue-200 dark:border-surface-800',
  },
  {
    id: 'projects',
    title: 'Projects',
    description: 'Manage projects, kanban boards, and task tracking',
    icon: FolderOpen,
    sub: 'projects',
    tags: ['Organize', 'Track', 'Deliver'],
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
    cardBg: 'bg-emerald-50 dark:bg-surface-900/80',
    cardBorder: 'border-emerald-200 dark:border-surface-800',
  },
  {
    id: 'people',
    title: 'People',
    description: 'Team members, roles, and member management',
    icon: Users,
    sub: 'people',
    tags: ['Collaborate', 'Assign', 'Grow'],
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-500',
    cardBg: 'bg-orange-50 dark:bg-surface-900/80',
    cardBorder: 'border-orange-200 dark:border-surface-800',
  },
  {
    id: 'activity',
    title: 'Activity',
    description: 'Live feed of workspace events and updates',
    icon: Activity,
    sub: 'activity',
    tags: ['Real-time activity', 'Stay informed'],
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    cardBg: 'bg-purple-50 dark:bg-surface-900/80',
    cardBorder: 'border-purple-200 dark:border-surface-800',
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Workspace configuration, edit details, and danger zone',
    icon: Settings,
    sub: 'settings',
    tags: ['Configure', 'Customize', 'Control'],
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-500',
    cardBg: 'bg-rose-50 dark:bg-surface-900/80',
    cardBorder: 'border-rose-200 dark:border-surface-800',
  },
];

const QUICK_LINKS = [
  { label: 'Create New Project', icon: Plus, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { label: 'View Documentation', icon: BookOpen, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { label: 'Invite Members', icon: UserPlus, color: 'text-violet-500', bg: 'bg-violet-500/10' },
  { label: 'Open Kanban Board', icon: Kanban, color: 'text-amber-500', bg: 'bg-amber-500/10' },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
  return `${Math.floor(diff / 86400000)} days ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function HeroIllustration() {
  return (
    <svg viewBox="0 0 400 200" fill="none" className="w-full h-full" aria-hidden="true">
      {/* Background grid pattern */}
      <defs>
        <pattern id="hub-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-surface-700/30" />
        </pattern>
        <linearGradient id="hub-grad-1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id="hub-grad-2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0284c7" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill="url(#hub-grid)" />

      {/* Building blocks - abstract workspace shapes */}
      <rect x="40" y="80" width="60" height="100" rx="8" fill="url(#hub-grad-1)" stroke="#0ea5e9" strokeWidth="1" strokeOpacity="0.5" />
      <rect x="50" y="90" width="40" height="20" rx="4" fill="#0ea5e9" fillOpacity="0.35" />
      <rect x="50" y="120" width="40" height="12" rx="3" fill="#0ea5e9" fillOpacity="0.25" />
      <rect x="50" y="140" width="40" height="12" rx="3" fill="#0ea5e9" fillOpacity="0.2" />

      <rect x="110" y="50" width="70" height="130" rx="8" fill="url(#hub-grad-2)" stroke="#0284c7" strokeWidth="1" strokeOpacity="0.5" />
      <rect x="120" y="60" width="50" height="24" rx="4" fill="#0284c7" fillOpacity="0.35" />
      <rect x="120" y="94" width="50" height="14" rx="3" fill="#0284c7" fillOpacity="0.25" />
      <rect x="120" y="116" width="50" height="14" rx="3" fill="#0284c7" fillOpacity="0.2" />
      <rect x="120" y="138" width="50" height="14" rx="3" fill="#0284c7" fillOpacity="0.18" />

      <rect x="190" y="70" width="55" height="110" rx="8" fill="url(#hub-grad-1)" stroke="#8b5cf6" strokeWidth="1" strokeOpacity="0.4" />
      <rect x="198" y="80" width="38" height="18" rx="4" fill="#8b5cf6" fillOpacity="0.3" />
      <rect x="198" y="106" width="38" height="10" rx="3" fill="#8b5cf6" fillOpacity="0.22" />
      <rect x="198" y="124" width="38" height="10" rx="3" fill="#8b5cf6" fillOpacity="0.18" />

      {/* Connecting lines */}
      <path d="M100 130 L110 130" stroke="#0ea5e9" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="4 4" />
      <path d="M180 110 L190 110" stroke="#0284c7" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="4 4" />

      {/* Floating dots */}
      <circle cx="280" cy="60" r="4" fill="#0ea5e9" fillOpacity="0.5" />
      <circle cx="300" cy="90" r="3" fill="#8b5cf6" fillOpacity="0.4" />
      <circle cx="320" cy="50" r="5" fill="#06b6d4" fillOpacity="0.35" />
      <circle cx="340" cy="100" r="3" fill="#0284c7" fillOpacity="0.45" />
      <circle cx="360" cy="70" r="4" fill="#0ea5e9" fillOpacity="0.3" />

      {/* Decorative arc */}
      <path d="M260 160 Q320 40 380 120" stroke="#0ea5e9" strokeWidth="1" strokeOpacity="0.35" fill="none" />
    </svg>
  );
}

function CardIllustration({ type }: { type: string }) {
  switch (type) {
    case 'overview':
      return (
        <svg viewBox="0 0 120 80" fill="none" className="w-full h-full" aria-hidden="true">
          <rect x="10" y="50" width="16" height="24" rx="3" fill="#3b82f6" fillOpacity="0.4" />
          <rect x="32" y="35" width="16" height="39" rx="3" fill="#3b82f6" fillOpacity="0.55" />
          <rect x="54" y="20" width="16" height="54" rx="3" fill="#3b82f6" fillOpacity="0.7" />
          <rect x="76" y="30" width="16" height="44" rx="3" fill="#3b82f6" fillOpacity="0.55" />
          <rect x="98" y="40" width="16" height="34" rx="3" fill="#3b82f6" fillOpacity="0.4" />
          <line x1="10" y1="50" x2="114" y2="50" stroke="#3b82f6" strokeWidth="0.5" strokeOpacity="0.4" />
        </svg>
      );
    case 'projects':
      return (
        <svg viewBox="0 0 120 80" fill="none" className="w-full h-full" aria-hidden="true">
          <rect x="20" y="15" width="80" height="50" rx="8" fill="#10b981" fillOpacity="0.2" stroke="#10b981" strokeWidth="0.8" strokeOpacity="0.35" />
          <rect x="30" y="22" width="35" height="10" rx="3" fill="#10b981" fillOpacity="0.35" />
          <rect x="30" y="38" width="60" height="6" rx="2" fill="#10b981" fillOpacity="0.22" />
          <rect x="30" y="48" width="45" height="6" rx="2" fill="#10b981" fillOpacity="0.18" />
          <rect x="30" y="58" width="50" height="6" rx="2" fill="#10b981" fillOpacity="0.15" />
        </svg>
      );
    case 'people':
      return (
        <svg viewBox="0 0 120 80" fill="none" className="w-full h-full" aria-hidden="true">
          <circle cx="40" cy="30" r="12" fill="#8b5cf6" fillOpacity="0.35" />
          <circle cx="40" cy="55" r="8" fill="#8b5cf6" fillOpacity="0.25" />
          <circle cx="75" cy="28" r="10" fill="#8b5cf6" fillOpacity="0.3" />
          <circle cx="75" cy="52" r="7" fill="#8b5cf6" fillOpacity="0.2" />
          <circle cx="100" cy="35" r="8" fill="#8b5cf6" fillOpacity="0.25" />
        </svg>
      );
    case 'activity':
      return (
        <svg viewBox="0 0 120 80" fill="none" className="w-full h-full" aria-hidden="true">
          <circle cx="25" cy="25" r="6" fill="#f59e0b" fillOpacity="0.35" />
          <rect x="38" y="22" width="60" height="6" rx="2" fill="#f59e0b" fillOpacity="0.25" />
          <circle cx="25" cy="45" r="6" fill="#f59e0b" fillOpacity="0.3" />
          <rect x="38" y="42" width="50" height="6" rx="2" fill="#f59e0b" fillOpacity="0.2" />
          <circle cx="25" cy="65" r="6" fill="#f59e0b" fillOpacity="0.25" />
          <rect x="38" y="62" width="55" height="6" rx="2" fill="#f59e0b" fillOpacity="0.18" />
        </svg>
      );
    case 'settings':
      return (
        <svg viewBox="0 0 120 80" fill="none" className="w-full h-full" aria-hidden="true">
          <circle cx="60" cy="40" r="18" fill="none" stroke="#f43f5e" strokeWidth="1" strokeOpacity="0.35" />
          <circle cx="60" cy="40" r="10" fill="#f43f5e" fillOpacity="0.25" />
          <circle cx="60" cy="40" r="4" fill="#f43f5e" fillOpacity="0.4" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <rect
              key={deg}
              x="58"
              y="18"
              width="4"
              height="8"
              rx="2"
              fill="#f43f5e"
              fillOpacity="0.3"
              transform={`rotate(${deg} 60 40)`}
            />
          ))}
        </svg>
      );
    default:
      return null;
  }
}

export function WorkspaceHubPage() {
  const workspaceId = useWorkspaceId();
  const wsPath = useWorkspacePath();
  const navigate = useNavigate();
  const { workspaces, loadProjects, loadMembers, members, activities, loadWorkspaceActivity } = useCollaborationStore();

  const workspace = workspaces.find((w) => w.id === workspaceId);

  useEffect(() => {
    if (!workspaceId) return;
    useCollaborationStore.getState().loadWorkspaces().then(() => {
      const { workspaces, activeWorkspaceId } = useCollaborationStore.getState();
      const ws = workspaces.find((w) => w.id === activeWorkspaceId || w.slug === activeWorkspaceId);
      const resolvedId = ws?.id ?? workspaceId;
      loadProjects(resolvedId);
      loadMembers(resolvedId);
      loadWorkspaceActivity(resolvedId, { limit: 3 });
    });
  }, [workspaceId, loadProjects, loadMembers, loadWorkspaceActivity]);

  if (!workspace) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <FolderOpen size={40} className="mx-auto text-surface-500" />
          <h1 className="text-lg font-display font-bold text-surface-100">Workspace not found</h1>
          <p className="text-sm text-surface-400">This workspace does not exist or you don't have access.</p>
          <Button onClick={() => navigate('/collab/workspaces')} leftIcon={<ArrowLeft size={14} />}>
            Back to Workspaces
          </Button>
        </div>
      </div>
    );
  }

  const memberAvatars = members.slice(0, 5).map((m) => ({ name: m.name, src: m.avatar }));

  return (
    <div className="min-h-screen bg-surface-950 relative overflow-x-hidden overflow-y-auto">
      {/* Background gradients — dark-only */}
      <div className="absolute -top-40 -left-40 w-96 h-96 dark:bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-96 h-96 dark:bg-cyan-500/6 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-80 h-80 dark:bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 relative z-10 space-y-6 lg:space-y-8">
        {/* ── Hero Banner ──────────────────────────────────────────────── */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="relative overflow-hidden"
        >
          <div className="flex flex-col lg:flex-row">
            {/* Left: Workspace Info */}
            <div className="flex-1 p-6 lg:p-8 space-y-4">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 flex-shrink-0 flex items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/20">
                  <Folder size={24} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400 mb-0.5">Workspace</p>
                  <h1 className="font-display text-2xl lg:text-3xl font-bold text-surface-50 tracking-tight">
                    {workspace.name}
                  </h1>
                </div>
              </div>

              <p className="text-sm text-surface-400 leading-relaxed max-w-lg">
                {workspace.description || `Plan, build, and track everything for the ${workspace.name} team.`}
              </p>

              {/* Metadata chips */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-800 dark:bg-surface-800/60 text-xs font-medium text-surface-300">
                  <Users size={13} className="text-surface-400" />
                  {workspace.membersCount || members.length || 0} members
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-800 dark:bg-surface-800/60 text-xs font-medium text-surface-300">
                  <Clock size={13} className="text-surface-400" />
                  Created on {formatDate(workspace.createdAt)}
                </span>
                <Badge tone="success" className="text-[11px] px-2.5 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-success-500 inline-block" />
                  Active
                </Badge>
              </div>

              {/* Member avatars */}
              {memberAvatars.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex -space-x-2">
                    {memberAvatars.map((m, i) => (
                      <Avatar
                        key={`${m.name}-${i}`}
                        src={m.src}
                        name={m.name}
                        size="xs"
                        className="ring-2 ring-surface-900"
                      />
                    ))}
                  </div>
                  {members.length > 5 && (
                    <span className="text-[11px] text-surface-400">+{members.length - 5} more</span>
                  )}
                </div>
              )}
            </div>

            {/* Right: Illustration + Settings Button */}
            <div className="relative lg:w-[380px] flex-shrink-0 flex flex-col items-center justify-center p-6 lg:p-8">
              <div className="w-full max-w-[320px]">
                <HeroIllustration />
              </div>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Settings size={14} />}
                onClick={() => navigate(wsPath('settings'))}
                className="mt-4"
              >
                Workspace Settings
              </Button>
            </div>
          </div>
        </motion.section>

        {/* ── Workspace Tools ──────────────────────────────────────────── */}
        <motion.section variants={stagger} initial="hidden" animate="show">
          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-1 h-5 rounded-full bg-brand-500" />
                <h2 className="font-display text-lg font-bold text-surface-50">Workspace Tools</h2>
              </div>
              <p className="text-sm text-surface-400 ml-3.5">Everything you need, right here.</p>
            </div>
            <span className="text-xs text-surface-500 hidden sm:block">Choose a section to get started →</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SECTION_CARDS.map(({ id, title, description, icon: Icon, sub, tags, iconBg, iconColor, cardBg, cardBorder }) => (
              <motion.button
                key={id}
                variants={fadeUp}
                onClick={() => navigate(wsPath(sub))}
                className={cn(
                  'group/card relative flex flex-col rounded-2xl p-5 text-left',
                  'border', cardBorder, cardBg,
                  'backdrop-blur-sm shadow-sm transition-all duration-300 ease-snappy',
                  'hover:shadow-md hover:-translate-y-0.5 cursor-pointer',
                )}
              >
                {/* Card illustration */}
                <div className="absolute top-4 right-4 w-20 h-14 opacity-80 dark:opacity-60 group-hover/card:opacity-100 dark:group-hover/card:opacity-80 transition-opacity">
                  <CardIllustration type={id} />
                </div>

                <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl mb-3', iconBg)}>
                  <Icon size={18} className={iconColor} />
                </div>

                <h3 className="font-display text-base font-bold text-surface-50 mb-1 flex items-center gap-1.5">
                  {title}
                  <ChevronRight size={14} className="text-surface-500 opacity-0 -translate-x-1 group-hover/card:opacity-100 group-hover/card:translate-x-0 transition-all duration-200" />
                </h3>

                <p className="text-xs text-surface-400 leading-relaxed mb-3 flex-1 pr-16">{description}</p>

                <div className="flex items-center gap-1.5 text-[11px] text-surface-500">
                  {tags.map((tag, i) => (
                    <span key={tag} className="flex items-center gap-1">
                      {i > 0 && <span className="text-surface-600">·</span>}
                      <span className={cn(
                        'font-medium',
                        i === 0 ? iconColor : 'text-surface-500'
                      )}>{tag}</span>
                    </span>
                  ))}
                </div>
              </motion.button>
            ))}
          </div>
        </motion.section>

        {/* ── Bottom Section: Recent Activity + Quick Links ────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
          {/* Recent Activity */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="lg:col-span-3 p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-bold text-surface-50 flex items-center gap-2">
                <Clock size={15} className="text-surface-400" />
                Recent Activity
              </h3>
              <button
                onClick={() => navigate(wsPath('activity'))}
                className="text-xs font-medium text-brand-500 hover:text-brand-400 transition-colors flex items-center gap-1"
              >
                View All <ChevronRight size={12} />
              </button>
            </div>

            <div className="space-y-1">
              {activities.length === 0 ? (
                <p className="text-sm text-surface-500 text-center py-8">No recent activity yet</p>
              ) : (
                activities.slice(0, 3).map((a) => (
                  <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-850 dark:hover:bg-surface-800/40 transition-colors">
                    <Avatar src={a.actor.avatar} name={a.actor.name} size="xs" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-surface-300 truncate">
                        <span className="font-semibold text-surface-200">{a.actor.name}</span>{' '}
                        {a.action.replace(/[._]/g, ' ')}
                      </p>
                    </div>
                    <span className="text-[10px] text-surface-500 flex-shrink-0 whitespace-nowrap">
                      {timeAgo(a.timestamp)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="lg:col-span-2 p-5"
          >
            <h3 className="font-display text-sm font-bold text-surface-50 flex items-center gap-2 mb-4">
              <FileText size={15} className="text-surface-400" />
              Quick Links
            </h3>

            <div className="space-y-2">
              {QUICK_LINKS.map(({ label, icon: LinkIcon, color, bg }) => (
                <button
                  key={label}
                  onClick={() => {
                    if (label === 'Create New Project') navigate(wsPath('projects'));
                    else if (label === 'View Documentation') navigate(wsPath('projects'));
                    else if (label === 'Invite Members') navigate(wsPath('people'));
                    else if (label === 'Open Kanban Board') navigate(wsPath('projects'));
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-xl',
                    'border border-surface-800/60 bg-surface-850 dark:bg-surface-800/20',
                    'hover:bg-surface-800 dark:hover:bg-surface-800/50 hover:border-surface-700 transition-all duration-200',
                    'group/link cursor-pointer',
                  )}
                >
                  <div className={cn('h-8 w-8 flex items-center justify-center rounded-lg flex-shrink-0', bg)}>
                    <LinkIcon size={15} className={color} />
                  </div>
                  <span className="text-xs font-semibold text-surface-200 flex-1 text-left">{label}</span>
                  <ChevronRight size={14} className="text-surface-500 group-hover/link:text-surface-300 group-hover/link:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-surface-800/60 text-center">
              <p className="text-[11px] text-surface-500 italic">"Small steps build great structures."</p>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
