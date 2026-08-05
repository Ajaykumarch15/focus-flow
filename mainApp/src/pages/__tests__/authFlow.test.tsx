import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Login } from '../Login';
import { Register } from '../Register';
import { useAuthStore } from '../../store/useAuthStore';

// P0-31: the auth-form tests exercise the real form, so the enterprise
// registration flag is mocked to the community (enabled) setting.
vi.mock('../../utils/config', () => ({
  PUBLIC_REGISTRATION_ENABLED: true,
  ORGANIZATION_CONFIG: { orgName: 'Test', supportEmail: 'a@test.io', allowSelfServicePasswordReset: false },
}));

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

function renderAt(path: string, node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <LocationProbe />
        {node}
      </MemoryRouter>
    );
  });
  return { container, root };
}

function setInput(container: HTMLElement, name: string, value: string) {
  const el = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!el) throw new Error(`No input[name="${name}"]`);
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function submitForm(container: HTMLElement) {
  const form = container.querySelector('form');
  if (!form) throw new Error('No form');
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

describe('P0-31 auth flows land on the role-aware default', () => {
  const originalLogin = useAuthStore.getState().login;
  const originalRegister = useAuthStore.getState().register;
  const loginSpy = vi.fn().mockResolvedValue(undefined);
  const registerSpy = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    loginSpy.mockClear();
    registerSpy.mockClear();
    useAuthStore.setState({ login: loginSpy, register: registerSpy, loading: false, error: null, user: null });
  });

  afterEach(() => {
    useAuthStore.setState({ login: originalLogin, register: originalRegister, user: null });
  });

  it('exposes browser-autofill hints on the login form', () => {
    const { container } = renderAt('/login', <Login />);
    expect(container.querySelector('input[name="email"]')?.getAttribute('autoComplete')).toBe('email');
    expect(container.querySelector('input[name="password"]')?.getAttribute('autoComplete')).toBe('current-password');
  });

  it('exposes browser-autofill hints on the register form', () => {
    const { container } = renderAt('/register', <Register />);
    expect(container.querySelector('input[name="name"]')?.getAttribute('autoComplete')).toBe('name');
    expect(container.querySelector('input[name="email"]')?.getAttribute('autoComplete')).toBe('email');
    expect(container.querySelector('input[name="password"]')?.getAttribute('autoComplete')).toBe('new-password');
    expect(container.querySelector('input[name="confirmPassword"]')?.getAttribute('autoComplete')).toBe('new-password');
  });

  it('lands on /hub after a successful login', async () => {
    const { container } = renderAt('/login', <Login />);
    setInput(container, 'email', 'ajay@example.com');
    setInput(container, 'password', 'secret123');
    await submitForm(container);
    expect(loginSpy).toHaveBeenCalledWith('ajay@example.com', 'secret123');
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/hub');
  });

  it('lands admins on the /workspace selector instead of /hub', async () => {
    useAuthStore.setState({
      user: { _id: 'admin-1', name: 'Admin User', email: 'admin@example.com', role: 'admin', settings: {} },
    });
    const { container } = renderAt('/login', <Login />);
    setInput(container, 'email', 'admin@example.com');
    setInput(container, 'password', 'secret123');
    await submitForm(container);
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/workspace');
  });

  it('lands on /hub after a successful registration', async () => {
    const { container } = renderAt('/register', <Register />);
    setInput(container, 'name', 'Ajay Kumar');
    setInput(container, 'email', 'ajay@example.com');
    setInput(container, 'password', 'correct-horse-battery');
    setInput(container, 'confirmPassword', 'correct-horse-battery');
    await submitForm(container);
    expect(registerSpy).toHaveBeenCalledWith('Ajay Kumar', 'ajay@example.com', 'correct-horse-battery');
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/hub');
  });
});
