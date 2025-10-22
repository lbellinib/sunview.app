import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

type SheetProps = {
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function Sheet({ title, description, open, onClose, children }: SheetProps) {
  useEffect(() => {
    if (open) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
      };
    }
    return undefined;
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-title"
      aria-describedby={description ? 'sheet-description' : undefined}
    >
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-surface-elevated p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="sheet-title" className="text-lg font-semibold text-text">
              {title}
            </h2>
            {description ? (
              <p id="sheet-description" className="text-sm text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <Button variant="ghost" aria-label="Close" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
