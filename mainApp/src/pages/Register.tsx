import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, UserPlus, Building2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { resolveDefaultLanding } from '../lib/navigation';
import { Button } from '../components/ui/Button';
import { PUBLIC_REGISTRATION_ENABLED, ORGANIZATION_CONFIG } from '../utils/config';
import { AuthLayout } from '../components/auth/AuthLayout';
import { AuthCard } from '../components/auth/AuthCard';
import { AuthInput } from '../components/auth/AuthInput';
import { SocialAuthButton, AuthDivider } from '../components/auth/SocialAuthButton';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

export function Register() {
  const navigate = useNavigate();
  const { register, loading, error, clearError } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!form.name.trim()) next.name = 'Please enter your name.';
    if (!form.email.trim()) next.email = 'Please enter your email address.';
    else if (!EMAIL_RE.test(form.email.trim())) next.email = 'Please enter a valid email address.';
    if (!form.password) next.password = 'Please create a password.';
    else if (form.password.length < 12) next.password = 'Password must be at least 12 characters.';
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    clearError();
    if (!validate()) return;
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
      navigate(resolveDefaultLanding(useAuthStore.getState().user?.role));
    } catch {
      // Error surfaced via the store; mapped to friendly copy below.
    }
  };

  const friendlyError = (): string | null => {
    if (!error) return null;
    const m = error.toLowerCase();
    if (m.includes('exist') || m.includes('duplicate') || m.includes('already')) {
      return 'An account with this email already exists. Try signing in instead.';
    }
    if (m.includes('password') || m.includes('12')) {
      return 'Your password must be at least 12 characters long.';
    }
    if (m.includes('network') || m.includes('fetch')) {
      return 'FocusFlow is unreachable right now. Check your connection and try again.';
    }
    return 'Unable to create your account right now. Please try again in a moment.';
  };

  if (!PUBLIC_REGISTRATION_ENABLED) {
    return (
      <AuthLayout>
        <AuthCard
          title="Create your account"
          subtitle="Start your focused journey"
          error="Public self-registration is disabled for this workspace."
        >
          <div className="space-y-2 rounded-xl border border-surface-800 bg-surface-850 p-4 text-xs leading-relaxed text-surface-300">
            <p className="flex items-center gap-1.5 font-bold text-surface-100">
              <Building2 size={13} className="text-brand-400" />
              Managed Workspace Access
            </p>
            <p>
              This FocusFlow engineering environment is strictly provisioned and managed by your organization's IT / Workspace Administrators.
            </p>
            <p className="text-surface-400">
              To request access, please contact your engineering lead or email{' '}
              <code className="font-mono text-brand-300">{ORGANIZATION_CONFIG.supportEmail}</code>.
            </p>
          </div>
          <Link to="/login" className="mt-4 block">
            <Button variant="secondary" className="h-11 w-full text-sm font-bold">
              Back to Sign In
            </Button>
          </Link>
        </AuthCard>
      </AuthLayout>
  );
}

  return (
    <AuthLayout>
      <AuthCard
        title="Create your account"
        subtitle="Start your focused journey"
        error={friendlyError()}
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <AuthInput
            label="Name"
            name="name"
            type="text"
            icon={<User size={15} />}
            autoComplete="name"
            placeholder="Enter your name"
            value={form.name}
            onChange={e => {
              setForm(p => ({ ...p, name: e.target.value }));
              if (fieldErrors.name) setFieldErrors(p => ({ ...p, name: undefined }));
            }}
          />

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
          />

          <AuthInput
            label="Password"
            name="password"
            type="password"
            icon={<Lock size={15} />}
            autoComplete="new-password"
            placeholder="Create a password (min. 12 characters)"
            showToggle
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
            leftIcon={!loading ? <UserPlus size={15} /> : undefined}
            className="h-11 w-full bg-gradient-to-r from-brand-500 via-brand-600 to-violet-600 text-sm font-bold shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/30"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </Button>
        </form>

        <AuthDivider label="or continue with" />
        <SocialAuthButton />

        <p className="mt-6 text-center text-xs text-surface-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-400 transition-colors hover:text-brand-300 hover:underline">
            Sign In
          </Link>
        </p>
      </AuthCard>
    </AuthLayout>
  );
}
