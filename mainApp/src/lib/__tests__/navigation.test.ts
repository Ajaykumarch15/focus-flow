import { describe, it, expect } from 'vitest';
import { resolveDefaultLanding } from '../navigation';

describe('resolveDefaultLanding — ARK §7 role-aware default views', () => {
  it('sends developers to the homepage', () => {
    expect(resolveDefaultLanding('user')).toBe('/home');
  });

  it('sends workspace owners to the /workspace selector', () => {
    expect(resolveDefaultLanding('admin')).toBe('/workspace');
  });

  it('falls back to /home when the role is unknown', () => {
    expect(resolveDefaultLanding(null)).toBe('/home');
    expect(resolveDefaultLanding(undefined)).toBe('/home');
  });
});
