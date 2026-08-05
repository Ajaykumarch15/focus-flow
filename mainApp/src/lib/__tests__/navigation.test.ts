import { describe, it, expect } from 'vitest';
import { resolveDefaultLanding } from '../navigation';

describe('resolveDefaultLanding — ARK §7 role-aware default views', () => {
  it('sends developers to the companion switcher /hub', () => {
    expect(resolveDefaultLanding('user')).toBe('/hub');
  });

  it('sends workspace owners to the /workspace selector', () => {
    expect(resolveDefaultLanding('admin')).toBe('/workspace');
  });

  it('falls back to /hub when the role is unknown', () => {
    expect(resolveDefaultLanding(null)).toBe('/hub');
    expect(resolveDefaultLanding(undefined)).toBe('/hub');
  });
});
