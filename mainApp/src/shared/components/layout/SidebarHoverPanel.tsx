import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { useStore } from '@worklog/services/useStore';

export interface NavPanelItem {
  to: string;
  icon?: LucideIcon;
  label: string;
  end?: boolean;
}

export interface NavPanelDef {
  to: string;
  icon: LucideIcon;
  label: string;
  children?: NavPanelItem[];
}

interface SidebarHoverPanelProps {
  isOpen: boolean;
  item: NavPanelDef | null;
  topOffset: number;
  accent?: 'brand' | 'purple';
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const accentStyles = {
  brand: {
    headerIcon: 'text-brand-500',
    headerBg: 'bg-brand-500/8',
    activeItem: 'text-brand-500 bg-brand-500/8',
    activeDot: 'bg-brand-500',
  },
  purple: {
    headerIcon: 'text-purple-400',
    headerBg: 'bg-purple-500/8',
    activeItem: 'text-purple-400 bg-purple-500/8',
    activeDot: 'bg-purple-400',
  },
};

export function SidebarHoverPanel({
  isOpen,
  item,
  topOffset,
  accent = 'brand',
  onMouseEnter,
  onMouseLeave,
}: SidebarHoverPanelProps) {
  const { theme } = useStore();
  const location = useLocation();
  const isReducedMotion = theme?.reducedMotion;
  const styles = accentStyles[accent];

  if (!item) return null;

  const hasChildren = item.children && item.children.length > 0;

  const isItemActive = (navItem: NavPanelItem) => {
    if (navItem.end) {
      return location.pathname === navItem.to;
    }
    return location.pathname === navItem.to || location.pathname.startsWith(navItem.to + '/');
  };

  const isMainActive = location.pathname === item.to ||
    (hasChildren && item.children!.some(c => location.pathname === c.to));

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={isReducedMotion ? false : { opacity: 0, x: -8, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={isReducedMotion ? { opacity: 0 } : { opacity: 0, x: -8, scale: 0.98 }}
          transition={{ duration: isReducedMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className="fixed z-50 w-[220px] bg-surface-900 border border-surface-800 rounded-xl shadow-lg overflow-hidden"
          style={{ left: 60, top: Math.max(8, topOffset) }}
        >
          {/* Header: Main nav item */}
          <NavLink
            to={item.to}
            className={`flex items-center gap-3 px-3.5 py-2.5 transition-colors duration-150 ${
              isMainActive ? styles.headerBg : 'hover:bg-surface-850'
            }`}
          >
            <item.icon size={18} className={`flex-shrink-0 ${isMainActive ? styles.headerIcon : 'text-surface-300'}`} />
            <span className={`text-sm font-semibold whitespace-nowrap ${
              isMainActive ? styles.headerIcon : 'text-surface-50'
            }`}>
              {item.label}
            </span>
          </NavLink>

          {/* Sub-items */}
          {hasChildren && (
            <>
              <div className="mx-3 border-t border-surface-800" />
              <div className="py-1.5">
                {item.children!.map((child) => {
                  const active = isItemActive(child);
                  const Icon = child.icon;
                  return (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      end={child.end}
                      className={`group flex items-center gap-3 mx-1.5 px-3 py-2 rounded-lg text-sm transition-colors duration-100 ${
                        active
                          ? styles.activeItem
                          : 'text-surface-400 hover:text-surface-50 hover:bg-surface-850'
                      }`}
                    >
                      {active && (
                        <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full ${styles.activeDot}`} />
                      )}
                      {Icon && (
                        <Icon size={15} className={`flex-shrink-0 ${active ? '' : 'text-surface-500 group-hover:text-surface-300'}`} />
                      )}
                      <span className="whitespace-nowrap">{child.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
