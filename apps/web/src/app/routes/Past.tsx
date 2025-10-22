import { useMemo, useState } from 'react';
import { LifeGridCanvas } from '../../components/LifeGrid/LifeGridCanvas';
import { useLifeStore } from '../../store/lifeStore';
import { MomentCard } from '../../components/MomentCard/MomentCard';
import { Button } from '../../components/UI/Button';

export function PastView() {
  const moments = useLifeStore((state) => state.moments);
  const [filter, setFilter] = useState<string | null>(null);

  const tags = useMemo(() => Array.from(new Set(moments.flatMap((moment) => moment.tags))), [moments]);
  const filtered = useMemo(
    () => (filter ? moments.filter((moment) => moment.tags.includes(filter)) : moments),
    [moments, filter]
  );

  return (
    <div className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-text">Past weeks</h1>
          <p className="text-sm text-muted">Hold the weeks you have already lived. Long-press to revisit a moment.</p>
        </header>
        <LifeGridCanvas />
        <div className="flex flex-wrap gap-2">
          <Button variant={filter === null ? 'primary' : 'secondary'} onClick={() => setFilter(null)}>
            All
          </Button>
          {tags.map((tag) => (
            <Button key={tag} variant={filter === tag ? 'primary' : 'secondary'} onClick={() => setFilter(tag)}>
              #{tag}
            </Button>
          ))}
        </div>
        <section className="grid gap-4 md:grid-cols-2">
          {filtered.map((moment) => (
            <MomentCard key={moment.id} moment={moment} />
          ))}
          {filtered.length === 0 ? <p className="text-sm text-muted">No moments recorded for this filter.</p> : null}
        </section>
      </div>
    </div>
  );
}
