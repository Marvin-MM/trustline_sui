/**
 * Re-exports from @bondflow/types.
 * All permission checks in the frontend use these values.
 * Frontend enforcement is UX-only — backend is authoritative.
 */
export {
  Permission,
  TenantRole,
  ROLE_PERMISSIONS,
  PERSONAL_MODE_PERMISSIONS,
  type FeatureFlagKey,
  FEATURE_FLAG_KEYS,
} from '@bondflow/types';
