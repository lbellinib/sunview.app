import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useInterfaceStore } from '../../store/interfaceStore';
import { Button } from '../../components/UI/Button';

const navItems = [
  { to: '/past', label: 'Past' },
  { to: '/', label: 'Now' },
  { to: '/futures', label: 'Futures' },
  { to: '/settings', label: 'Settings' }
];

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const onboardingComplete = useInterfaceStore((state) => state.onboardingComplete);

  useEffect(() => {
    if (!onboardingComplete && !location.pathname.startsWith('/onboarding')) {
      navigate('/onboarding', { replace: true });
    }
  }, [onboardingComplete, location.pathname, navigate]);

  return (
    <div className="min-h-screen bg-surface text-text flex flex-col md:flex-row">
      <nav className="md:w-56 border-b md:border-b-0 md:border-r border-slate-700">
        <div className="md:sticky top-0 flex md:flex-col justify-between md:justify-start gap-4 md:gap-6 p-4 md:p-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Life Clock</p>
            <p className="text-lg font-semibold">Quiet urgency</p>
          </div>
          <div className="flex md:flex-col gap-2 md:gap-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex-1 md:flex-none rounded-md px-4 py-3 text-center text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface transition-colors ${
                    isActive ? 'bg-accent text-surface' : 'bg-surface-elevated text-muted hover:text-text'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
          <Button
            variant="ghost"
            className="hidden md:inline-flex text-xs text-muted"
            onClick={() => navigate('/onboarding')}
          >
            Revisit onboarding
          </Button>
        </div>
        <div className="fixed bottom-0 inset-x-0 md:hidden bg-surface-elevated border-t border-slate-700 p-2 flex justify-around">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex-1 text-center text-sm font-medium rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isActive ? 'text-accent' : 'text-muted'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <Outlet />
      </main>
    </div>
  );
}
