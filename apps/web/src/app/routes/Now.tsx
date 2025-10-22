import { useState } from 'react';
import { Button } from '../../components/UI/Button';
import { Sheet } from '../../components/UI/Sheet';
import { Input } from '../../components/UI/Input';
import { LifeGridCanvas } from '../../components/LifeGrid/LifeGridCanvas';
import { useLifeStore } from '../../store/lifeStore';
import { MomentCard } from '../../components/MomentCard/MomentCard';
import { useToast } from '../../components/UI/ToastProvider';
import { getCurrentWeek, weekLabel } from '../../lib/lifeMath';

export function NowView() {
  const dob = useLifeStore((state) => state.dob);
  const moments = useLifeStore((state) => state.moments);
  const selectedWeek = useLifeStore((state) => state.selectedWeek);
  const setSelectedWeek = useLifeStore((state) => state.setSelectedWeek);
  const upsertMoment = useLifeStore((state) => state.upsertMoment);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { push } = useToast();

  const currentWeek = getCurrentWeek(dob);
  const weekNumber = selectedWeek ?? currentWeek;

  return (
    <div className="px-4 py-8 sm:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="space-y-2">
          <p className="text-sm text-muted">This is week {weekNumber + 1}. Use this one well.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setSheetOpen(true)}>Add a Moment</Button>
            <Button variant="secondary" onClick={() => setSelectedWeek(weekNumber)}>
              Focus current week
            </Button>
          </div>
        </header>
        <LifeGridCanvas />
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-text">Moments</h2>
          {moments.length === 0 ? (
            <p className="text-sm text-muted">One sentence can mark a week.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {moments.map((moment) => (
                <MomentCard key={moment.id} moment={moment} />
              ))}
            </div>
          )}
        </section>
      </div>
      <Sheet
        title="Add a moment"
        description={dob ? `Anchored to ${weekLabel(dob, weekNumber)}` : undefined}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget as HTMLFormElement);
            const title = String(formData.get('title') ?? 'Untitled moment');
            const body = String(formData.get('body') ?? '');
            const tags = String(formData.get('tags') ?? '')
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean);
            const privacy = (formData.get('privacy') as 'private' | 'shared') ?? 'private';
            const generateId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));
            const moment = {
              id: generateId(),
              weekIndex: weekNumber,
              title,
              body,
              tags,
              date: dob ? weekLabel(dob, weekNumber) : new Date().toISOString(),
              privacy
            };
            upsertMoment(moment);
            push({ message: 'Moment saved', tone: 'success' });
            setSheetOpen(false);
            (event.target as HTMLFormElement).reset();
          }}
        >
          <label className="block text-sm text-muted">
            Title
            <Input name="title" required placeholder="Name the week" />
          </label>
          <label className="block text-sm text-muted">
            Reflection
            <textarea
              name="body"
              rows={4}
              className="mt-1 w-full rounded-md border border-slate-700 bg-surface p-3 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              placeholder="One sentence can mark a week."
            />
          </label>
          <label className="block text-sm text-muted">
            Tags (comma separated)
            <Input name="tags" placeholder="care, work, wonder" />
          </label>
          <fieldset className="space-y-2 text-sm text-muted">
            <legend className="font-medium text-text">Privacy</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="privacy" value="private" defaultChecked />
              Private
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="privacy" value="shared" />
              Shared
            </label>
          </fieldset>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save moment</Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
