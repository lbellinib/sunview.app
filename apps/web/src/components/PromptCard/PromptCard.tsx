import { Button } from '../UI/Button';

const prompts = [
  'Name a kindness you can extend this week.',
  'What would honor your future self in one hour?',
  'Which relationship needs a week of light?'
];

export function PromptCard({ onDismiss }: { onDismiss: () => void }) {
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  return (
    <section className="rounded-lg border border-slate-700 bg-surface-elevated p-4">
      <p className="text-sm text-muted">{prompt}</p>
      <div className="mt-4 flex gap-2">
        <Button variant="primary">Do it</Button>
        <Button variant="secondary" onClick={onDismiss}>
          Later
        </Button>
        <Button variant="ghost" onClick={onDismiss}>
          Don’t show similar
        </Button>
      </div>
    </section>
  );
}
