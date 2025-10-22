import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => ({
    clearRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    closePath: () => {},
    canvas: document.createElement('canvas')
  }) as unknown as CanvasRenderingContext2D
});

afterEach(() => {
  cleanup();
});
