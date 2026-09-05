import { type ReactNode, useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeftRight,
  ChartNoAxesColumn,
  HandCoins,
  House,
  Landmark,
  Menu as MenuIcon,
  PiggyBank,
  Tags,
  UserRound,
  Wallet,
} from 'lucide-react'
import { signOut, useAuth } from '@/auth/auth.ts'
import { Sheet } from '@/components/sheet'
import { WIDE_SCREEN, useMediaQuery } from '@/lib/media-query.ts'
import { EntrySheet } from '@/transactions/entry-sheet.tsx'
import { SECONDARY_BUTTON_CLASS } from '@/components/secondary-button.ts'

/**
 * The five destinations someone opens the app for. A tab bar that holds
 * everything holds nothing, and five is where a thumb stops distinguishing.
 *
 * The icons are decoration, hidden from assistive technology: each destination
 * keeps its word, because an icon alone is a guess for the reader.
 */
const TABS = [
  { to: '/', label: 'Accueil', Icon: House },
  { to: '/transactions', label: 'Transactions', Icon: ArrowLeftRight },
  { to: '/budgets', label: 'Budgets', Icon: Wallet },
  { to: '/debts', label: 'Dettes', Icon: HandCoins },
  { to: '/accounts', label: 'Comptes', Icon: Landmark },
] as const

/**
 * The other four. Two are configuration and two are deferred to v1.1 (§8), and
 * what they share is that nobody opens the application to reach them — which is
 * what puts them one tap away rather than in the bar.
 */
const ELSEWHERE = [
  { to: '/categories', label: 'Catégories', Icon: Tags },
  { to: '/savings', label: 'Épargne', Icon: PiggyBank },
  { to: '/reports', label: 'Rapports', Icon: ChartNoAxesColumn },
  { to: '/profile', label: 'Mon compte', Icon: UserRound },
] as const

/**
 * Which account is signed in. It sits wherever the sign-out button sits, and
 * that is the whole reason it exists: pressing that button should never be a
 * guess about whose data is about to disappear — on a shared phone, or between
 * two people who go by the same first name.
 *
 * The address stands in as the greeting until a name is given. Nobody has one
 * before they write it, and "Bon retour," followed by nothing greets no one.
 *
 * It wraps rather than truncates, which is the whole reason it left the header:
 * an address cut to "capture17883…" identifies nobody, and both places it now
 * sits — a sheet and the foot of a rail — have vertical room to spare. Measured
 * at 390px, where the menu was still showing an ellipsis.
 */
function AccountIdentity() {
  const { email, name } = useAuth()

  return (
    <div className="min-w-0">
      <p className="text-sm font-medium break-words text-ink">Bon retour, {name || email}</p>
      {name ? <p className="text-xs break-words text-muted">{email}</p> : null}
    </div>
  )
}

function SignOutButton({ className }: { className: string }) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => {
        signOut()
        void navigate({ to: '/sign-in' })
      }}
      className={className}
    >
      Se déconnecter
    </button>
  )
}

/**
 * The four destinations the tab bar does not carry, behind one button.
 *
 * It closes on the click, and that is the whole mechanism. A `<dialog>` holds
 * the focus trap and the inert background, so a menu left open over the screen
 * it was asked to reveal locks the keyboard out of it — including when the link
 * leads where we already are, which is the case a first version got wrong.
 *
 * Navigating away needs no help: every screen renders its own `AppShell`, so a
 * route change unmounts this component and `open` is born false again. An
 * earlier version watched `useLocation` for that, which could never fire — the
 * state it guarded had already gone with the unmount. Should the shell ever be
 * lifted into a layout route, that stops being true; the back-button journey is
 * what would say so.
 */
function ShellMenu() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${SECONDARY_BUTTON_CLASS} flex items-center gap-2`}
      >
        <MenuIcon aria-hidden="true" size={18} strokeWidth={1.75} />
        Menu
      </button>
      <Sheet open={open} title="Menu" onClose={() => setOpen(false)}>
        <AccountIdentity />
        <nav aria-label="Autres destinations">
          <ul className="divide-y divide-line border-y border-line">
            {ELSEWHERE.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="flex min-h-14 items-center gap-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent/40 aria-[current=page]:font-semibold"
                >
                  <item.Icon aria-hidden="true" size={20} strokeWidth={1.75} />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <SignOutButton className={`${SECONDARY_BUTTON_CLASS} w-full`} />
      </Sheet>
    </>
  )
}

/**
 * Typed from the two lists rather than restating their shape. `to: string`
 * compiles and quietly switches off the router's check that the path leads
 * somewhere — measured: with it, a bad path in ELSEWHERE was reported only at
 * the menu's own map, and not here at all. Nothing had slipped through, because
 * both lists are still rendered by a direct map elsewhere; but the menu's markup
 * is the third near-copy of this list and the obvious next thing to extract,
 * which would have left no validating site at all.
 */
type Destination = (typeof TABS)[number] | (typeof ELSEWHERE)[number]

const railLink =
  'flex min-h-11 items-center gap-3 rounded-full px-3 text-sm text-muted outline-none focus-visible:ring-2 focus-visible:ring-accent/40 aria-[current=page]:bg-surface-2 aria-[current=page]:font-semibold aria-[current=page]:text-ink'

/**
 * One group of rail links. Named, because the border between the two groups is
 * the only thing that separates them and a border says nothing out loud: a
 * screen reader would otherwise meet nine links in a row with no hint that the
 * last four are of a different kind.
 */
function RailGroup({
  items,
  label,
  className,
}: {
  items: readonly Destination[]
  label: string
  className?: string
}) {
  return (
    <ul aria-label={label} className={className ? `space-y-1 ${className}` : 'space-y-1'}>
      {items.map((item) => (
        <li key={item.to}>
          {/* Without the exact match, "/" prefix-matches every route and the
              home entry reads as the current page from anywhere in the app. The
              others want the prefix: /debts/$debtId keeps Dettes lit. */}
          <Link to={item.to} activeOptions={{ exact: item.to === '/' }} className={railLink}>
            <item.Icon aria-hidden="true" size={20} strokeWidth={1.75} />
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  )
}

/**
 * All nine destinations at once, from 768px up. Below it the bar and the menu
 * split them; above it there is room for the lot, so the menu earns nothing and
 * a bar fixed to the bottom of a desktop window is a phone stretched wide.
 */
function Rail() {
  return (
    <div className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col gap-4 overflow-y-auto border-r border-line bg-surface p-3">
      <p className="px-3 text-lg font-semibold text-ink">Kalpe</p>
      <nav aria-label="Navigation principale" className="flex-1">
        <RailGroup items={TABS} label="Au quotidien" />
        <RailGroup
          items={ELSEWHERE}
          label="Réglages et à venir"
          className="mt-4 border-t border-line pt-4"
        />
      </nav>
      <div className="space-y-2 border-t border-line px-3 pt-3">
        <AccountIdentity />
        <SignOutButton className={`${SECONDARY_BUTTON_CLASS} w-full`} />
      </div>
    </div>
  )
}

/** The tab bar, and the menu button that holds what it cannot. */
function TabBar() {
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-3xl">
        {TABS.map((item) => (
          <li key={item.to} className="flex-1">
            <Link
              to={item.to}
              // Without the exact match, "/" prefix-matches every route and the
              // home tab reads as the current page from anywhere in the app.
              // The others want the prefix: /debts/$debtId keeps Dettes lit.
              activeOptions={{ exact: item.to === '/' }}
              className="flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-center text-xs text-muted aria-[current=page]:font-semibold aria-[current=page]:text-ink"
            >
              <item.Icon aria-hidden="true" size={20} strokeWidth={1.75} />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const wide = useMediaQuery(WIDE_SCREEN)

  // Twelve screens shared one tab title, so a pinned tab and a history entry
  // said "Budget" and nothing more.
  useEffect(() => {
    document.title = `${title} · Kalpe`
  }, [title])

  return (
    <div className="flex min-h-dvh bg-bg">
      {wide ? <Rail /> : null}

      <div className="min-w-0 flex-1">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <h1 className="min-w-0 truncate text-xl font-semibold text-ink">{title}</h1>
            {wide ? null : <ShellMenu />}
          </div>
        </header>

        {/* Cleared of the tab bar, which is fixed and would otherwise sit on top
            of the last rows of every list. The rail is not fixed over anything,
            so the room is only owed on a phone. */}
        <main className={`mx-auto max-w-3xl space-y-6 p-4 ${wide ? '' : 'pb-28'}`}>{children}</main>

        <EntrySheet />

        {wide ? null : <TabBar />}
      </div>
    </div>
  )
}
