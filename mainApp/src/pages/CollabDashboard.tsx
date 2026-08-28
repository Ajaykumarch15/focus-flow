import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Users, FolderOpen, CheckSquare, Map, ArrowRight } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

export function CollabDashboard() {
  const navigate = useNavigate();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-extrabold text-surface-50">Collab Dashboard</h1>
          <p className="text-sm text-surface-400 mt-0.5">Work together, manage shared projects & coordinate team execution.</p>
        </div>
      </motion.div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Projects', value: '—', icon: FolderOpen, color: '#10b981' },
          { label: 'Shared Tasks', value: '—', icon: CheckSquare, color: '#0ea5e9' },
          { label: 'Roadmaps', value: '—', icon: Map, color: '#8b5cf6' },
        ].map(({ label, value, icon: Icon, color }) => (
          <motion.div key={label} variants={fadeUp}>
            <Card className="p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon size={13} style={{ color }} />
                <span className="text-[11px] text-surface-400 font-medium">{label}</span>
              </div>
              <p className="text-lg font-display font-bold text-surface-50">{value}</p>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-5">
            <Users size={30} className="text-emerald-400" />
          </div>
          <h2 className="text-lg font-display font-bold text-surface-50 mb-2">Your team's workspace</h2>
          <p className="text-sm text-surface-400 max-w-md mx-auto leading-relaxed mb-6">
            Collaborate on projects, manage shared tasks and coordinate team execution.
            This workspace is coming together — set up your team to start working.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="secondary"
              onClick={() => navigate('/home')}
              leftIcon={<FolderOpen size={14} />}
            >
              Engineering Homepage
            </Button>
            <Button
              onClick={() => navigate('/collab/team')}
              rightIcon={<ArrowRight size={14} />}
            >
              Team Projects
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
