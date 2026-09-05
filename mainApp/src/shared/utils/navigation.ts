export type NavRole = 'user' | 'admin';

export function resolveDefaultLanding(role: NavRole | null | undefined): string {
  if (role === 'admin') return '/workspace';
  return '/home';
}
