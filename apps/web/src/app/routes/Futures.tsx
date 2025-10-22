import { useState } from 'react';
import { LifeGridCanvas } from '../../components/LifeGrid/LifeGridCanvas';
import { ScenarioOverlay } from '../../components/ScenarioOverlay/ScenarioOverlay';
import { PromptCard } from '../../components/PromptCard/PromptCard';

export function FuturesView() {
  const [active, setActive] = useState<Record<string, boolean>>({});
  return (
    <div className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-text">Possible futures</h1>
          <p className="text-sm text-muted">Simulate scenarios and notice how your weeks shift.</p>
        </header>
        <LifeGridCanvas />
        <ScenarioOverlay active={active} onChange={(id) => setActive((prev) => ({ ...prev, [id]: !prev[id] }))} />
        <PromptCard onDismiss={() => setActive({})} />
      </div>
    </div>
  );
}
