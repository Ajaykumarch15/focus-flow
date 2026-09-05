/**
 * Feature Flag Configuration for FocusFlow Enterprise Edition
 * 
 * PUBLIC_REGISTRATION_ENABLED: Controls whether public self-registration is allowed.
 * - Set to `false` for Enterprise-managed workspaces (admin provisioning only).
 * - Set to `true` for Community SaaS edition.
 */
export const PUBLIC_REGISTRATION_ENABLED = true;

export const ORGANIZATION_CONFIG = {
  orgName: 'Enterprise Workspace',
  supportEmail: 'admin@focusflow.internal',
  allowSelfServicePasswordReset: false,
};
