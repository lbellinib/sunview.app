import { ReactNode, useState } from 'react';

interface TooltipProps {
  label: string;
  children: (props: { onFocus: () => void; onBlur: () => void; onMouseEnter: () => void; onMouseLeave: () => void; id: string }) => ReactNode;
}

export function Tooltip({ label, children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = `tooltip-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <span className="relative inline-flex">
      {children({
        onFocus: () => setOpen(true),
        onBlur: () => setOpen(false),
        onMouseEnter: () => setOpen(true),
        onMouseLeave: () => setOpen(false),
        id
      })}
      {open ? (
        <span
          role="tooltip"
          id={id}
          className="absolute left-1/2 top-full mt-2 -translate-x-1/2 rounded-md bg-surface-elevated px-3 py-1 text-xs text-muted shadow-lg"
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}
