import { type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { signOut, useAuth } from '@/auth/auth.ts'
import { useNavigate } from '@tanstack/react-router'

const NAV = [
  { to: '/', label: 'Accueil' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/budgets', label: 'Budgets' },
  { to: '/debts', label: 'Dettes' },
  { to: '/accounts', label: 'Comptes' },
  { to: '/categories', label: 'Catégories' },
  { to: '/profile', label: 'Mon compte' },
] as const

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate()
  const { email } = useAuth()

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <nav
          aria-label="Navigation principale"
          className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 p-4"
        >
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm underline-offset-4 hover:underline aria-[current=page]:font-semibold aria-[current=page]:underline"
            >
              {item.label}
            </Link>
          ))}
          {/* Which account this is, on every screen rather than on one: the
              sign-out button sits beside it, and pressing it should never be
              a guess about whose data is about to disappear. */}
          <span className="ml-auto text-sm text-slate-600">Connecté en tant que {email}</span>
          <button
            type="button"
            onClick={() => {
              signOut()
              void navigate({ to: '/sign-in' })
            }}
            className="text-sm underline-offset-4 hover:underline"
          >
            Se déconnecter
          </button>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 p-4">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {children}
      </main>
    </div>
  )
}
