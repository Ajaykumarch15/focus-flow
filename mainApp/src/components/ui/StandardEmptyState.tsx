import { motion } from 'framer-motion';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function StandardEmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface-800/50 flex items-center justify-center mb-4 text-surface-500">
        {icon}
      </div>
      <h3 className="text-base font-display font-bold text-surface-200 mb-1.5">{title}</h3>
      <p className="text-sm text-surface-400 max-w-sm mb-5">{description}</p>
      {action}
    </motion.div>
  );
}
