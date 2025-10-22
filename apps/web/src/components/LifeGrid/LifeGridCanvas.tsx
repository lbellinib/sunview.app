import { useEffect, useMemo, useRef, useState } from 'react';
import { useLifeStore, totalWeeks } from '../../store/lifeStore';
import { getCurrentWeek } from '../../lib/lifeMath';
import { useInterfaceStore } from '../../store/interfaceStore';
import { useMomentsSync } from '../../hooks/useMoments';
import { useToast } from '../UI/ToastProvider';

const WEEKS_PER_ROW = 52;
const BASE_CELL = 10;

type WeekState = 'past' | 'now' | 'future' | 'moment';

type LifeGridCanvasProps = {
  mode?: 'preview' | 'full';
  height?: number;
};

export function LifeGridCanvas({ mode = 'full', height }: LifeGridCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const announceRef = useRef<HTMLDivElement | null>(null);
  const dob = useLifeStore((state) => state.dob);
  const expectancyYears = useLifeStore((state) => state.expectancyYears);
  const moments = useLifeStore((state) => state.moments);
  const selectedWeek = useLifeStore((state) => state.selectedWeek);
  const setSelectedWeek = useLifeStore((state) => state.setSelectedWeek);
  const { removeAndPersist } = useMomentsSync();
  const { push } = useToast();
  const [scale, setScale] = useState(mode === 'preview' ? 0.6 : 1);
  const [offsetY, setOffsetY] = useState(0);
  const reducedMotion = useInterfaceStore((state) => state.reducedMotion);

  const total = totalWeeks(expectancyYears);
  const totalRows = Math.ceil(total / WEEKS_PER_ROW);
  const currentWeek = getCurrentWeek(dob);

  const data = useMemo<WeekState[]>(() => {
    const grid: WeekState[] = Array.from({ length: total }, (_, index) => {
      if (index < currentWeek) return 'past';
      if (index === currentWeek) return 'now';
      return 'future';
    });
    moments.forEach((moment) => {
      if (moment.weekIndex < grid.length) {
        grid[moment.weekIndex] = 'moment';
      }
    });
    return grid;
  }, [total, currentWeek, moments]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const devicePixelRatio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth * devicePixelRatio;
    const rowHeight = BASE_CELL * scale * devicePixelRatio;
    const cellSize = rowHeight - 2 * devicePixelRatio;
    const visibleRows = Math.floor((canvas.clientHeight * devicePixelRatio) / rowHeight) + 2;
    const startRow = Math.max(0, Math.floor(offsetY / rowHeight));
    const startWeek = startRow * WEEKS_PER_ROW;
    const endWeek = Math.min(total, startWeek + visibleRows * WEEKS_PER_ROW);

    canvas.width = width;
    canvas.height = canvas.clientHeight * devicePixelRatio;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = 1 * devicePixelRatio;

    for (let index = startWeek; index < endWeek; index += 1) {
      const row = Math.floor(index / WEEKS_PER_ROW);
      const col = index % WEEKS_PER_ROW;
      const x = col * cellSize + 4 * devicePixelRatio;
      const y = row * rowHeight - offsetY + 4 * devicePixelRatio;

      const status = data[index];
      switch (status) {
        case 'past':
          context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-grid-past');
          context.globalAlpha = 0.75;
          context.fillRect(x, y, cellSize, cellSize);
          break;
        case 'now':
          context.globalAlpha = 1;
          context.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-grid-now');
          context.lineWidth = 2 * devicePixelRatio;
          context.strokeRect(x, y, cellSize, cellSize);
          if (!reducedMotion) {
            const time = Date.now() / 1000;
            const pulse = (Math.sin(time) + 1) / 2;
            context.globalAlpha = 0.2 + pulse * 0.4;
            context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-grid-now');
            context.fillRect(x, y, cellSize, cellSize);
          }
          break;
        case 'moment':
          context.globalAlpha = 1;
          context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-grid-past');
          context.fillRect(x, y, cellSize, cellSize);
          context.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-accent');
          context.strokeRect(x, y, cellSize, cellSize);
          break;
        default:
          context.globalAlpha = 1;
          context.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-grid-outline');
          context.strokeRect(x, y, cellSize, cellSize);
      }

      if (selectedWeek === index) {
        context.globalAlpha = 1;
        context.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-accent');
        context.lineWidth = 3 * devicePixelRatio;
        context.strokeRect(x - devicePixelRatio, y - devicePixelRatio, cellSize + devicePixelRatio * 2, cellSize + devicePixelRatio * 2);
      }
    }
  }, [data, offsetY, scale, reducedMotion, selectedWeek, total]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrame: number;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey) {
        setScale((previous) => Math.min(2, Math.max(0.4, previous - event.deltaY * 0.001)));
      } else {
        setOffsetY((previous) => Math.min((totalRows - 1) * BASE_CELL * scale, Math.max(0, previous + event.deltaY)));
      }
    };

    const onKey = (event: KeyboardEvent) => {
      if (document.activeElement !== canvas) return;
      const baseWeek = selectedWeek ?? currentWeek;
      if (event.key === '+' || event.key === '=') {
        setScale((previous) => Math.min(2, previous + 0.1));
      }
      if (event.key === '-' || event.key === '_') {
        setScale((previous) => Math.max(0.4, previous - 0.1));
      }
      if (event.key === 'ArrowDown') {
        const next = Math.min(total - 1, baseWeek + WEEKS_PER_ROW);
        setSelectedWeek(next);
        event.preventDefault();
      }
      if (event.key === 'ArrowUp') {
        const next = Math.max(0, baseWeek - WEEKS_PER_ROW);
        setSelectedWeek(next);
        event.preventDefault();
      }
      if (event.key === 'ArrowRight') {
        const next = Math.min(total - 1, baseWeek + 1);
        setSelectedWeek(next);
        event.preventDefault();
      }
      if (event.key === 'ArrowLeft') {
        const next = Math.max(0, baseWeek - 1);
        setSelectedWeek(next);
        event.preventDefault();
      }
      if (event.key === 'Home') {
        setSelectedWeek(0);
      }
      if (event.key === 'End') {
        setSelectedWeek(total - 1);
      }
      if (event.key === 'Enter') {
        announce(`Week ${selectedWeek ?? currentWeek}`);
      }
    };

    const announce = (message: string) => {
      if (announceRef.current) {
        announceRef.current.textContent = message;
        cancelAnimationFrame(animationFrame);
        animationFrame = requestAnimationFrame(() => {
          if (announceRef.current) announceRef.current.textContent = '';
        });
      }
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('keydown', onKey);

    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('keydown', onKey);
    };
  }, [currentWeek, total, totalRows, scale, setSelectedWeek, selectedWeek]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top + offsetY;
    const row = Math.floor(y / (BASE_CELL * scale));
    const col = Math.floor(x / (BASE_CELL * scale));
    const index = row * WEEKS_PER_ROW + col;
    if (index >= 0 && index < total) {
      setSelectedWeek(index);
      if (announceRef.current) {
        announceRef.current.textContent = `Week ${index + 1}`;
        window.setTimeout(() => {
          if (announceRef.current) {
            announceRef.current.textContent = '';
          }
        }, 1500);
      }
    }
  };

  const currentMoments = selectedWeek != null ? moments.filter((moment) => moment.weekIndex === selectedWeek) : [];

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>{totalRows} rows · {total} weeks</span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-700 px-3 py-1"
            onClick={() => setScale((prev) => Math.min(2, prev + 0.1))}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-700 px-3 py-1"
            onClick={() => setScale((prev) => Math.max(0.4, prev - 0.1))}
            aria-label="Zoom out"
          >
            −
          </button>
        </div>
      </div>
      <div className="relative rounded-xl border border-slate-700 bg-surface" role="group" aria-label="Life grid canvas">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          className="w-full rounded-xl outline-none"
          style={{ height: height ?? 420 }}
          onClick={handleCanvasClick}
        />
        <div ref={announceRef} className="sr-only" aria-live="polite" />
      </div>
      {mode === 'full' && selectedWeek != null ? (
        <section className="rounded-lg border border-slate-700 bg-surface-elevated p-4 text-sm text-muted">
          <header className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-text">Week {selectedWeek + 1}</h3>
            {currentMoments.length ? (
              <button
                type="button"
                className="rounded-md border border-danger px-3 py-1 text-danger"
                onClick={() => {
                  currentMoments.forEach((moment) => {
                    void removeAndPersist(moment.id);
                  });
                  push({ message: 'Moments cleared', tone: 'warning' });
                }}
              >
                Clear moments
              </button>
            ) : null}
          </header>
          <p className="mt-2 text-xs text-muted">Use keyboard arrows to navigate. Enter announces the selected week.</p>
        </section>
      ) : null}
    </div>
  );
}
