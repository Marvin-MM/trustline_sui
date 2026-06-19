/**
 * Tenant management routes.
 */

import { Elysia, t } from 'elysia';
import { authMiddleware } from '../middleware/auth.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { ownerOnlyGuard, permissionGuard } from '../middleware/rbac.middleware';
import { InviteMemberSchema, Permission } from '@bondflow/types';
import { logger } from '../lib/logger';
import { env } from '../config/env';
import { tenantManagementService } from '../services/tenant-management';

const tLogger = logger.child({ module: 'routes.tenants' });

function tenantParamPermission(permission: Permission) {
  const guard = permissionGuard(permission);
  return (ctx: unknown) => {
    const c = ctx as {
      auth: { isPlatformAdmin: boolean } | null;
      tenantContext: { tenantId: string | null };
      params: { tenantId: string };
      set: { status: number | string };
    };
    const denied = guard(ctx);
    if (denied) return denied;
    if (!c.auth?.isPlatformAdmin && c.tenantContext.tenantId !== c.params.tenantId) {
      c.set.status = 403;
      return { error: 'Forbidden', message: 'Tenant context does not match route tenant', statusCode: 403 };
    }
    return undefined;
  };
}

function tenantParamOwnerOnly() {
  const guard = ownerOnlyGuard();
  return (ctx: unknown) => {
    const c = ctx as {
      auth: { isPlatformAdmin: boolean } | null;
      tenantContext: { tenantId: string | null };
      params: { tenantId: string };
      set: { status: number | string };
    };
    const denied = guard(ctx);
    if (denied) return denied;
    if (!c.auth?.isPlatformAdmin && c.tenantContext.tenantId !== c.params.tenantId) {
      c.set.status = 403;
      return { error: 'Forbidden', message: 'Tenant context does not match route tenant', statusCode: 403 };
    }
    return undefined;
  };
}

export const tenantRoutes = new Elysia({ prefix: '/api/v1/tenants' })
  .use(authMiddleware)
  .use(tenantMiddleware)

  .post('/', async ({ auth, body, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const result = await tenantManagementService.createTenant(auth, body);
    if (result.conflict) { set.status = 409; return { error: 'Slug already taken' }; }
    tLogger.info({ tenantId: result.tenant.id }, 'Tenant created');
    return result.tenant;
  }, { body: t.Object({ name: t.String(), slug: t.String() }) })

  .get('/', async ({ auth, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    return tenantManagementService.listUserTenants(auth.userId, auth.isPlatformAdmin);
  })

  .get('/check-slug/:slug', async ({ params }) => {
    return { available: await tenantManagementService.isSlugAvailable(params.slug) };
  })

  .get('/invitations/pending', async ({ auth, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    return tenantManagementService.listPendingInvitations(auth);
  })

  .post('/invitations/:invitationId/decline', async ({ params, auth, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const result = await tenantManagementService.declineInvitation(auth, params.invitationId);
    if ('notFound' in result) { set.status = 404; return { error: 'Pending invitation not found' }; }
    return result;
  })

  .get('/:tenantId', async ({ params, set }) => {
    const tenant = await tenantManagementService.getTenant(params.tenantId);
    if (!tenant) { set.status = 404; return { error: 'Tenant not found' }; }
    return tenant;
  }, { beforeHandle: tenantParamPermission(Permission.TENANT_READ) })

  .patch('/:tenantId', async ({ params, body, auth, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    return tenantManagementService.updateTenant(auth, params.tenantId, body);
  }, { beforeHandle: tenantParamPermission(Permission.TENANT_MANAGE), body: t.Object({ name: t.Optional(t.String()), isActive: t.Optional(t.Boolean()) }) })

  .get('/:tenantId/members', async ({ params, query }) => {
    const page = parseInt(query['page'] ?? '1');
    const limit = parseInt(query['limit'] ?? '20');
    return tenantManagementService.listMembers(params.tenantId, page, limit);
  }, { beforeHandle: tenantParamPermission(Permission.TENANT_READ) })

  .post('/:tenantId/members/invite', async ({ params, body, auth, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const parsed = InviteMemberSchema.safeParse(body);
    if (!parsed.success) { set.status = 422; return { error: 'Invalid invitation', details: parsed.error.flatten() }; }
    const result = await tenantManagementService.inviteMember(auth, params.tenantId, parsed.data);
    if ('invalid' in result) { set.status = 400; return { error: result.invalid }; }
    if (result.conflict) { set.status = 409; return { error: 'User already a member' }; }
    tLogger.info({ tenantId: params.tenantId }, 'Member invited');
    return env.NODE_ENV === 'production'
      ? { ...result.membership, invitationDelivery: result.invitationDelivery }
      : { ...result.membership, inviteToken: result.inviteToken, invitationDelivery: result.invitationDelivery };
  }, {
    beforeHandle: tenantParamPermission(Permission.TENANT_MANAGE),
    body: t.Object({ walletAddress: t.String(), role: t.String(), email: t.Optional(t.String()) }),
  })

  .post('/:tenantId/members/accept', async ({ params, body, auth, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const result = await tenantManagementService.acceptInvitation(auth, params.tenantId, body.inviteToken);
    if ('invalid' in result) { set.status = 400; return { error: 'Invalid or expired invitation token' }; }
    if ('notFound' in result) { set.status = 404; return { error: 'No pending invitation' }; }
    return {
      membership: result.accepted,
      alreadyAccepted: 'alreadyAccepted' in result,
    };
  }, { body: t.Object({ inviteToken: t.Optional(t.String()) }) })

  .delete('/:tenantId/members/:userId', async ({ params, auth, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const result = await tenantManagementService.removeMember(auth, params.tenantId, params.userId);
    if ('invalid' in result) { set.status = 400; return { error: 'OWNER cannot be removed; transfer ownership first' }; }
    return { message: 'Member removed' };
  }, { beforeHandle: tenantParamPermission(Permission.TENANT_MANAGE) })

  .patch('/:tenantId/members/:userId/role', async ({ params, body, auth, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const result = await tenantManagementService.updateMemberRole(auth, params.tenantId, params.userId, body.role);
    if ('invalid' in result) { set.status = 400; return { error: result.invalid }; }
    return result;
  }, { beforeHandle: tenantParamOwnerOnly(), body: t.Object({ role: t.String() }) })

  .post('/:tenantId/transfer-ownership', async ({ params, body, auth, set }) => {
    if (!auth) { set.status = 401; return { error: 'Unauthorized' }; }
    const result = await tenantManagementService.transferOwnership(auth, params.tenantId, body.targetUserId);
    if ('invalid' in result) { set.status = 400; return { error: result.invalid }; }
    return { message: 'Ownership transferred', ownerUserId: result.ownerUserId };
  }, { beforeHandle: tenantParamOwnerOnly(), body: t.Object({ targetUserId: t.String() }) })

  .get('/:tenantId/usage', async ({ params, query }) => {
    const range = query['range'];
    return tenantManagementService.getUsage(
      params.tenantId,
      range === '7d' || range === '90d' ? range : '30d',
    );
  }, { beforeHandle: tenantParamPermission(Permission.USAGE_READ) });
