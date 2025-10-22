import { useEffect } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useInterfaceStore } from '../store/interfaceStore';
import { Layout } from './components/Layout';
import { NowView } from './routes/Now';
import { PastView } from './routes/Past';
import { FuturesView } from './routes/Futures';
import { SettingsView } from './routes/Settings';
import { OnboardingFlow } from './routes/Onboarding';
import { NotFound } from './routes/NotFound';
import { useLifeStore } from '../store/lifeStore';

export default function App() {
  const reducedMotion = usePrefersReducedMotion();
  const setReducedMotion = useInterfaceStore((state) => state.setReducedMotion);
  const theme = useLifeStore((state) => state.theme);
  const highContrast = useLifeStore((state) => state.highContrast);
  const setReduceMotionPreference = useLifeStore((state) => state.setReduceMotion);

  useEffect(() => {
    setReducedMotion(reducedMotion);
    setReduceMotionPreference(reducedMotion);
    document.body.classList.toggle('reduced-motion', reducedMotion);
  }, [reducedMotion, setReducedMotion, setReduceMotionPreference]);

  useEffect(() => {
    document.documentElement.dataset.theme = highContrast || theme === 'high-contrast' ? 'high-contrast' : theme;
  }, [theme, highContrast]);

  return (
    <Routes>
      <Route path="/onboarding/*" element={<OnboardingFlow />} />
      <Route element={<Layout />}>
        <Route index element={<NowView />} />
        <Route path="past" element={<PastView />} />
        <Route path="futures" element={<FuturesView />} />
        <Route path="settings" element={<SettingsView />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
