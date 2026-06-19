import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot = process.cwd();

describe('dashboard navigation invariants', () => {
  it('links personal dashboard actions only to implemented personal routes', () => {
    const source = readFileSync(join(webRoot, 'app/dashboard/dashboard-client.tsx'), 'utf8');
    const routes = readFileSync(join(webRoot, 'constants/routes.ts'), 'utf8');

    expect(source).not.toContain('href="/relationships"');
    expect(source).not.toContain('href="/relationships/new"');
    expect(source).not.toContain('href="/reputation"');
    expect(source).toContain('ROUTES.personalRelationships()');
    expect(routes).toContain("personalRelationships: () => '/dashboard/relationships'");
    expect(source).toContain('Create Workspace');
    expect(source).toContain('Open workspace');
  });

  it('keeps the tenant switcher available outside tenant mode', () => {
    const source = readFileSync(join(webRoot, 'components/layout/sidebar.tsx'), 'utf8');

    expect(source).toMatch(/<SidebarHeader>[\s\S]*?<TenantSwitcher \/>/);
    expect(source).not.toMatch(/\{tenantSlug && \([\s\S]{0,300}<TenantSwitcher \/>/);
  });

  it('shows platform admin navigation only for platform admin sessions', () => {
    const sidebarSource = readFileSync(join(webRoot, 'components/layout/sidebar.tsx'), 'utf8');
    const adminSource = readFileSync(join(webRoot, 'app/[tenantSlug]/admin/admin-client.tsx'), 'utf8');

    expect(sidebarSource).toContain('const showAdminSection = hasTenant && isPlatformAdmin');
    expect(adminSource).toContain('const canAdmin = isPlatformAdmin');
    expect(adminSource).toContain('configured platform admin wallet');
  });

  it('does not ask users to provide Walrus memory ids while creating relationships', () => {
    const createSource = readFileSync(join(webRoot, 'app/[tenantSlug]/relationships/new/create-relationship-client.tsx'), 'utf8');
    const hookSource = readFileSync(join(webRoot, 'hooks/use-create-relationship.ts'), 'utf8');

    expect(createSource).not.toContain('Walrus Memory Space ID');
    expect(createSource).not.toContain("register('walrusMemorySpaceId')");
    expect(hookSource).not.toContain('walrusMemorySpaceId: z.string().optional()');
  });
});
