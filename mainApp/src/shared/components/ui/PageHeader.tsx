import { motion } from 'framer-motion';

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: React.ReactNode;
  iconColor?: string;
  actions?: React.ReactNode;
  breadcrumbs?: boolean;
}

export function PageHeader({ title, description, eyebrow, icon, iconColor, actions }: PageHeaderProps) {
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: iconColor ? `${iconColor}15` : undefined }}>
            {icon}
          </div>
        )}
        <div>
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-500 dark:text-brand-400 mb-0.5">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-display font-extrabold text-surface-50 tracking-tight">{title}</h1>
          {description && <p className="text-sm text-surface-400 mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </motion.div>
  );
}
