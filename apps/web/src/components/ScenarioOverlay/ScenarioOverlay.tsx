import { Toggle } from '../UI/Toggle';

const scenarios = [
  {
    id: 'travel',
    title: 'Travel Sabbatical',
    description: 'Assume one year of sabbatical beginning next spring.',
    delta: '+52 weeks'
  },
  {
    id: 'care',
    title: 'Care Focus',
    description: 'Shift to 50% caregiving load starting Week 1400.',
    delta: '-312 weeks'
  }
];

export function ScenarioOverlay({ active, onChange }: { active: Record<string, boolean>; onChange: (id: string) => void }) {
  return (
    <section aria-label="Scenario overlays" className="rounded-lg border border-slate-700 bg-surface-elevated p-4">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-text">Futures overlays</h3>
          <p className="text-sm text-muted">Select possible futures to blend into your grid.</p>
        </div>
        <span className="text-xs text-muted">Mocked deltas</span>
      </header>
      <ul className="mt-4 space-y-3">
        {scenarios.map((scenario) => (
          <li key={scenario.id} className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-text">{scenario.title}</p>
              <p className="text-xs text-muted">{scenario.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-surface px-2 py-1 text-xs text-muted">{scenario.delta}</span>
              <Toggle
                pressed={Boolean(active[scenario.id])}
                onToggle={() => onChange(scenario.id)}
                label={active[scenario.id] ? 'On' : 'Off'}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
