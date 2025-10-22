import { createContext, ReactNode, useContext, useState } from 'react';
import { clsx } from 'clsx';

type Toast = { id: number; message: string; tone?: 'info' | 'success' | 'warning' | 'danger' };

type ToastContextValue = {
  push: (toast: Omit<Toast, 'id'>) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('Toast context not available');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = ({ message, tone = 'info' }: Omit<Toast, 'id'>) => {
    setToasts((current) => [...current, { id: Date.now(), message, tone }]);
    setTimeout(() => {
      setToasts((current) => current.slice(1));
    }, 4000);
  };

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-16 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:bottom-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={clsx(
              'pointer-events-auto w-full max-w-sm rounded-lg border border-slate-700 bg-surface-elevated px-4 py-3 text-sm shadow-xl',
              toast.tone === 'success' && 'border-emerald-400 text-emerald-200',
              toast.tone === 'warning' && 'border-amber-400 text-amber-200',
              toast.tone === 'danger' && 'border-danger text-danger'
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
