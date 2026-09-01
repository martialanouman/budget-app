import { Link } from '@tanstack/react-router'

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm space-y-4 rounded-card border border-line bg-surface p-6 text-center shadow-card">
        <h1 className="text-xl font-semibold text-ink">Page introuvable</h1>
        <p className="text-muted">Cette adresse ne correspond à aucune page.</p>
        <Link to="/" className="inline-block text-accent underline">
          Revenir à l'accueil
        </Link>
      </div>
    </main>
  )
}
