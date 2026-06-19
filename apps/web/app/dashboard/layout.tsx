import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { ModalOrchestrator } from '@/components/layout/modal-orchestrator';
import { AuthRouteGuard } from '@/components/auth/auth-route-guard';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthRouteGuard>
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
    </AuthRouteGuard>
  );
}
