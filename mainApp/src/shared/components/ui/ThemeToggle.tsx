import { Moon, Sun } from 'lucide-react';
import { useStore } from '@worklog/services/useStore';

export function ThemeToggle() {
  const { theme, updateTheme } = useStore();
  const isDark = theme.mode === 'dark';

  return (
    <button
      onClick={() => updateTheme({ mode: isDark ? 'light' : 'dark' })}
      className="relative w-9 h-9 rounded-xl flex items-center justify-center text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-all"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <Sun size={16} className={`absolute transition-all duration-300 ${isDark ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'}`} />
      <Moon size={16} className={`absolute transition-all duration-300 ${isDark ? '-rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'}`} />
    </button>
  );
}
