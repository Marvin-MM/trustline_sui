import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { ModalOrchestrator } from '@/components/layout/modal-orchestrator';
import { TenantRouteGuard } from '@/components/tenants/tenant-route-guard';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return (
    <TenantRouteGuard tenantSlug={tenantSlug}>
      <SidebarProvider>
        <Sidebar />
        <SidebarInset>
          <TopBar />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl px-6 py-6">
              {children}
            </div>
          </main>
        </SidebarInset>
        <ModalOrchestrator />
      </SidebarProvider>
    </TenantRouteGuard>
  );
}
