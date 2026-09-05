import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useRef, useCallback, useEffect, forwardRef } from 'react';
import {
  Users, Activity, Settings, LogOut,
  Globe, ArrowLeft, Bell, HelpCircle,
} from 'lucide-react';
import { useAuthStore } from '@shared/services/useAuthStore';
import { useStore } from '@worklog/services/useStore';
import { SidebarHoverPanel, type NavPanelDef } from './SidebarHoverPanel';

// ── Admin Navigation definitions ───────────────────────────────────────────

const ADMIN_NAV: NavPanelDef[] = [
  { to: '/admin/audit', icon: Activity, label: 'Audit' },
  { to: '/admin/people', icon: Users, label: 'People' },
  { to: '/admin/teams', icon: Globe, label: 'Teams' },
  {
    to: '/admin/settings', icon: Settings, label: 'Settings',
    children: [
      { to: '/admin/settings', label: 'Admin Settings' },
    ],
  },
];

const BOTTOM_NAV: NavPanelDef[] = [
  {
    to: '#notifications', icon: Bell, label: 'Notifications',
    children: [
      { to: '/admin/audit', label: 'View All' },
    ],
  },
  {
    to: '#help', icon: HelpCircle, label: 'Help & Support',
    children: [
      { to: '/admin/audit', label: 'Documentation' },
    ],
  },
];

interface AdminSidebarProps {
  expanded?: boolean;
}

export function AdminSidebar({ expanded = false }: AdminSidebarProps) {
  const { user, logout, setWorkspace } = useAuthStore();
  const { theme } = useStore();
  const navigate = useNavigate();

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [hoveredTop, setHoveredTop] = useState(0);
  const iconRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const backToPersonal: NavPanelDef = {
    to: '/personal/today', icon: ArrowLeft, label: 'Back to Personal',
  };

  // Expanded mode (mobile drawer)
  if (expanded) {
    return (
      <aside className="w-[260px] h-screen bg-surface-900 border-r border-surface-800 flex flex-col overflow-hidden flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-surface-800">
          <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0">
            <img src={theme.mode === 'dark' ? '/darkicon.png' : '/lighticon.png'} alt="FocusFlow" className="w-full h-full" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold text-surface-50 text-sm leading-tight whitespace-nowrap">FocusFlow</p>
            <p className="text-[10px] text-purple-400 font-medium whitespace-nowrap">Administration</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto no-scrollbar">
          {ADMIN_NAV.map(item => (
            <ExpandedAdminNavItem key={item.to} item={item} />
          ))}
          <div className="my-3 border-t border-surface-800 mx-4" />
          <ExpandedAdminNavItem item={backToPersonal} />
        </nav>

        {/* User */}
        <div className="p-3 border-t border-surface-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center flex-shrink-0 text-sm font-bold text-white">
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-50 truncate">{user?.name}</p>
              <p className="text-[10px] text-purple-400 font-medium uppercase">Administrator</p>
            </div>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // Default: collapsed icon rail
  const activePanelDef = hoveredItem === 'profile'
    ? null
    : ADMIN_NAV.find(n => n.to === hoveredItem) ||
      BOTTOM_NAV.find(n => n.to === hoveredItem) ||
      (hoveredItem === 'back' ? backToPersonal : null);

  return (
    <aside className="w-[60px] h-screen bg-surface-900 border-r border-surface-800 flex flex-col flex-shrink-0 relative z-30">
      {/* Logo */}
      <div className="h-14 flex items-center justify-center border-b border-surface-800">
        <button
          onClick={() => { setWorkspace('personal'); navigate('/personal/today'); }}
          className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
          title="Back to Personal"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
            {user?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
        </button>
      </div>

      {/* Nav Rail */}
      <nav aria-label="Admin" className="flex-1 px-2 py-4 space-y-1 overflow-y-auto no-scrollbar">
        {ADMIN_NAV.map(item => (
          <AdminRailIcon
            key={item.to}
            item={item}
            onEnter={handleIconEnter}
            onLeave={handleIconLeave}
            ref={(el) => { if (el) iconRefs.current[item.to] = el; }}
          />
        ))}

        <div className="my-2 mx-2 border-t border-surface-800" />
        {BOTTOM_NAV.map(item => (
          <AdminRailIcon
            key={item.to}
            item={item}
            onEnter={handleIconEnter}
            onLeave={handleIconLeave}
            ref={(el) => { if (el) iconRefs.current[item.to] = el; }}
          />
        ))}
      </nav>

      {/* Back to Personal */}
      <div className="px-2 pb-2">
        <AdminRailIcon
          item={backToPersonal}
          onEnter={() => handleIconEnter('back')}
          onLeave={handleIconLeave}
          ref={(el) => { if (el) iconRefs.current['back'] = el; }}
        />
      </div>

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
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-[9px] font-bold text-white">
            {user?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
        </div>
      </div>

      {/* Hover Panels */}
      <SidebarHoverPanel
        isOpen={hoveredItem === 'profile'}
        item={{
          to: '/admin/settings',
          icon: Users,
          label: user?.name || 'Admin',
          children: [
            { to: '/admin/settings', label: 'Admin Settings' },
          ],
        }}
        topOffset={hoveredTop}
        accent="purple"
        onMouseEnter={handlePanelEnter}
        onMouseLeave={handlePanelLeave}
      />

      {hoveredItem !== 'profile' && (
        <SidebarHoverPanel
          isOpen={!!activePanelDef}
          item={activePanelDef}
          topOffset={hoveredTop}
          accent="purple"
          onMouseEnter={handlePanelEnter}
          onMouseLeave={handlePanelLeave}
        />
      )}
    </aside>
  );
}

// ── Admin Rail Icon (collapsed mode) ───────────────────────────────────────

const AdminRailIcon = forwardRef<HTMLDivElement, {
  item: NavPanelDef;
  onEnter: (key: string) => void;
  onLeave: () => void;
}>(({ item, onEnter, onLeave }, ref) => {
  const location = useLocation();
  const isActive = location.pathname === item.to ||
    (item.children && item.children.some(c => location.pathname === c.to));

  return (
    <div
      ref={ref}
      className={`sidebar-rail-icon mx-auto ${
        isActive
          ? 'text-purple-400 bg-purple-500/10'
          : 'text-surface-400 hover:text-purple-300 hover:bg-purple-500/5'
      }`}
      onMouseEnter={() => onEnter(item.to)}
      onMouseLeave={onLeave}
      role="button"
      tabIndex={0}
      aria-label={item.label}
      title={item.label}
    >
      {isActive && (
        <span className="sidebar-active-indicator bg-purple-400" />
      )}
      <item.icon size={20} className="flex-shrink-0" />
    </div>
  );
});
AdminRailIcon.displayName = 'AdminRailIcon';

// ── Expanded Admin Nav Item (mobile mode) ──────────────────────────────────

function ExpandedAdminNavItem({ item }: { item: NavPanelDef }) {
  const location = useLocation();
  const isActive = location.pathname === item.to ||
    (item.children && item.children.some(c => location.pathname === c.to));

  if (item.to.startsWith('#')) {
    return (
      <button className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 w-full text-left ${
        isActive ? 'text-purple-400 font-semibold' : 'text-surface-400 hover:text-surface-50 hover:bg-surface-850'
      }`}>
        <item.icon size={18} className="flex-shrink-0" />
        <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
      </button>
    );
  }

  return (
    <NavLink
      to={item.to}
      className={({ isActive: a }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative ${
          a
            ? 'bg-purple-500/10 text-purple-400 font-semibold border border-purple-500/15'
            : 'text-surface-400 hover:text-surface-50 hover:bg-surface-850'
        }`
      }
    >
      {({ isActive: a }) => (
        <>
          {a && (
            <span className="sidebar-active-indicator bg-purple-400" />
          )}
          <item.icon size={18} className="flex-shrink-0 relative z-10" />
          <span className="text-sm font-medium whitespace-nowrap relative z-10">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}
