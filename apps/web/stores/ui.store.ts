/**
 * UI store — sidebar state and modal orchestration.
 *
 * Modal orchestration pattern:
 * Complex flows (create tenant, grant cap, raise dispute) open modals
 * by dispatching openModal() with an ID and props. This avoids prop-drilling.
 * Components read from this store with useUIStore.
 */

import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  activeModal: string | null;
  modalProps: Record<string, unknown>;

  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  openModal: (id: string, props?: Record<string, unknown>) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  activeModal: null,
  modalProps: {},

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

  openModal: (id, props = {}) =>
    set({ activeModal: id, modalProps: props }),

  closeModal: () =>
    set({ activeModal: null, modalProps: {} }),
}));

// Modal ID constants — never use raw strings
export const MODAL_IDS = {
  CREATE_TENANT: 'create-tenant',
  CONFIRM_DIALOG: 'confirm-dialog',
  PTB_PREVIEW: 'ptb-preview',
  GRANT_AGENT_CAP: 'grant-agent-cap',
  RAISE_DISPUTE: 'raise-dispute',
  QR_CODE: 'qr-code',
} as const;
