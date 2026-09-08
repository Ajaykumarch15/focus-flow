// Unified role display helpers — maps role keys to human-readable labels

// Map any legacy role string to unified role key
export function normalizeRole(role: string): string {
  switch (role) {
    case 'superadmin':
    case 'Superadmin':
      return 'superadmin';
    case 'Admin':
    case 'admin':
      return 'admin';
    case 'Owner':
    case 'owner':
    case 'Manager':
    case 'manager':
      return 'admin';
    case 'Member':
    case 'member':
    case 'user':
    case 'User':
    case 'Editor':
    case 'Viewer':
    case 'nonadmin':
      return 'nonadmin';
    default:
      return role;
  }
}

export function getRoleDisplayName(role: string): string {
  switch (role) {
    case 'superadmin': return 'Super Admin';
    case 'admin': return 'Admin';
    case 'nonadmin':
    case 'user':
      return 'Nonadmin';
    default: return role;
  }
}

export function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'superadmin':
      return 'bg-amber-500/15 text-amber-400 border border-amber-500/20';
    case 'admin':
      return 'bg-brand-500/15 text-brand-400 border border-brand-500/20';
    default:
      return 'bg-surface-800 text-surface-400 border border-surface-800';
  }
}

export function getWorkspaceRoles(isSuperAdmin: boolean) {
  return isSuperAdmin
    ? [
        { value: 'superadmin', label: 'Super Admin', color: 'text-amber-400' },
        { value: 'admin', label: 'Admin', color: 'text-brand-400' },
        { value: 'nonadmin', label: 'Nonadmin', color: 'text-surface-400' },
      ]
    : [
        { value: 'admin', label: 'Admin', color: 'text-brand-400' },
        { value: 'nonadmin', label: 'Nonadmin', color: 'text-surface-400' },
      ];
}

export function getSystemRoles(isSuperAdmin: boolean) {
  return isSuperAdmin
    ? [
        { value: 'superadmin', label: 'Super Admin' },
        { value: 'admin', label: 'Admin' },
        { value: 'nonadmin', label: 'Nonadmin' },
      ]
    : [
        { value: 'admin', label: 'Admin' },
        { value: 'nonadmin', label: 'Nonadmin' },
      ];
}
