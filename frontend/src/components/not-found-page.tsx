import { Link } from '@tanstack/react-router'

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Page introuvable</h1>
        <p className="text-slate-700">Cette adresse ne correspond à aucune page.</p>
        <Link to="/" className="inline-block underline">
          Revenir à l'accueil
        </Link>
      </div>
    </main>
  )
}
