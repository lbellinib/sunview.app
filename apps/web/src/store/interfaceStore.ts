import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface InterfaceState {
  onboardingComplete: boolean;
  reducedMotion: boolean;
  sheet: 'moment' | 'delete' | null;
  setOnboardingComplete: (complete: boolean) => void;
  setReducedMotion: (value: boolean) => void;
  openSheet: (sheet: InterfaceState['sheet']) => void;
}

export const useInterfaceStore = create<InterfaceState>()(
  persist(
    (set) => ({
      onboardingComplete: false,
      reducedMotion: false,
      sheet: null,
      setOnboardingComplete: (complete) => set({ onboardingComplete: complete }),
      setReducedMotion: (value) => set({ reducedMotion: value }),
      openSheet: (sheet) => set({ sheet })
    }),
    {
      name: 'life-clock-ui'
    }
  )
);
