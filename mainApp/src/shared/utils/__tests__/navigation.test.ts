import { describe, it, expect } from 'vitest';
import { resolveDefaultLanding } from '../navigation';

describe('resolveDefaultLanding — ARK §7 role-aware default views', () => {
  it('sends members (level 10) to the homepage', () => {
    expect(resolveDefaultLanding(10)).toBe('/home');
  });

  it('sends admins (level 60) to the /workspace selector', () => {
    expect(resolveDefaultLanding(60)).toBe('/workspace');
  });

  it('sends owners (level 80) to the /workspace selector', () => {
    expect(resolveDefaultLanding(80)).toBe('/workspace');
  });

  it('sends superadmins (level 100) to the /workspace selector', () => {
    expect(resolveDefaultLanding(100)).toBe('/workspace');
  });

  it('falls back to /home when the role is unknown', () => {
    expect(resolveDefaultLanding(null)).toBe('/home');
    expect(resolveDefaultLanding(undefined)).toBe('/home');
  });
});
