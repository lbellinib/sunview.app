import 'jest-axe/extend-expect';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { BrowserRouter } from 'react-router-dom';
import App from '../app/App';
import { ToastProvider } from '../components/UI/ToastProvider';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {}
  })
});

describe('App accessibility', () => {
  it('has no critical accessibility issues on home', async () => {
    const { container } = render(
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    );
    expect(await axe(container)).toHaveNoViolations();
    expect(screen.getByText(/Life Clock setup/i)).toBeInTheDocument();
  });
});
