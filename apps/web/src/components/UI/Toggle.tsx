import { ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

type ToggleProps = {
  pressed: boolean;
  label: string;
  onToggle: () => void;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>;

export function Toggle({ pressed, label, onToggle, className, ...props }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      onClick={onToggle}
      className={clsx(
        'inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        pressed ? 'bg-accent text-surface' : 'bg-surface-elevated text-muted',
        className
      )}
      {...props}
    >
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-500 bg-surface">
        <span className={clsx('h-2 w-2 rounded-full', pressed ? 'bg-surface' : 'bg-muted')} />
      </span>
      {label}
    </button>
  );
}
