import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, X, Building2, HelpCircle, LogIn } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { resolveDefaultLanding } from '../lib/navigation';
import { Button } from '../components/ui/Button';
import { PUBLIC_REGISTRATION_ENABLED, ORGANIZATION_CONFIG } from '../utils/config';
import { AuthLayout } from '../components/auth/AuthLayout';
import { AuthCard } from '../components/auth/AuthCard';
import { AuthInput } from '../components/auth/AuthInput';
import { SocialAuthButton, AuthDivider } from '../components/auth/SocialAuthButton';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function friendlyAuthError(msg?: string | null): string {
  const m = (msg || '').toLowerCase();
  if (m.includes('invalid') || m.includes('credential') || m.includes('password') || m.includes('unauthorized') || m.includes('401')) {
    return 'Unable to sign you in — please check your email and password and try again.';
  }
  if (m.includes('network') || m.includes('fetch')) {
    return 'FocusFlow is unreachable right now. Check your connection and try again.';
  }
  return 'Unable to sign you in right now. Please try again in a moment.';
}

export function Login() {
  const navigate = useNavigate();
  const { login, loading, error, clearError } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const validate = (): boolean => {
    const next: typeof fieldErrors = {};
    if (!form.email.trim()) next.email = 'Please enter your email address.';
    else if (!EMAIL_RE.test(form.email.trim())) next.email = 'Please enter a valid email address.';
    if (!form.password) next.password = 'Please enter your password.';
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    clearError();
    if (!validate()) return;
    try {
      await login(form.email.trim(), form.password);
      navigate(resolveDefaultLanding(useAuthStore.getState().user?.role));
    } catch {
      // Error surfaced via the store; mapped to friendly copy below.
    }
  };

  const authError = error ? friendlyAuthError(error) : null;

  return (
    <AuthLayout>
      <AuthCard
        title="Welcome Back"
        subtitle="Sign in to continue your focus journey"
        error={authError}
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <AuthInput
            label="Email"
            name="email"
            type="email"
            icon={<Mail size={15} />}
            autoComplete="email"
            placeholder="Enter your email"
            value={form.email}
            onChange={e => {
              setForm(p => ({ ...p, email: e.target.value }));
              if (fieldErrors.email) setFieldErrors(p => ({ ...p, email: undefined }));
            }}
            autoFocus
          />

          <AuthInput
            label="Password"
            name="password"
            icon={<Lock size={15} />}
            autoComplete="current-password"
            placeholder="Enter your password"
            showToggle
            action={
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="rounded text-[11px] font-semibold text-brand-400 transition-colors hover:text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                Forgot password?
              </button>
            }
            value={form.password}
            onChange={e => {
              setForm(p => ({ ...p, password: e.target.value }));
              if (fieldErrors.password) setFieldErrors(p => ({ ...p, password: undefined }));
            }}
          />

          <Button
            type="submit"
            disabled={loading}
            loading={loading}
            leftIcon={!loading ? <LogIn size={15} /> : undefined}
            className="h-11 w-full bg-gradient-to-r from-brand-500 via-brand-600 to-violet-600 text-sm font-bold shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/30"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>

        <AuthDivider label="or continue with" />
        <SocialAuthButton onClick={() => setShowHelpModal(true)} />

        <p className="mt-6 text-center text-xs text-surface-400">
          Don't have an account?{' '}
          {PUBLIC_REGISTRATION_ENABLED ? (
            <Link to="/register" className="font-semibold text-brand-400 transition-colors hover:text-brand-300 hover:underline">
              Sign Up
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setShowAccessModal(true)}
              className="inline-flex items-center gap-1 font-semibold text-brand-400 transition-colors hover:text-brand-300"
            >
              <Building2 size={12} />
              Request access
            </button>
          )}
        </p>
      </AuthCard>

      {/* Managed Access Info Modal */}
      <AnimatePresence>
        {showAccessModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm" onClick={() => setShowAccessModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md space-y-4 rounded-2xl border border-surface-800 bg-surface-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-brand-400" />
                  <h3 className="font-display text-sm font-bold text-surface-50">Managed Workspace Access</h3>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowAccessModal(false)}><X size={15} /></Button>
              </div>

              <div className="space-y-2 rounded-xl border border-surface-800 bg-surface-850 p-4 text-xs leading-relaxed text-surface-300">
                <p className="font-bold text-surface-100">Public self-registration is disabled for this workspace.</p>
                <p>
                  This FocusFlow engineering environment is strictly provisioned and managed by your organization's IT / Workspace Administrators.
                </p>
                <p className="text-surface-400">
                  To request access, please contact your engineering lead or email <code className="font-mono text-brand-300">{ORGANIZATION_CONFIG.supportEmail}</code>.
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
              className="w-full max-w-md space-y-4 rounded-2xl border border-surface-800 bg-surface-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle size={18} className="text-amber-400" />
                  <h3 className="font-display text-sm font-bold text-surface-50">Authentication Help</h3>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowHelpModal(false)}><X size={15} /></Button>
              </div>
              <p className="text-xs leading-relaxed text-surface-300">
                Password resets for managed enterprise accounts are handled by your organization's Workspace Administrator. Contact your admin or system team to issue a credential reset token.
              </p>
              <Button onClick={() => setShowHelpModal(false)} variant="secondary" className="w-full text-xs font-bold">
                Close
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
