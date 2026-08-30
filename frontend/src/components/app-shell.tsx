import { type ReactNode, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeftRight, HandCoins, House, Landmark, Wallet } from 'lucide-react'
import { signOut, useAuth } from '@/auth/auth.ts'
import { EntrySheet } from '@/transactions/entry-sheet.tsx'

/**
 * The five destinations someone opens the app for. Categories and the account
 * itself are configuration, reached from the header — a tab bar that holds
 * everything holds nothing, and five is where a thumb stops distinguishing.
 *
 * The icons are decoration, hidden from assistive technology: each tab keeps
 * its word, because an icon alone is a guess for the reader.
 */
const TABS = [
  { to: '/', label: 'Accueil', Icon: House },
  { to: '/transactions', label: 'Transactions', Icon: ArrowLeftRight },
  { to: '/budgets', label: 'Budgets', Icon: Wallet },
  { to: '/debts', label: 'Dettes', Icon: HandCoins },
  { to: '/accounts', label: 'Comptes', Icon: Landmark },
] as const

const SETTINGS = [
  { to: '/categories', label: 'Catégories' },
  { to: '/profile', label: 'Mon compte' },
] as const

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate()
  const { email } = useAuth()

  // Twelve screens shared one tab title, so a pinned tab and a history entry
  // said "Budget" and nothing more.
  useEffect(() => {
    document.title = `${title} · Budget`
  }, [title])

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pt-2">
          {/* Which account this is, on every screen rather than on one: the
              sign-out button sits beside it, and pressing it should never be
              a guess about whose data is about to disappear. */}
          <span className="min-w-0 truncate text-xs text-slate-600">
            Connecté en tant que {email}
          </span>
          <button
            type="button"
            onClick={() => {
              signOut()
              void navigate({ to: '/sign-in' })
            }}
            className="shrink-0 text-xs underline-offset-4 hover:underline"
          >
            Se déconnecter
          </button>
        </div>
        <div className="mx-auto flex max-w-3xl items-baseline justify-between gap-4 px-4 pt-1 pb-3">
          <h1 className="min-w-0 truncate text-xl font-semibold text-slate-900">{title}</h1>
          <nav aria-label="Réglages" className="flex shrink-0 gap-4">
            {SETTINGS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-sm underline-offset-4 hover:underline aria-[current=page]:font-semibold aria-[current=page]:underline"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Cleared of the tab bar, which is fixed and would otherwise sit on top
          of the last rows of every list. */}
      <main className="mx-auto max-w-3xl space-y-6 p-4 pb-28">{children}</main>

      <EntrySheet />

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto flex max-w-3xl">
          {TABS.map((item) => (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                // Without the exact match, "/" prefix-matches every route and
                // the home tab reads as the current page from anywhere in the
                // app. The others want the prefix: /debts/$debtId keeps Dettes
                // lit.
                activeOptions={{ exact: item.to === '/' }}
                className="flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-center text-xs text-slate-600 aria-[current=page]:font-semibold aria-[current=page]:text-slate-900"
              >
                <item.Icon aria-hidden="true" size={20} strokeWidth={1.75} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
