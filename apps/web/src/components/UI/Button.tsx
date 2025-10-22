import { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-accent text-surface hover:bg-accent-muted',
        variant === 'secondary' && 'bg-surface-elevated text-text hover:text-accent',
        variant === 'ghost' && 'bg-transparent text-muted hover:text-text',
        className
      )}
      {...props}
    />
  );
});
