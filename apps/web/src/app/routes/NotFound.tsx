import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center text-muted">
      <h1 className="text-3xl font-semibold text-text">Page not found</h1>
      <p className="text-sm">The week you are looking for doesn’t exist yet.</p>
      <Link to="/" className="text-accent underline">
        Return to now
      </Link>
    </div>
  );
}
