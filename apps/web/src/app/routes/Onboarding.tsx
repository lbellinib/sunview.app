import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Toggle } from '../../components/UI/Toggle';
import { LifeGridCanvas } from '../../components/LifeGrid/LifeGridCanvas';
import { useLifeStore } from '../../store/lifeStore';
import { useInterfaceStore } from '../../store/interfaceStore';
import { getCurrentWeek, weekLabel } from '../../lib/lifeMath';

const steps = ['Basics', 'Preferences', 'Preview', 'Privacy'];

export function OnboardingFlow() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
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

  const week = getCurrentWeek(dob);

  const nextStep = () => setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  const prevStep = () => setStepIndex((prev) => Math.max(prev - 1, 0));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setOnboardingComplete(true);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-surface text-text">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Onboarding</p>
            <h1 className="text-2xl font-semibold text-text">Life Clock setup</h1>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setOnboardingComplete(true);
              navigate('/');
            }}
          >
            Skip
          </Button>
        </header>
        <ol className="flex items-center gap-2 text-xs text-muted">
          {steps.map((step, index) => (
            <li
              key={step}
              className={`flex-1 rounded-full border border-slate-700 px-3 py-2 text-center ${
                index === stepIndex ? 'bg-accent text-surface' : 'bg-surface-elevated'
              }`}
            >
              {step}
            </li>
          ))}
        </ol>
        <form className="flex-1 rounded-2xl border border-slate-700 bg-surface-elevated p-6" onSubmit={handleSubmit}>
          {stepIndex === 0 ? (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-text">Your life details</h2>
              <label className="block text-sm text-muted">
                Date of birth
                <Input
                  required
                  aria-describedby="dob-help"
                  type="date"
                  value={dob ? dob : ''}
                  onChange={(event) => setDob(event.target.value)}
                />
                <span id="dob-help" className="mt-1 block text-xs text-muted">
                  Precision matters; adjust if needed later.
                </span>
              </label>
              <label className="block text-sm text-muted">
                Life expectancy (years)
                <Input
                  required
                  type="number"
                  min={30}
                  max={120}
                  value={expectancyYears}
                  onChange={(event) => setExpectancy(Number(event.target.value))}
                />
              </label>
            </section>
          ) : null}
          {stepIndex === 1 ? (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-text">Tone & perception</h2>
              <div className="flex flex-wrap gap-4">
                <Toggle label="Quiet urgency" pressed onToggle={() => {}} aria-pressed="true" aria-disabled="true" />
                <Toggle
                  label="High contrast"
                  pressed={highContrast}
                  onToggle={() => setHighContrast(!highContrast)}
                />
                <Toggle label="Reduce motion" pressed={reduceMotion} onToggle={() => setReduceMotion(!reduceMotion)} />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant={theme === 'light' ? 'primary' : 'secondary'} onClick={() => setTheme('light')}>
                  Light
                </Button>
                <Button type="button" variant={theme === 'dark' ? 'primary' : 'secondary'} onClick={() => setTheme('dark')}>
                  Dark
                </Button>
                <Button
                  type="button"
                  variant={theme === 'high-contrast' ? 'primary' : 'secondary'}
                  onClick={() => setTheme('high-contrast')}
                >
                  Midnight
                </Button>
              </div>
            </section>
          ) : null}
          {stepIndex === 2 ? (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-text">Preview</h2>
              <p className="text-sm text-muted">This is week {week + 1}. Use this one well.</p>
              <div className="rounded-xl border border-slate-700 bg-surface p-4">
                <LifeGridCanvas mode="preview" height={220} />
              </div>
              <p className="text-xs text-muted">Week anchors: {weekLabel(dob, week)}</p>
            </section>
          ) : null}
          {stepIndex === 3 ? (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-text">Privacy</h2>
              <p className="text-sm text-muted">
                Life Clock is local-first. Nothing leaves your device unless you export it. Analytics are off by default.
              </p>
              <p className="text-sm text-muted">You can revisit onboarding anytime from Settings.</p>
              <label className="inline-flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" required />
                I understand and consent to local storage of my data.
              </label>
            </section>
          ) : null}
          <footer className="mt-8 flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={prevStep} disabled={stepIndex === 0}>
              Back
            </Button>
            {stepIndex < steps.length - 1 ? (
              <Button type="button" onClick={nextStep}>
                Next
              </Button>
            ) : (
              <Button type="submit">Finish</Button>
            )}
          </footer>
        </form>
      </div>
    </div>
  );
}
