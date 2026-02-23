import { create } from 'zustand';

interface UIState {
  catalogModalOpen: boolean;
  wizardModalOpen: boolean;
  openCatalogModal: () => void;
  closeCatalogModal: () => void;
  openWizardModal: () => void;
  closeWizardModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  catalogModalOpen: false,
  wizardModalOpen: false,
  openCatalogModal: () => set({ catalogModalOpen: true, wizardModalOpen: false }),
  closeCatalogModal: () => set({ catalogModalOpen: false }),
  openWizardModal: () => set({ wizardModalOpen: true, catalogModalOpen: false }),
  closeWizardModal: () => set({ wizardModalOpen: false }),
}));
