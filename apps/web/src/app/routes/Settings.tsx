import { ChangeEvent, useState } from 'react';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Toggle } from '../../components/UI/Toggle';
import { useLifeStore } from '../../store/lifeStore';
import { useInterfaceStore } from '../../store/interfaceStore';
import { useToast } from '../../components/UI/ToastProvider';

export function SettingsView() {
  const dob = useLifeStore((state) => state.dob);
  const expectancyYears = useLifeStore((state) => state.expectancyYears);
  const theme = useLifeStore((state) => state.theme);
  const highContrast = useLifeStore((state) => state.highContrast);
  const reduceMotion = useLifeStore((state) => state.reduceMotion);
  const setDob = useLifeStore((state) => state.setDob);
  const setExpectancy = useLifeStore((state) => state.setExpectancy);
  const setTheme = useLifeStore((state) => state.setTheme);
  const setHighContrast = useLifeStore((state) => state.setHighContrast);
  const setReduceMotion = useLifeStore((state) => state.setReduceMotion);
  const setOnboardingComplete = useInterfaceStore((state) => state.setOnboardingComplete);
  const { push } = useToast();
  const [notifications, setNotifications] = useState(false);

  const handleExpectancy = (event: ChangeEvent<HTMLInputElement>) => {
    setExpectancy(Number(event.target.value));
  };

  const exportData = () => {
    const payload = JSON.stringify({ dob, expectancyYears }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'life-clock-export.json';
    link.click();
    URL.revokeObjectURL(url);
    push({ message: 'Data exported', tone: 'success' });
  };

  return (
    <div className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-text">Settings</h1>
          <p className="text-sm text-muted">Tune assumptions and accessibility preferences.</p>
        </header>
        <section className="space-y-4 rounded-2xl border border-slate-700 bg-surface-elevated p-6">
          <h2 className="text-lg font-semibold text-text">Life expectancy</h2>
          <label className="block text-sm text-muted">
            {expectancyYears} years
            <input
              type="range"
              min={40}
              max={120}
              value={expectancyYears}
              onChange={handleExpectancy}
              className="mt-2 w-full"
            />
          </label>
          <Input type="number" value={expectancyYears} onChange={handleExpectancy} min={40} max={120} />
          <p className="text-xs text-muted">
            Based on WHO global averages. Adjust for genetics, health, and socio-economic realities.
          </p>
        </section>
        <section className="space-y-4 rounded-2xl border border-slate-700 bg-surface-elevated p-6">
          <h2 className="text-lg font-semibold text-text">Date of birth</h2>
          <Input type="date" value={dob ?? ''} onChange={(event) => setDob(event.target.value)} />
          <p className="text-xs text-muted">Precision chips: Year / Month / Day stored exactly.</p>
        </section>
        <section className="space-y-4 rounded-2xl border border-slate-700 bg-surface-elevated p-6">
          <h2 className="text-lg font-semibold text-text">Appearance</h2>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant={theme === 'light' ? 'primary' : 'secondary'} onClick={() => setTheme('light')}>
              Light
            </Button>
            <Button type="button" variant={theme === 'dark' ? 'primary' : 'secondary'} onClick={() => setTheme('dark')}>
              Dark
            </Button>
            <Button type="button" variant={theme === 'high-contrast' ? 'primary' : 'secondary'} onClick={() => setTheme('high-contrast')}>
              Midnight
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Toggle label="High contrast" pressed={highContrast} onToggle={() => setHighContrast(!highContrast)} />
            <Toggle label="Reduce motion" pressed={reduceMotion} onToggle={() => setReduceMotion(!reduceMotion)} />
          </div>
        </section>
        <section className="space-y-4 rounded-2xl border border-slate-700 bg-surface-elevated p-6">
          <h2 className="text-lg font-semibold text-text">Data</h2>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={exportData}>
              Export JSON
            </Button>
            <Button type="button" variant="secondary" disabled>
              Import (coming soon)
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                localStorage.clear();
                push({ message: 'Local data cleared', tone: 'warning' });
                setOnboardingComplete(false);
              }}
            >
              Delete local data
            </Button>
          </div>
          <p className="text-xs text-muted">All data is stored locally in IndexedDB.</p>
        </section>
        <section className="space-y-4 rounded-2xl border border-slate-700 bg-surface-elevated p-6">
          <h2 className="text-lg font-semibold text-text">Notifications</h2>
          <Toggle
            label={notifications ? 'Weekly reminders on' : 'Weekly reminders off'}
            pressed={notifications}
            onToggle={() => {
              setNotifications(!notifications);
              push({ message: 'Notifications are mocked in this build.', tone: 'info' });
            }}
          />
          <p className="text-xs text-muted">
            Web push will remind you each week: “A small future hinges on a small action. Name one for this week?”
          </p>
        </section>
      </div>
    </div>
  );
}
