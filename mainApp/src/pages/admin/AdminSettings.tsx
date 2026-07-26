import { motion } from 'framer-motion';
import { Settings, Shield, Key, Database, Download, FileText, Flag, Globe } from 'lucide-react';

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

function SettingSection({ icon: Icon, title, description, children }: {
  icon: React.ElementType; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <motion.div variants={fadeUp} className="rounded-2xl border border-surface-800 bg-surface-900 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-surface-800 flex items-center justify-center"><Icon size={18} className="text-surface-300" /></div>
        <div><h3 className="text-sm font-bold text-surface-100">{title}</h3><p className="text-xs text-surface-400">{description}</p></div>
      </div>
      {children}
    </motion.div>
  );
}

export function AdminSettings() {
  return (
    <div className="p-6 lg:p-8 max-w-[1500px] mx-auto space-y-6">
      <div><h1 className="text-2xl font-display font-extrabold text-surface-50 mb-1">Settings</h1><p className="text-sm text-surface-400">Organization configuration and administration</p></div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
        <SettingSection icon={Globe} title="General" description="Basic organization settings">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-850">
              <span className="text-sm text-surface-200">Organization Name</span>
              <span className="text-sm text-surface-400">FocusFlow</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-850">
              <span className="text-sm text-surface-200">Default Timezone</span>
              <span className="text-sm text-surface-400">Auto-detected</span>
            </div>
          </div>
        </SettingSection>

        <SettingSection icon={Shield} title="Roles & Permissions" description="Manage user roles and access control">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-850">
              <div><span className="text-sm text-surface-200 font-medium">Admin</span><p className="text-[11px] text-surface-500">Full access to all features and settings</p></div>
              <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-1 rounded-lg">2 roles</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-850">
              <div><span className="text-sm text-surface-200 font-medium">User</span><p className="text-[11px] text-surface-500">Standard access to personal productivity features</p></div>
              <span className="text-xs font-bold text-surface-400 bg-surface-800 px-2 py-1 rounded-lg">Default</span>
            </div>
          </div>
        </SettingSection>

        <SettingSection icon={Flag} title="Feature Flags" description="Toggle features for the organization">
          <div className="space-y-3">
            {['Leaderboard', 'Work Logs', 'Journal', 'Habits', 'Focus Mode'].map(f => (
              <div key={f} className="flex items-center justify-between p-3 rounded-xl bg-surface-850">
                <span className="text-sm text-surface-200">{f}</span>
                <div className="w-10 h-6 rounded-full bg-brand-500 relative cursor-pointer"><div className="absolute right-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow-sm" /></div>
              </div>
            ))}
          </div>
        </SettingSection>

        <SettingSection icon={Database} title="Data Management" description="Export, backup, and audit logs">
          <div className="space-y-2">
            {[
              { icon: Download, label: 'Export Data', desc: 'Download all organization data as JSON' },
              { icon: FileText, label: 'Audit Logs', desc: 'View system audit trail (coming soon)' },
              { icon: Database, label: 'Backup', desc: 'Schedule automated backups (coming soon)' },
            ].map(({ icon: Ic, label, desc }) => (
              <button key={label} className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-850 hover:bg-surface-800 transition-colors text-left">
                <Ic size={16} className="text-surface-400" />
                <div><p className="text-sm text-surface-200 font-medium">{label}</p><p className="text-[11px] text-surface-500">{desc}</p></div>
              </button>
            ))}
          </div>
        </SettingSection>
      </motion.div>
    </div>
  );
}
