'use client';

import { useUIStore, MODAL_IDS } from '@/stores/ui.store';
import { CreateTenantModal } from '@/components/tenants/create-tenant-modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

/**
 * ModalOrchestrator — reads from UIStore and renders the active modal.
 * All modals are registered here — never opened by local component state.
 * This makes it trivial to open any modal from anywhere (toasts, keyboard shortcuts, etc).
 */
export function ModalOrchestrator() {
  const { activeModal, modalProps, closeModal } = useUIStore();

  return (
    <>
      <CreateTenantModal
        open={activeModal === MODAL_IDS.CREATE_TENANT}
        onOpenChange={(open) => !open && closeModal()}
      />

      <ConfirmDialog
        open={activeModal === MODAL_IDS.CONFIRM_DIALOG}
        onOpenChange={(open) => !open && closeModal()}
        title={(modalProps['title'] as string) ?? 'Confirm action'}
        description={(modalProps['description'] as string) ?? 'Are you sure?'}
        confirmLabel={(modalProps['confirmLabel'] as string) ?? 'Confirm'}
        cancelLabel={(modalProps['cancelLabel'] as string) ?? 'Cancel'}
        variant={(modalProps['variant'] as 'default' | 'destructive') ?? 'default'}
        onConfirm={async () => {
          const cb = modalProps['onConfirm'] as (() => void | Promise<void>) | undefined;
          await cb?.();
          closeModal();
        }}
      />
    </>
  );
}
