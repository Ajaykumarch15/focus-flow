export type NavRole = 'user' | 'admin';

export function resolveDefaultLanding(role: NavRole | null | undefined): string {
  return role === 'admin' ? '/workspace' : '/hub';
}
