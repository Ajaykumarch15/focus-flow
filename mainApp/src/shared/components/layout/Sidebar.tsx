import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useRef, useCallback, useEffect, forwardRef } from 'react';
import {
  LayoutDashboard, CheckSquare,
  Settings, LogOut, BookMarked, LineChart, Activity, Trophy, ShieldCheck,
  History, Library, Map, BarChart3, Calendar, CalendarDays, Clock, Brain, Lightbulb,
  FolderOpen, Bell, HelpCircle, ChevronRight, User,
} from 'lucide-react';
import { useAuthStore } from '@shared/services/useAuthStore';
import { useActiveTimer } from '@shared/hooks/useActiveTimer';
import { useStore } from '@worklog/services/useStore';
import { Avatar } from '@shared/components/ui/Avatar';
import { SidebarHoverPanel, type NavPanelDef } from './SidebarHoverPanel';

// ── Navigation definitions with sub-items ──────────────────────────────────

const PERSONAL_NAV: NavPanelDef[] = [
  { to: '/personal', icon: Brain, label: 'Personal' },
  { to: '/personal/today', icon: LayoutDashboard, label: 'Today' },
  {
    to: '/personal/tasks', icon: CheckSquare, label: 'Tasks',
    children: [
      { to: '/personal/tasks', label: 'My Tasks' },
      { to: '/personal/today', label: 'Today' },
      { to: '/personal/schedule', label: 'Upcoming' },
    ],
  },
  { to: '/personal/schedule', icon: Calendar, label: 'Schedule' },
  {
    to: '/personal/roadmaps', icon: Map, label: 'Roadmaps',
    children: [
      { to: '/personal/roadmaps', label: 'All Roadmaps' },
    ],
  },
  { to: '/personal/analytics', icon: BarChart3, label: 'Analytics' },
];

const WORKLOG_NAV: NavPanelDef[] = [
  { to: '/worklog/dashboard', icon: LayoutDashboard, label: 'Today' },
  {
    to: '/worklog/tasks', icon: CheckSquare, label: 'Tasks',
    children: [
      { to: '/worklog/tasks', label: 'My Tasks' },
      { to: '/worklog/dashboard', label: 'Today' },
      { to: '/worklog/schedule', label: 'Upcoming' },
    ],
  },
  { to: '/worklog/schedule', icon: Calendar, label: 'Schedule' },
  { to: '/worklog/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/worklog/logs', icon: BookMarked, label: 'Work Logs' },
  { to: '/worklog/habits', icon: Activity, label: 'Habits' },
  { to: '/worklog/reports', icon: LineChart, label: 'Reports' },
  { to: '/worklog/insights', icon: Lightbulb, label: 'Insights' },
  { to: '/worklog/knowledge', icon: Library, label: 'Knowledge' },
];

const COLLAB_NAV: NavPanelDef[] = [
  {
    to: '/collab/team', icon: FolderOpen, label: 'Projects',
    children: [
      { to: '/collab/team', label: 'All Projects' },
    ],
  },
  { to: '/collab/people', icon: User, label: 'People' },
  { to: '/collab/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { to: '/collab/activity', icon: History, label: 'Activity' },
];

const BOTTOM_NAV: NavPanelDef[] = [
  {
    to: '#notifications', icon: Bell, label: 'Notifications',
    children: [
      { to: '/personal/today', label: 'View All' },
    ],
  },
  {
    to: '#help', icon: HelpCircle, label: 'Help & Support',
    children: [
      { to: '/personal', label: 'Documentation' },
    ],
  },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  expanded?: boolean;
}

export function Sidebar({ expanded = false }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const workspace = useAuthStore((s) => s.workspace);
  const { activeTaskId, sessionKind } = useActiveTimer();

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [hoveredTop, setHoveredTop] = useState(0);
  const iconRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const timerMatchesWorkspace =
    (workspace === 'personal' && sessionKind === 'personal') ||
    (workspace !== 'personal' && sessionKind !== 'personal');

  const navItems = workspace === 'personal'
    ? PERSONAL_NAV
    : workspace === 'collab'
      ? [...WORKLOG_NAV, ...COLLAB_NAV]
      : WORKLOG_NAV;

  const adminNav: NavPanelDef = {
    to: '/admin/audit', icon: ShieldCheck, label: 'Admin Console',
    children: [
      { to: '/admin/audit', label: 'Audit' },
      { to: '/admin/people', label: 'People' },
      { to: '/admin/teams', label: 'Teams' },
      { to: '/admin/settings', label: 'Settings' },
    ],
  };

  const handleIconEnter = useCallback((key: string) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    const el = iconRefs.current[key];
    if (el) {
      const rect = el.getBoundingClientRect();
      setHoveredTop(rect.top);
    }
    setHoveredItem(key);
  }, []);

  const handleIconLeave = useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => {
      setHoveredItem(null);
    }, 120);
  }, []);

  const handlePanelEnter = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const handlePanelLeave = useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => {
      setHoveredItem(null);
    }, 120);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  // In expanded mode (mobile), render a full sidebar with labels
  if (expanded) {
    return (
      <aside className="w-[260px] h-screen bg-surface-900 border-r border-surface-800 flex flex-col overflow-hidden flex-shrink-0">
        {/* Logo */}
        <div className="p-3 flex items-center gap-2.5 border-b border-surface-800">
          <button onClick={() => navigate('/home')} className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0">
              <img src="/darkicon.png" alt="FocusFlow" className="w-full h-full object-cover" />
            </div>
            <span className="font-display font-extrabold text-surface-50 text-sm">FocusFlow</span>
          </button>
        </div>

        {/* Nav */}
        <nav aria-label="Primary" className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto no-scrollbar">
          {navItems.map(item => (
            <ExpandedNavItem key={item.to} item={item} />
          ))}

          {user?.role === 'admin' && (
            <>
              <div className="my-3 border-t border-surface-800 mx-4" />
              <ExpandedNavItem item={adminNav} />
            </>
          )}

          <div className="my-3 border-t border-surface-800 mx-4" />
          {BOTTOM_NAV.map(item => (
            <ExpandedNavItem key={item.to} item={item} />
          ))}
        </nav>

        {/* Timer */}
        {activeTaskId && timerMatchesWorkspace && (
          <div className="px-2.5 py-2 border-t border-surface-800">
            <TimerIndicator compact />
          </div>
        )}

        {/* User */}
        <div className="p-3 border-t border-surface-800">
          <div className="flex items-center gap-3">
            <Avatar name={user?.name} src={user?.avatar} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-50 truncate">{user?.name}</p>
              <p className="text-xs text-surface-400 truncate">{user?.email}</p>
            </div>
            <button onClick={logout} className="p-1.5 rounded-lg text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // Default: collapsed icon rail
  const activePanelDef = hoveredItem === 'admin'
    ? adminNav
    : hoveredItem === 'profile'
      ? null
      : navItems.find(n => n.to === hoveredItem) || BOTTOM_NAV.find(n => n.to === hoveredItem) || null;

  return (
    <aside className="w-[60px] h-screen bg-surface-900 border-r border-surface-800 flex flex-col flex-shrink-0 relative z-30">
      {/* Logo */}
      <div className="h-14 flex items-center justify-center border-b border-surface-800">
        <button
          onClick={() => navigate('/home')}
          className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
          title="FocusFlow — Home"
        >
          <img src="/darkicon.png" alt="FocusFlow" className="w-full h-full object-cover" />
        </button>
      </div>

      {/* Nav Rail */}
      <nav aria-label="Primary" className="flex-1 px-2 py-4 space-y-1 overflow-y-auto no-scrollbar">
        {navItems.map(item => (
          <RailIcon
            key={item.to}
            item={item}
            onEnter={handleIconEnter}
            onLeave={handleIconLeave}
            ref={(el) => { if (el) iconRefs.current[item.to] = el; }}
          />
        ))}

        {user?.role === 'admin' && (
          <>
            <div className="my-2 mx-2 border-t border-surface-800" />
            <RailIcon
              item={adminNav}
              onEnter={() => handleIconEnter('admin')}
              onLeave={handleIconLeave}
              accent="purple"
              ref={(el) => { if (el) iconRefs.current['admin'] = el; }}
            />
          </>
        )}

        <div className="my-2 mx-2 border-t border-surface-800" />
        {BOTTOM_NAV.map(item => (
          <RailIcon
            key={item.to}
            item={item}
            onEnter={handleIconEnter}
            onLeave={handleIconLeave}
            ref={(el) => { if (el) iconRefs.current[item.to] = el; }}
          />
        ))}
      </nav>

      {/* Timer Indicator — always visible */}
      {activeTaskId && timerMatchesWorkspace && (
        <div className="px-2 py-2 border-t border-surface-800">
          <TimerIndicator compact={false} />
        </div>
      )}

      {/* Profile Avatar */}
      <div className="px-2 pb-3">
        <div
          className="sidebar-rail-icon mx-auto"
          onMouseEnter={() => handleIconEnter('profile')}
          onMouseLeave={handleIconLeave}
          ref={(el) => { if (el) iconRefs.current['profile'] = el; }}
          role="button"
          tabIndex={0}
          aria-label="Account menu"
        >
          <Avatar name={user?.name} src={user?.avatar} size="xs" />
        </div>
      </div>

      {/* Hover Panel */}
      <SidebarHoverPanel
        isOpen={hoveredItem === 'profile'}
        item={{
          to: '/settings',
          icon: User,
          label: user?.name || 'Account',
          children: [
            { to: '/settings', label: 'Settings' },
          ],
        }}
        topOffset={hoveredTop}
        onMouseEnter={handlePanelEnter}
        onMouseLeave={handlePanelLeave}
      />

      {hoveredItem !== 'profile' && (
        <SidebarHoverPanel
          isOpen={!!activePanelDef}
          item={activePanelDef}
          topOffset={hoveredTop}
          accent={hoveredItem === 'admin' ? 'purple' : 'brand'}
          onMouseEnter={handlePanelEnter}
          onMouseLeave={handlePanelLeave}
        />
      )}
    </aside>
  );
}

// ── Rail Icon (collapsed mode) ─────────────────────────────────────────────

interface RailIconProps {
  item: NavPanelDef;
  onEnter: (key: string) => void;
  onLeave: () => void;
  accent?: 'brand' | 'purple';
}

const RailIcon = forwardRef<HTMLDivElement, RailIconProps>(
  ({ item, onEnter, onLeave, accent = 'brand' }, ref) => {
    const location = useLocation();
    const isActive = location.pathname === item.to ||
      (item.children && item.children.some(c => location.pathname === c.to));

    const accentClasses = accent === 'purple'
      ? {
          active: 'text-purple-400 bg-purple-500/10',
          indicator: 'bg-purple-400',
          hover: 'hover:text-purple-300 hover:bg-purple-500/5',
        }
      : {
          active: 'text-brand-500 bg-brand-500/10',
          indicator: 'bg-brand-500',
          hover: 'hover:text-surface-50 hover:bg-surface-850',
        };

    return (
      <div
        ref={ref}
        className={`sidebar-rail-icon mx-auto ${
          isActive
            ? accentClasses.active
            : `text-surface-400 ${accentClasses.hover}`
        }`}
        onMouseEnter={() => onEnter(item.to)}
        onMouseLeave={onLeave}
        role="button"
        tabIndex={0}
        aria-label={item.label}
        title={item.label}
      >
        {isActive && (
          <span className={`sidebar-active-indicator ${accentClasses.indicator}`} />
        )}
        <item.icon size={20} className="flex-shrink-0" />
      </div>
    );
  }
);
RailIcon.displayName = 'RailIcon';

// ── Expanded Nav Item (mobile mode) ────────────────────────────────────────

function ExpandedNavItem({ item }: { item: NavPanelDef }) {
  const location = useLocation();
  const isActive = location.pathname === item.to ||
    (item.children && item.children.some(c => location.pathname === c.to));

  if (item.to.startsWith('#')) {
    return (
      <button className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 w-full text-left ${
        isActive ? 'text-brand-500 font-semibold' : 'text-surface-300 hover:text-surface-50 hover:bg-surface-850'
      }`}>
        <item.icon size={18} className="flex-shrink-0" />
        <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
      </button>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.to === '/personal' || item.to === '/worklog/dashboard'}
      className={({ isActive: a }) =>
        `group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative ${
          a ? 'text-brand-500 font-semibold' : 'text-surface-300 hover:text-surface-50 hover:bg-surface-850'
        }`
      }
    >
      {({ isActive: a }) => (
        <>
          {a && (
            <>
              <span className="absolute inset-0 rounded-xl bg-brand-500/10 border border-brand-500/15" />
              <span className="sidebar-active-indicator bg-brand-500" />
            </>
          )}
          <item.icon size={18} className="flex-shrink-0 relative z-10" />
          <span className="text-sm font-medium whitespace-nowrap relative z-10">{item.label}</span>
          {item.children && item.children.length > 0 && (
            <ChevronRight size={14} className="ml-auto flex-shrink-0 text-surface-500 relative z-10" />
          )}
        </>
      )}
    </NavLink>
  );
}

// ── Timer Indicator ────────────────────────────────────────────────────────

function TimerIndicator({ compact }: { compact: boolean }) {
  const { activeTaskId, activeTimerState, display: activeDisplay, activeTask } = useActiveTimer();
  const navigate = useNavigate();
  const { theme } = useStore();
  const isReducedMotion = theme?.reducedMotion;

  if (!activeTaskId) return null;

  const handleClick = () => {
    const route = activeTaskId
      ? `/personal/tasks/${activeTaskId}`
      : '/personal/today';
    navigate(route);
  };

  if (compact) {
    return (
      <button
        onClick={handleClick}
        title={activeTask ? `Active: ${activeTask.title} — ${activeDisplay}` : 'Active Timer'}
        className={`w-full flex items-center justify-center p-2 rounded-xl border transition-all ${
          activeTimerState === 'running'
            ? 'bg-brand-500/10 border-brand-500/30 text-brand-400'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
        }`}
      >
        <div className="relative">
          <Clock size={16} />
          {activeTimerState === 'running' && !isReducedMotion && (
            <span className="sidebar-timer-pulse bg-brand-400/30" />
          )}
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      title={activeTask ? `Active Task: ${activeTask.title}` : 'Active Timer'}
      aria-label={`Active timer for ${activeTask?.title || 'task'}: ${activeDisplay}, status ${activeTimerState}`}
      className={`w-full flex items-center gap-2.5 p-2 rounded-xl border transition-all text-left ${
        activeTimerState === 'running'
          ? 'bg-brand-500/10 border-brand-500/30 text-brand-300'
          : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
      }`}
    >
      <div className="relative flex items-center justify-center flex-shrink-0">
        <Clock size={16} className={activeTimerState === 'running' ? 'text-brand-400' : 'text-amber-400'} />
        {activeTimerState === 'running' && !isReducedMotion && (
          <span className="sidebar-timer-pulse bg-brand-400/30" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="font-mono text-xs font-bold truncate">{activeDisplay}</span>
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
            activeTimerState === 'running' ? 'bg-brand-500/20 text-brand-300' : 'bg-amber-500/20 text-amber-300'
          }`}>
            {activeTimerState}
          </span>
        </div>
        {activeTask && (
          <p className="text-[11px] text-surface-300 truncate mt-0.5">
            {activeTask.title}
          </p>
        )}
      </div>
    </button>
  );
}
