import { useState, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Target, Zap, BarChart3, BookOpen, Play, CheckCircle, Clock, ArrowRight,
  Timer, Flame, Trophy, Star, Users, TrendingUp, ChevronRight,
  LayoutDashboard, CheckSquare, LineChart, Sparkles, Shield, Globe,
} from 'lucide-react';

const stagger = { show: { transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } } };

const features = [
  { icon: Timer, title: 'Smart Timer', desc: 'Track work sessions with automatic pause detection, session history, and focus scoring.', color: '#0ea5e9', bg: 'bg-sky-500/10' },
  { icon: BarChart3, title: 'Analytics', desc: 'Beautiful charts showing your productivity trends, time distribution, and performance insights.', color: '#8b5cf6', bg: 'bg-purple-500/10' },
  { icon: BookOpen, title: 'Work Journal', desc: 'Keep daily logs and reflections tied to each task session with rich text editing.', color: '#22c55e', bg: 'bg-emerald-500/10' },
  { icon: Zap, title: 'Focus Mode', desc: 'Distraction-free Pomodoro timer with motivational quotes and ambient sound.', color: '#f97316', bg: 'bg-orange-500/10' },
  { icon: CheckSquare, title: 'Subtasks', desc: 'Break down complex tasks into manageable checklist items with progress tracking.', color: '#ec4899', bg: 'bg-pink-500/10' },
  { icon: Target, title: 'Daily Goals', desc: 'Set and track your daily productivity goals with visual progress rings.', color: '#eab308', bg: 'bg-yellow-500/10' },
];

const steps = [
  { num: '01', icon: LayoutDashboard, title: 'Create Tasks', desc: 'Organize your work with priorities, categories, deadlines, and subtasks.' },
  { num: '02', icon: Timer, title: 'Track Focus', desc: 'Start the timer and dive into deep work. We handle the rest.' },
  { num: '03', icon: LineChart, title: 'Review Insights', desc: 'See where your time goes and optimize your productivity with real data.' },
];

const testimonials = [
  { name: 'Sarah K.', role: 'Software Engineer', text: 'FocusFlow completely changed how I approach my workday. The analytics alone helped me reclaim 2 hours of deep focus daily.', rating: 5 },
  { name: 'Marcus T.', role: 'Product Designer', text: 'Finally a productivity tool that looks as good as it works. The journal feature keeps me accountable and the timers keep me sharp.', rating: 5 },
  { name: 'Priya M.', role: 'Project Manager', text: 'I manage 3 teams and FocusFlow gives me clarity on where my time actually goes. The category breakdown is a game-changer.', rating: 5 },
];

const stats = [
  { value: '10K+', label: 'Focus Hours Tracked' },
  { value: '50K+', label: 'Tasks Completed' },
  { value: '98%', label: 'User Satisfaction' },
  { value: '4.9', label: 'Average Rating', icon: Star },
];

export function Landing() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 300], [1, 0.95]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-surface-950 overflow-hidden">

      {/* ═══ Sticky Nav ═══ */}
      <motion.nav initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/50 shadow-lg shadow-black/20' : ''
        }`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
              <Target size={16} className="text-white" />
            </div>
            <span className="font-display font-extrabold text-surface-50 text-lg tracking-tight">FocusFlow</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/login')}
              className="hidden sm:block text-sm text-surface-400 hover:text-surface-200 font-medium transition-colors px-3 py-2">
              Sign In
            </button>
            <button onClick={() => navigate('/register')}
              className="text-sm bg-surface-800 hover:bg-surface-700 text-surface-100 font-semibold px-4 py-2 rounded-xl transition-all border border-surface-700">
              Get Started
            </button>
          </div>
        </div>
      </motion.nav>

      {/* ═══ Hero ═══ */}
      <motion.section style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative pt-32 pb-20 lg:pt-40 lg:pb-28">
        {/* Animated gradient blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] pointer-events-none">
          <motion.div className="absolute inset-0 bg-brand-500/8 rounded-full blur-[100px]"
            animate={{ scale: [1, 1.15, 1], rotate: [0, 5, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} />
          <motion.div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-purple-500/6 rounded-full blur-[80px]"
            animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }} />
          <motion.div className="absolute top-1/4 right-1/4 w-[250px] h-[250px] bg-sky-500/6 rounded-full blur-[80px]"
            animate={{ x: [0, -20, 0], y: [0, 15, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }} />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 rounded-full px-4 py-1.5 mb-8">
              <Sparkles size={14} className="text-brand-400" />
              <span className="text-sm text-brand-300 font-semibold">Premium Productivity Tracker</span>
            </div>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-5xl sm:text-6xl lg:text-[80px] font-display font-extrabold text-surface-50 leading-[1.05] tracking-tight mb-6">
            Focus deeper.<br />
            <span className="bg-gradient-to-r from-brand-400 via-purple-400 to-sky-400 bg-clip-text text-transparent">
              Achieve more.
            </span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="text-lg lg:text-xl text-surface-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Task management, time tracking, journaling, and analytics in one beautiful app.
            Built for people who take their focus seriously.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <motion.button onClick={() => navigate('/register')}
              whileHover={{ scale: 1.03, boxShadow: '0 0 30px rgba(14,165,233,0.3)' }}
              whileTap={{ scale: 0.97 }}
              className="bg-brand-500 hover:bg-brand-400 text-white text-base font-bold px-8 py-4 rounded-2xl flex items-center gap-2.5 shadow-xl shadow-brand-500/25 transition-colors">
              <Play size={18} fill="white" /> Start Free
            </motion.button>
            <button onClick={() => navigate('/login')}
              className="text-base text-surface-300 hover:text-surface-100 font-semibold px-6 py-4 flex items-center gap-2 transition-colors">
              Sign In <ArrowRight size={16} />
            </button>
          </motion.div>

          {/* Mock UI Preview */}
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.55 }}
            className="relative mx-auto max-w-4xl">
            <div className="absolute -inset-4 bg-gradient-to-b from-brand-500/20 via-purple-500/10 to-transparent rounded-3xl blur-2xl" />
            <div className="relative rounded-2xl border border-surface-800/80 bg-surface-900/90 backdrop-blur-xl p-4 shadow-2xl shadow-black/40">
              {/* Window chrome */}
              <div className="flex items-center gap-2 mb-4 px-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex-1 h-7 bg-surface-800/60 rounded-lg flex items-center justify-center">
                  <span className="text-[10px] text-surface-500 font-medium">app.focusflow.io</span>
                </div>
              </div>
              {/* Mock content */}
              <div className="grid grid-cols-4 gap-3 mb-3">
                {[
                  { icon: Clock, label: 'Focus', value: '6.2h', color: 'text-sky-400', bg: 'bg-sky-500/10' },
                  { icon: Flame, label: 'Streak', value: '12d', color: 'text-orange-400', bg: 'bg-orange-500/10' },
                  { icon: Trophy, label: 'Score', value: '94%', color: 'text-purple-400', bg: 'bg-purple-500/10' },
                  { icon: TrendingUp, label: 'Trend', value: '+18%', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                ].map(({ icon: Icon, label, value, color, bg }) => (
                  <div key={label} className={`${bg} rounded-xl p-3 text-center border border-surface-800/40`}>
                    <Icon size={14} className={`${color} mx-auto mb-1`} />
                    <p className={`text-sm font-bold ${color}`}>{value}</p>
                    <p className="text-[9px] text-surface-500">{label}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 bg-surface-850/50 rounded-xl p-4 border border-surface-800/40">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                    <span className="text-[10px] text-surface-400 font-medium">Weekly Focus</span>
                  </div>
                  <div className="flex items-end gap-2 h-20">
                    {[40, 65, 50, 80, 70, 55, 35].map((h, i) => (
                      <motion.div key={i} className="flex-1 bg-sky-500/30 rounded-t-md"
                        initial={{ height: 0 }} animate={{ height: `${h}%` }}
                        transition={{ duration: 0.5, delay: 0.8 + i * 0.05 }} />
                    ))}
                  </div>
                </div>
                <div className="bg-surface-850/50 rounded-xl p-4 border border-surface-800/40">
                  <span className="text-[10px] text-surface-400 font-medium">Tasks</span>
                  <div className="mt-2 space-y-2">
                    {['Design review', 'API integration', 'Write docs'].map((t, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-sm ${i < 2 ? 'bg-emerald-500/80' : 'bg-surface-700'}`} />
                        <span className="text-[10px] text-surface-300 truncate">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* ═══ Stats Bar ═══ */}
      <motion.section initial="hidden" whileInView="show" viewport={{ once: true, margin: '-50px' }}
        variants={stagger} className="border-y border-surface-800/60 bg-surface-900/50">
        <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map(({ value, label, icon: Icon }) => (
            <motion.div key={label} variants={fadeUp} className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                {Icon && <Icon size={16} className="text-amber-400" />}
                <p className="text-3xl lg:text-4xl font-display font-extrabold text-surface-50">{value}</p>
              </div>
              <p className="text-xs text-surface-400 font-medium">{label}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ═══ Features ═══ */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}
          variants={fadeUp} className="text-center mb-14">
          <h2 className="text-3xl lg:text-4xl font-display font-extrabold text-surface-50 mb-4 tracking-tight">
            Everything you need
          </h2>
          <p className="text-surface-400 text-lg max-w-xl mx-auto">
            All your productivity tools in one beautifully crafted experience.
          </p>
        </motion.div>

        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-50px' }}
          variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, desc, color, bg }, i) => (
            <motion.div key={title} variants={fadeUp}
              whileHover={{ y: -4, borderColor: 'rgba(255,255,255,0.1)' }}
              className="rounded-2xl border border-surface-800/60 bg-surface-900 p-6 transition-all duration-200 group cursor-default">
              <div className={`w-11 h-11 rounded-2xl ${bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon size={20} style={{ color }} />
              </div>
              <h3 className="text-base font-display font-bold text-surface-50 mb-2">{title}</h3>
              <p className="text-sm text-surface-400 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ═══ How It Works ═══ */}
      <section className="border-y border-surface-800/60 bg-surface-900/30">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp} className="text-center mb-14">
            <h2 className="text-3xl lg:text-4xl font-display font-extrabold text-surface-50 mb-4 tracking-tight">
              How it works
            </h2>
            <p className="text-surface-400 text-lg">Three steps to better productivity</p>
          </motion.div>

          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-50px' }}
            variants={stagger} className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map(({ num, icon: Icon, title, desc }, i) => (
              <motion.div key={title} variants={fadeUp} className="text-center relative">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-[80%] border-t border-dashed border-surface-700" />
                )}
                <div className="relative inline-flex mb-5">
                  <div className="w-20 h-20 rounded-3xl bg-surface-800/80 border border-surface-700 flex items-center justify-center">
                    <Icon size={28} className="text-brand-400" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-brand-500/30">
                    {num}
                  </span>
                </div>
                <h3 className="text-lg font-display font-bold text-surface-50 mb-2">{title}</h3>
                <p className="text-sm text-surface-400 max-w-[260px] mx-auto leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ Analytics Showcase ═══ */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}>
            <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-3 py-1 mb-5">
              <BarChart3 size={12} className="text-purple-400" />
              <span className="text-xs text-purple-300 font-semibold">Powerful Analytics</span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-display font-extrabold text-surface-50 mb-4 tracking-tight leading-tight">
              Know exactly where<br />your time goes
            </h2>
            <p className="text-surface-400 leading-relaxed mb-6">
              Get deep insights into your productivity patterns with charts, heatmaps, and trend analysis.
              See which categories consume the most time and track your improvement over weeks.
            </p>
            <ul className="space-y-3 mb-8">
              {['Time breakdown by category and task', 'Weekly and monthly trend charts', 'Focus quality scoring', 'Period-over-period comparison'].map(item => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-surface-300">
                  <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" /> {item}
                </li>
              ))}
            </ul>
            <button onClick={() => navigate('/register')}
              className="text-sm font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1.5 transition-colors">
              Explore Analytics <ChevronRight size={14} />
            </button>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6 }}
            className="relative">
            <div className="absolute -inset-6 bg-gradient-to-tr from-purple-500/15 via-sky-500/10 to-transparent rounded-3xl blur-2xl" />
            <div className="relative rounded-2xl border border-surface-800/80 bg-surface-900/90 p-6 shadow-2xl">
              {/* Mock analytics card */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-surface-200">This Week</span>
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">+23% vs last week</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Focused', value: '28.5h', color: 'text-sky-400' },
                  { label: 'Quality', value: '91%', color: 'text-purple-400' },
                  { label: 'Completed', value: '12', color: 'text-emerald-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-surface-850/50 rounded-xl p-3 border border-surface-800/40">
                    <p className={`text-lg font-display font-bold ${color}`}>{value}</p>
                    <p className="text-[10px] text-surface-500">{label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-surface-850/50 rounded-xl p-4 border border-surface-800/40">
                <div className="flex items-end gap-1.5 h-28">
                  {[30, 55, 45, 75, 60, 85, 40, 70, 50, 65, 80, 55, 35].map((h, i) => (
                    <motion.div key={i}
                      className="flex-1 rounded-t-sm"
                      style={{ backgroundColor: i === 10 ? '#8b5cf6' : 'rgba(14,165,233,0.25)' }}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${h}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: 0.1 + i * 0.03 }} />
                  ))}
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[9px] text-surface-600">Mon</span>
                  <span className="text-[9px] text-surface-600">Sun</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ Testimonials ═══ */}
      <section className="border-y border-surface-800/60 bg-surface-900/30">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp} className="text-center mb-14">
            <h2 className="text-3xl lg:text-4xl font-display font-extrabold text-surface-50 mb-4 tracking-tight">
              Loved by focused people
            </h2>
            <p className="text-surface-400 text-lg">See what our users have to say</p>
          </motion.div>

          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-50px' }}
            variants={stagger} className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map(({ name, role, text, rating }, i) => (
              <motion.div key={name} variants={fadeUp}
                className="rounded-2xl border border-surface-800/60 bg-surface-900 p-6 flex flex-col">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: rating }).map((_, j) => (
                    <Star key={j} size={14} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-surface-300 leading-relaxed flex-1 mb-5">"{text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-surface-800 flex items-center justify-center text-xs font-bold text-surface-300">
                    {name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-surface-200">{name}</p>
                    <p className="text-[10px] text-surface-500">{role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}
          variants={fadeUp}
          className="relative rounded-3xl border border-surface-800/60 bg-surface-900 p-10 lg:p-16 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 via-transparent to-purple-500/10 pointer-events-none" />
          <div className="relative">
            <h2 className="text-3xl lg:text-4xl font-display font-extrabold text-surface-50 mb-4 tracking-tight">
              Ready to take control of your time?
            </h2>
            <p className="text-surface-400 text-lg max-w-lg mx-auto mb-8">
              Join thousands of productive people who use FocusFlow to do their best work every day.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.button onClick={() => navigate('/register')}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="bg-brand-500 hover:bg-brand-400 text-white font-bold px-8 py-4 rounded-2xl flex items-center gap-2.5 shadow-xl shadow-brand-500/25 transition-colors text-base">
                <Zap size={18} /> Get Started Free
              </motion.button>
              <button onClick={() => navigate('/login')}
                className="text-sm text-surface-400 hover:text-surface-200 font-semibold flex items-center gap-1.5 transition-colors">
                Already have an account? Sign In <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="border-t border-surface-800/60">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center">
                <Target size={14} className="text-white" />
              </div>
              <span className="font-display font-bold text-surface-200">FocusFlow</span>
            </div>
            <div className="flex items-center gap-6 text-xs text-surface-500">
              <span>Privacy</span>
              <span>Terms</span>
              <span>Contact</span>
            </div>
            <p className="text-xs text-surface-600">Built with focus. Shipped with love.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
