import { useLocation, useNavigate } from 'react-router-dom';
import { House, CheckSquare, Target, BarChart3, User } from 'lucide-react';

interface Tab {
  icon: typeof House;
  label: string;
  to: string;
}

const TABS: Tab[] = [
  { icon: House,    label: 'Home',    to: '/personal/today' },
  { icon: CheckSquare, label: 'Tasks', to: '/personal/tasks' },
  { icon: Target,   label: 'Focus',   to: '/personal/tasks' },
  { icon: BarChart3, label: 'Insights', to: '/personal/analytics' },
  { icon: User,     label: 'Profile', to: '/profile' },
];

export function MobileBottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const isActive = (label: string) => {
    if (label === 'Home')    return pathname === '/personal/today';
    if (label === 'Tasks')   return pathname === '/personal/tasks';
    if (label === 'Focus')   return pathname.startsWith('/personal/tasks/');
    if (label === 'Insights') return pathname === '/personal/analytics';
    if (label === 'Profile') return pathname === '/profile' || pathname.startsWith('/profile/');
    return false;
  };

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-surface-800/60 bg-white/90 backdrop-blur-xl dark:bg-surface-900/90"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between gap-1 px-2 py-1.5">
        {TABS.map((tab, i) => {
          const Icon = tab.icon;
          const active = isActive(tab.label);
          return (
            <li key={`${tab.to}-${i}`} className="flex-1">
              <button
                type="button"
                onClick={() => navigate(tab.to)}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 ${
                  active
                    ? 'bg-brand-500/15 text-brand-600 dark:text-brand-400'
                    : 'text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200'
                }`}
              >
                <Icon size={19} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                <span className={`text-[10px] leading-none ${active ? 'font-bold' : 'font-medium'}`}>
                  {tab.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
