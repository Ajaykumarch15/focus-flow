import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Mail, Lock, Eye, EyeOff, UserPlus, Building2, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useStore } from '../store/useStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PUBLIC_REGISTRATION_ENABLED, ORGANIZATION_CONFIG } from '../utils/config';

export function Register() {
  const navigate  = useNavigate();
  const { register, loading, error, clearError } = useAuthStore();
  const { theme } = useStore();
  const [form, setForm]     = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [localErr, setLocalErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalErr('');

    if (form.password !== form.confirm) {
      setLocalErr('Passwords do not match');
      return;
    }
    if (form.password.length < 12) {
      setLocalErr('Password must be at least 12 characters');
      return;
    }

    try {
      await register(form.name, form.email, form.password);
      navigate('/hub');
    } catch {
      // Error shown from store
    }
  };

  const displayError = localErr || error;

  // Enterprise Managed Workspace Access Notice (Public Registration Disabled)
  if (!PUBLIC_REGISTRATION_ENABLED) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4 py-8 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />

        <Link
          to="/"
          className="absolute top-5 left-5 flex items-center gap-1.5 text-xs font-semibold text-surface-400 hover:text-surface-100 transition-colors"
        >
          <ArrowLeft size={15} />
          Back to Portal
        </Link>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
          <Card className="p-8 text-center space-y-5 border-surface-800 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto">
              <Building2 size={26} className="text-brand-400" />
            </div>

            <div>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <ShieldCheck size={15} className="text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Managed Enterprise Workspace
                </span>
              </div>
              <h2 className="text-xl font-display font-extrabold text-surface-50">Public Self-Registration Disabled</h2>
            </div>

            <div className="p-4 rounded-xl bg-surface-850 border border-surface-800 text-xs text-surface-300 leading-relaxed text-left space-y-2">
              <p className="font-semibold text-surface-100">This FocusFlow environment is managed by your organization.</p>
              <p>
                Accounts can only be created by Workspace Administrators. Self-registration is currently disabled for security and governance.
              </p>
              <p className="text-surface-400">
                Contact your IT Administrator or email <code className="text-brand-300 font-mono">{ORGANIZATION_CONFIG.supportEmail}</code> to request an account.
              </p>
            </div>

            <Button onClick={() => navigate('/login')} className="w-full text-xs font-bold shadow-lg shadow-brand-500/20">
              Return to Login
            </Button>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4 py-8 overflow-y-auto relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />

      <Link
        to="/"
        className="absolute top-5 left-5 flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-100 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to home
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative"
      >
        <div className="flex flex-col items-center mb-8">
          <Link to="/" aria-label="FocusFlow home" className="block mb-4">
            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg shadow-brand-500/25">
              <img src={theme.mode === 'dark' ? '/darkicon.png' : '/lighticon.png'} alt="FocusFlow" className="w-full h-full" />
            </div>
          </Link>
          <h1 className="text-2xl font-display font-bold text-surface-50">Create account</h1>
          <p className="text-surface-400 mt-1 text-sm">Start tracking your focus with FocusFlow</p>
        </div>

        <Card className="p-8">
          {displayError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-3 bg-danger-500/10 border border-danger-500/20 rounded-xl text-sm text-danger-600 dark:text-danger-400"
            >
              {displayError}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-surface-300 mb-1.5">Full Name</label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
                <Input
                  name="name"
                  autoComplete="name"
                  className="pl-10"
                  placeholder="Alex Johnson"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-surface-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
                <Input
                  type="email"
                  name="email"
                  autoComplete="email"
                  className="pl-10"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-surface-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
                <Input
                  type={showPass ? 'text' : 'password'}
                  name="password"
                  autoComplete="new-password"
                  className="pl-10 pr-10"
                  placeholder="Min 12 characters"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 transition-colors"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-surface-300 mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
                <Input
                  type={showPass ? 'text' : 'password'}
                  name="confirmPassword"
                  autoComplete="new-password"
                  className="pl-10"
                  placeholder="Repeat password"
                  value={form.confirm}
                  onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full mt-2"
              loading={loading}
              leftIcon={!loading ? <UserPlus size={16} /> : undefined}
              aria-label={loading ? 'Creating account' : 'Create Account'}
            >
              Create Account
            </Button>
          </form>

          <p className="text-center text-sm text-surface-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </Card>
      </motion.div>
    </div>
  );
}

