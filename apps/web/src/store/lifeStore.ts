import { DateTime } from 'luxon';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Moment } from '../components/MomentCard/MomentCard';

export type ToneOption = 'quiet-urgency';
export type ThemeOption = 'light' | 'dark' | 'high-contrast';

interface LifeState {
  dob?: string;
  expectancyYears: number;
  tone: ToneOption;
  theme: ThemeOption;
  reduceMotion: boolean;
  highContrast: boolean;
  moments: Moment[];
  selectedWeek?: number;
  setDob: (dob: string) => void;
  setExpectancy: (years: number) => void;
  setTone: (tone: ToneOption) => void;
  setTheme: (theme: ThemeOption) => void;
  setReduceMotion: (value: boolean) => void;
  setHighContrast: (value: boolean) => void;
  upsertMoment: (moment: Moment) => void;
  removeMoment: (id: string) => void;
  setSelectedWeek: (week?: number) => void;
}

const defaultState = {
  expectancyYears: 90,
  tone: 'quiet-urgency' as ToneOption,
  theme: 'light' as ThemeOption,
  reduceMotion: false,
  highContrast: false,
  moments: [] as Moment[]
};

export const useLifeStore = create<LifeState>()(
  persist(
    (set) => ({
      ...defaultState,
      setDob: (dob) => set({ dob }),
      setExpectancy: (years) => set({ expectancyYears: years }),
      setTone: (tone) => set({ tone }),
      setTheme: (theme) => set({ theme }),
      setReduceMotion: (value) => set({ reduceMotion: value }),
      setHighContrast: (value) => set({ highContrast: value }),
      upsertMoment: (moment) =>
        set((state) => ({
          moments: state.moments.some((item) => item.id === moment.id)
            ? state.moments.map((item) => (item.id === moment.id ? moment : item))
            : [...state.moments, moment]
        })),
      removeMoment: (id) => set((state) => ({ moments: state.moments.filter((item) => item.id !== id) })),
      setSelectedWeek: (week) => set({ selectedWeek: week })
    }),
    {
      name: 'life-clock-state',
      version: 1
    }
  )
);

export function getWeekIndex(dob?: string) {
  if (!dob) return 0;
  const birth = DateTime.fromISO(dob);
  const now = DateTime.now();
  const diff = now.diff(birth, 'weeks').weeks;
  return Math.floor(diff);
}

export function totalWeeks(expectancyYears: number) {
  return Math.round(expectancyYears * 52);
}
