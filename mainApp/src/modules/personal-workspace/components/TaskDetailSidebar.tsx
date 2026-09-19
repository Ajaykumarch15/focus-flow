import { useState, useEffect } from 'react';
import {
  FileText, StickyNote, Paperclip, Activity, Timer, BarChart3, Zap,
} from 'lucide-react';

interface TaskDetailSidebarProps {
  totalTime: number;
  sessions: Array<{ activeTime: number }>;
}

const NAV_ITEMS = [
  { id: 'details', label: 'Task Details', icon: FileText },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'attachments', label: 'Attachments', icon: Paperclip },
  { id: 'activity', label: 'Activity', icon: Activity },
];

export function TaskDetailSidebar({ totalTime, sessions }: TaskDetailSidebarProps) {
  const [activeSection, setActiveSection] = useState('details');

  useEffect(() => {
    const handleScroll = () => {
      const sections = NAV_ITEMS.map(item => ({
        id: item.id,
        el: document.getElementById(`section-${item.id}`),
      }));

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section.el) {
          const rect = section.el.getBoundingClientRect();
          if (rect.top <= 150) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(`section-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  };

  const avgSession = sessions.length > 0
    ? Math.round(totalTime / sessions.length)
    : 0;
  const longestSession = sessions.length > 0
    ? Math.max(...sessions.map(s => s.activeTime))
    : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Navigation */}
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollToSection(item.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                  : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800 border border-transparent'
              }`}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Focus Stats */}
      <div className="rounded-2xl border border-surface-800 bg-surface-900 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-brand-500/10 flex items-center justify-center">
            <BarChart3 size={13} className="text-brand-400" />
          </div>
          <span className="text-xs font-bold text-surface-200">Focus Stats (This Task)</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatItem
            icon={<Timer size={12} className="text-brand-400" />}
            value={formatDuration(totalTime)}
            label="Total Focus"
          />
          <StatItem
            icon={<Zap size={12} className="text-purple-400" />}
            value={sessions.length.toString()}
            label="Sessions"
          />
          <StatItem
            icon={<BarChart3 size={12} className="text-emerald-400" />}
            value={formatDuration(avgSession)}
            label="Avg Session"
          />
          <StatItem
            icon={<Timer size={12} className="text-amber-400" />}
            value={formatDuration(longestSession)}
            label="Longest"
          />
        </div>
      </div>

      {/* Motivational Card */}
      <div className="rounded-2xl border border-surface-800 bg-surface-900 p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl" />
        <div className="relative flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <span className="text-emerald-400 text-lg">🌱</span>
          </div>
          <div>
            <p className="text-xs font-bold text-surface-200">Progress, not perfection.</p>
            <p className="text-[11px] text-surface-500 mt-0.5">You&apos;re building a better you.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatItem({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center p-2 rounded-xl bg-surface-850/50 border border-surface-800">
      <div className="flex items-center gap-1 mb-1">
        {icon}
        <span className="text-sm font-bold text-surface-100">{value}</span>
      </div>
      <span className="text-[10px] text-surface-500 font-medium">{label}</span>
    </div>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
