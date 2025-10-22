import { forwardRef, InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={clsx(
        'w-full rounded-md border border-slate-700 bg-surface-elevated px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        className
      )}
      {...props}
    />
  );
});
