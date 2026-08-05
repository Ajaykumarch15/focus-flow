import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Mail, Lock, Eye, EyeOff, LogIn, ShieldCheck, HelpCircle, X, Building2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useStore } from '../store/useStore';
import { resolveDefaultLanding } from '../lib/navigation';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PUBLIC_REGISTRATION_ENABLED, ORGANIZATION_CONFIG } from '../utils/config';

export function Login() {
  const navigate = useNavigate();
  const { login, loading, error, clearError } = useAuthStore();
  const { theme } = useStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login(form.email, form.password);
      navigate(resolveDefaultLanding(useAuthStore.getState().user?.role));
    } catch {
      // Error handled in store
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4 py-8 overflow-y-auto relative">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />

      {/* Back link */}
      <Link
        to="/"
        className="absolute top-5 left-5 flex items-center gap-1.5 text-xs font-semibold text-surface-400 hover:text-surface-100 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to Portal
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <Link to="/" aria-label="FocusFlow Portal" className="block mb-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-xl shadow-brand-500/20 border border-surface-700">
              <img src={theme.mode === 'dark' ? '/darkicon.png' : '/lighticon.png'} alt="FocusFlow" className="w-full h-full" />
            </div>
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400/90">
              Managed Enterprise Workspace
            </span>
          </div>
          <h1 className="text-2xl font-display font-extrabold text-surface-50">Sign In to FocusFlow</h1>
          <p className="text-surface-400 mt-1 text-xs max-w-xs">
            Enter your organization credentials to access your engineering command center.
          </p>
        </div>

        {/* Login Form Card */}
        <Card className="p-8 space-y-5 border-surface-800 shadow-2xl">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 bg-danger-500/10 border border-danger-500/20 rounded-xl text-xs text-danger-400 font-medium"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-surface-300 mb-1.5 uppercase tracking-wider">
                Work Email
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
                <Input
                  type="email"
                  name="email"
                  autoComplete="email"
                  className="pl-10 text-xs bg-surface-900 border-surface-750"
                  placeholder="name@organization.com"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-surface-300 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowHelpModal(true)}
                  className="text-[11px] text-brand-400 hover:text-brand-300 font-semibold transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
                <Input
                  type={showPass ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  className="pl-10 pr-10 text-xs bg-surface-900 border-surface-750"
                  placeholder="••••••••"
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

            <Button
              type="submit"
              className="w-full mt-2 text-xs font-bold shadow-lg shadow-brand-500/20"
              loading={loading}
              leftIcon={!loading ? <LogIn size={15} /> : undefined}
            >
              Authenticate Session
            </Button>
          </form>

          {/* Account Provisioning Options */}
          <div className="pt-4 border-t border-surface-800 flex items-center justify-between text-xs">
            {PUBLIC_REGISTRATION_ENABLED ? (
              <p className="text-surface-400 mx-auto">
                Need an account?{' '}
                <Link to="/register" className="text-brand-400 hover:underline font-semibold">
                  Register
                </Link>
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setShowAccessModal(true)}
                className="text-surface-400 hover:text-surface-200 transition-colors font-medium flex items-center gap-1.5 mx-auto"
              >
                <Building2 size={13} className="text-brand-400" />
                <span>Need a workspace account?</span>
              </button>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Managed Access Info Modal */}
      <AnimatePresence>
        {showAccessModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm" onClick={() => setShowAccessModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-surface-800 bg-surface-900 p-6 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-brand-400" />
                  <h3 className="font-display font-bold text-surface-50 text-sm">Managed Workspace Access</h3>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowAccessModal(false)}><X size={15} /></Button>
              </div>

              <div className="p-4 rounded-xl bg-surface-850 border border-surface-800 space-y-2 text-xs text-surface-300 leading-relaxed">
                <p className="font-bold text-surface-100">Public self-registration is disabled for this workspace.</p>
                <p>
                  This FocusFlow engineering environment is strictly provisioned and managed by your organization's IT / Workspace Administrators.
                </p>
                <p className="text-surface-400">
                  To request access, please contact your engineering lead or email <code className="text-brand-300 font-mono">{ORGANIZATION_CONFIG.supportEmail}</code>.
                </p>
              </div>

              <Button onClick={() => setShowAccessModal(false)} variant="secondary" className="w-full text-xs font-bold">
                Back to Login
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelpModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm" onClick={() => setShowHelpModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-surface-800 bg-surface-900 p-6 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle size={18} className="text-amber-400" />
                  <h3 className="font-display font-bold text-surface-50 text-sm">Authentication Help</h3>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowHelpModal(false)}><X size={15} /></Button>
              </div>
              <p className="text-xs text-surface-300 leading-relaxed">
                Password resets for managed enterprise accounts are handled by your organization's Workspace Administrator. Contact your admin or system team to issue a credential reset token.
              </p>
              <Button onClick={() => setShowHelpModal(false)} variant="secondary" className="w-full text-xs font-bold">
                Close
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

