import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Target, Zap, BarChart3, BookOpen, Play, CheckCircle, Clock, ArrowRight } from 'lucide-react';

const features = [
  { icon: Clock, title: 'Smart Timer', desc: 'Track work sessions with automatic pause detection and session history.' },
  { icon: BarChart3, title: 'Analytics', desc: 'Beautiful charts showing your productivity trends and focus patterns.' },
  { icon: BookOpen, title: 'Work Journal', desc: 'Keep daily logs and reflections tied to each task session.' },
  { icon: Zap, title: 'Focus Mode', desc: 'Distraction-free Pomodoro timer with motivational quotes.' },
  { icon: CheckCircle, title: 'Subtasks', desc: 'Break down complex tasks into manageable checklist items.' },
  { icon: Target, title: 'Daily Goals', desc: 'Set and track your daily productivity goals with progress bars.' },
];

export function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface-950 overflow-hidden">
      {/* Hero */}
      <div className="relative">
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand-500/10 rounded-full blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-24 text-center">
          {/* Nav */}
          <div className="flex items-center justify-between mb-20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
                <Target size={16} className="text-white" />
              </div>
              <span className="font-display font-bold text-surface-50 text-lg">FocusFlow</span>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-primary flex items-center gap-2"
            >
              Open App <ArrowRight size={15} />
            </button>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 rounded-full px-4 py-1.5 mb-8">
              <Zap size={14} className="text-brand-400" />
              <span className="text-sm text-brand-300 font-medium">Premium Productivity Tracker</span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-display font-bold text-surface-50 leading-tight mb-6">
              Focus deeper.<br />
              <span className="gradient-text">Achieve more.</span>
            </h1>
            <p className="text-xl text-surface-300 max-w-2xl mx-auto mb-10 leading-relaxed">
              FocusFlow combines task management, time tracking, journaling, and analytics in one beautiful productivity tool. Like Notion, Clockify, and Todoist — combined.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.button
                onClick={() => navigate('/dashboard')}
                className="btn-primary text-base px-8 py-3.5 flex items-center gap-2"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <Play size={18} />
                Start Tracking Now
              </motion.button>
              <button
                onClick={() => navigate('/analytics')}
                className="btn-secondary text-base px-8 py-3.5 flex items-center gap-2"
              >
                <BarChart3 size={18} />
                View Analytics
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-display font-bold text-surface-50 mb-4">Everything you need</h2>
          <p className="text-surface-300 text-lg">All your productivity tools in one place</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="card p-6 hover:border-surface-600 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center mb-4 group-hover:bg-brand-500/25 transition-colors">
                <Icon size={20} className="text-brand-400" />
              </div>
              <h3 className="font-semibold text-surface-50 mb-2">{title}</h3>
              <p className="text-sm text-surface-400 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          className="text-center mt-16"
        >
          <h2 className="text-3xl font-display font-bold text-surface-50 mb-4">Ready to focus?</h2>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-primary text-base px-10 py-3.5 flex items-center gap-2 mx-auto"
          >
            <Zap size={18} />
            Open FocusFlow
          </button>
        </motion.div>
      </div>
    </div>
  );
}
