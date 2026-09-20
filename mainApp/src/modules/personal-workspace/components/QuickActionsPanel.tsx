import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Calendar, Map, ArrowRight } from 'lucide-react';

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color: string;
}

interface QuickActionsPanelProps {
  onCreateTask?: () => void;
}

export function QuickActionsPanel({ onCreateTask }: QuickActionsPanelProps) {
  const navigate = useNavigate();

  const actions: QuickAction[] = [
    {
      icon: <Plus size={16} />,
      label: 'Add Task',
      onClick: onCreateTask || (() => {}),
      color: 'text-brand-400',
    },
    {
      icon: <FileText size={16} />,
      label: 'Add Note',
      onClick: () => navigate('/personal/tasks'),
      color: 'text-info-400',
    },
    {
      icon: <Calendar size={16} />,
      label: 'Plan My Day',
      onClick: () => navigate('/personal/today'),
      color: 'text-success-400',
    },
    {
      icon: <Map size={16} />,
      label: 'Open Roadmap',
      onClick: () => navigate('/personal/roadmaps'),
      color: 'text-violet-400',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-surface-800/30 bg-transparent p-4"
    >
      <h3 className="text-sm font-bold text-surface-100 mb-3 flex items-center gap-2">
        <span className="text-amber-400">&#9889;</span>
        Quick Actions
      </h3>
      <div className="space-y-2">
        {actions.map((action, idx) => (
          <button
            key={idx}
            onClick={action.onClick}
            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-surface-800 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <span className={`${action.color}`}>{action.icon}</span>
              <span className="text-sm font-medium text-surface-200 group-hover:text-surface-50 transition-colors">
                {action.label}
              </span>
            </div>
            <ArrowRight size={14} className="text-surface-600 group-hover:text-surface-400 transition-colors" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}
