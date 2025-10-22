import { ReactNode } from 'react';
import { clsx } from 'clsx';

export type Moment = {
  id: string;
  weekIndex: number;
  title: string;
  body: string;
  tags: string[];
  date: string;
  privacy: 'private' | 'shared';
  media?: string;
};

type MomentCardProps = {
  moment: Moment;
  actions?: ReactNode;
};

export function MomentCard({ moment, actions }: MomentCardProps) {
  return (
    <article
      className="rounded-lg border border-slate-700 bg-surface-elevated p-4 text-sm text-muted transition-all hover:border-accent hover:text-text"
      aria-label={`Moment ${moment.title}`}
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Week {moment.weekIndex + 1}</p>
          <h3 className="text-lg font-semibold text-text">{moment.title}</h3>
          <p className="text-xs text-muted">{moment.privacy === 'private' ? 'Private' : 'Shared'}</p>
        </div>
        {actions}
      </header>
      <p className="mt-3 text-sm leading-relaxed text-muted">{moment.body || 'One sentence can mark a week.'}</p>
      {moment.tags.length ? (
        <ul className="mt-4 flex flex-wrap gap-2 text-xs">
          {moment.tags.map((tag) => (
            <li key={tag} className="rounded-full bg-surface px-3 py-1 text-muted">
              #{tag}
            </li>
          ))}
        </ul>
      ) : null}
      {moment.media ? (
        <figure className="mt-4 overflow-hidden rounded-lg border border-slate-700">
          <img src={moment.media} alt="" className="h-40 w-full object-cover" />
        </figure>
      ) : null}
      <footer className="mt-4 flex items-center justify-between text-xs text-muted">
        <span>{moment.date}</span>
        <span className={clsx('rounded-full px-2 py-1', moment.privacy === 'private' ? 'bg-surface' : 'bg-accent text-surface')}>
          {moment.privacy === 'private' ? 'Private' : 'Shared'}
        </span>
      </footer>
    </article>
  );
}
