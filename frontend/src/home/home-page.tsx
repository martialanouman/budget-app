import { formatAmount, toMoney } from '@budget/domain'
import { type ReactNode, useId } from 'react'
import { Link } from '@tanstack/react-router'
import { useAccountBalances, useAccounts } from '@/accounts/accounts-api.ts'
import { useBudgetSpending, useBudgets } from '@/budgets/budgets-api.ts'
import { ceilingOf, remainingThisMonth } from '@/budgets/month-figures.ts'
import { useCategories } from '@/categories/categories-api.ts'
import { AppShell } from '@/components/app-shell'
import { useDebts, useMonthPayments } from '@/debts/debts-api.ts'
import { dayLabel, monthOf, todayLocally } from '@/lib/dates.ts'
import { useMonthlySummary } from '@/lib/monthly-summary.ts'
import { adviceFor, daysLeftInMonth } from './advice.ts'
import { NotificationCentre } from './notification-centre.tsx'
import { StreakCard } from './streak-card.tsx'
import { runToday, useEntryStreak } from './entry-streak.ts'
import { SpendingBreakdown } from './spending-breakdown.tsx'
import { useDismissNotification, useNotifications } from './dashboard-api.ts'
import { upcomingDues } from './upcoming-dues.ts'

/**
 * A figure that could not be read is missing, not zero. The accounts screen
 * already holds that policy — a stale or invented figure is worse than an
 * admission — and it matters most here, on the numbers a spend is decided on.
 */
const UNKNOWN = '—'

/**
 * Three identical cards asked the reader to decide which figure mattered.
 * `primary` answers that: what is left to live on is the number this screen is
 * opened for, and it should not have to be found among its neighbours.
 *
 * `pending` separates "not read yet" from "could not be read". Both used to
 * show the same dash, so a figure still in flight was indistinguishable from
 * one the server refused.
 */
const Figure = ({
  label,
  value,
  note,
  pending = false,
  primary = false,
  children,
}: {
  label: string
  value: string | undefined
  note?: string | undefined
  pending?: boolean
  primary?: boolean
  children?: ReactNode
}) => {
  const labelId = useId()

  return (
    // Named after its own heading, so each figure is a region a reader can jump
    // to — and so the same amount appearing in two of them stays tellable apart.
    <section
      aria-labelledby={labelId}
      className={
        primary
          ? 'rounded-card border-2 border-accent bg-surface p-4'
          : 'rounded-card border border-line bg-surface p-3'
      }
    >
      <h2 id={labelId} className="text-sm font-medium text-muted">
        {label}
      </h2>
      {pending ? (
        <p className={primary ? 'py-1' : ''}>
          <span className="sr-only">Chargement…</span>
          <span
            aria-hidden="true"
            className={`block animate-pulse rounded bg-surface-2 ${primary ? 'h-9 w-56' : 'h-7 w-40'}`}
          />
        </p>
      ) : (
        <p className={primary ? 'text-3xl font-semibold tabular-nums' : 'text-xl tabular-nums'}>
          {value ?? UNKNOWN}
        </p>
      )}
      {note ? <p className="text-sm text-muted">{note}</p> : null}
      {children}
    </section>
  )
}

export function HomePage() {
  const month = monthOf(todayLocally())

  const accounts = useAccounts()
  const balances = useAccountBalances()
  const summary = useMonthlySummary(month)
  const budgets = useBudgets(month)
  const spending = useBudgetSpending(month)
  const categories = useCategories()
  const debts = useDebts()
  const payments = useMonthPayments(month)
  const streak = useEntryStreak()
  const notifications = useNotifications()
  const dismiss = useDismissNotification()

  /**
   * Only the accounts still in use. An archived one can no longer be spent
   * from nor transferred to, so counting it would announce money the user
   * cannot reach from this screen.
   */
  function totalBalance() {
    if (!accounts.isSuccess || !balances.isSuccess) return undefined

    const open = new Set(accounts.data.filter((account) => !account.archived).map((one) => one.id))
    let total = 0

    for (const row of balances.data) {
      if (!open.has(row.id)) continue
      // A balance the client could not make sense of leaves the total
      // unknown: absorbing it as zero would understate it silently.
      if (row.balance === undefined) return undefined

      total += row.balance
    }

    return formatAmount(toMoney(total))
  }

  const budgeted = toMoney((budgets.data ?? []).reduce((sum, budget) => sum + ceilingOf(budget), 0))

  // The figure alone, with the ceiling underneath. On one line the two amounts
  // wrapped mid-sentence at 24px on a phone, and read as one broken number.
  const monthlySpending = summary.isSuccess ? formatAmount(toMoney(summary.data.spent)) : undefined

  const againstBudget = budgets.isSuccess
    ? budgeted === 0
      ? 'Aucune enveloppe définie pour ce mois'
      : `sur ${formatAmount(budgeted)} d’enveloppes`
    : undefined

  const remainingAmount =
    summary.isSuccess &&
    budgets.isSuccess &&
    spending.isSuccess &&
    debts.isSuccess &&
    payments.isSuccess
      ? remainingThisMonth({
          income: summary.data.income,
          spent: summary.data.spent,
          budgets: budgets.data,
          spending: spending.data,
          debts: debts.data,
          payments: payments.data,
        })
      : undefined

  const remaining = remainingAmount === undefined ? undefined : formatAmount(remainingAmount)
  const advice = adviceFor(remainingAmount, daysLeftInMonth(todayLocally()))

  const dues = upcomingDues(debts.data ?? []).slice(0, 3)

  return (
    <AppShell title="Où j’en suis">
      {/* The one figure a spend is decided against, so it leads. */}
      <Figure
        primary
        label="Reste à vivre"
        value={remaining}
        pending={
          summary.isPending ||
          budgets.isPending ||
          spending.isPending ||
          debts.isPending ||
          payments.isPending
        }
        note="Revenus, moins les dépenses réalisées, les charges fixes et les échéances qui restent à payer."
      >
        {/* RAP-07. It sits inside the figure it is drawn from: a counsel about
            an amount, printed away from that amount, asks the reader to carry
            the number across the screen. */}
        {advice ? (
          <p
            role="note"
            aria-label="Conseil"
            className="mt-3 rounded-field bg-accent-soft px-3 py-2 text-sm text-ink"
          >
            {advice}
          </p>
        ) : null}
      </Figure>

      {/* Smaller than the primary figure but still full width. Two half cards
          were tried and measured: "12 645 000 F CFA" wants 172px and a half
          card at 390px offers 147, so it spilled into its neighbour. The franc
          has no small amounts — a household balance is seven digits as a matter
          of course — and shrinking the type until it fits would leave a figure
          the size of body text. The hierarchy is carried by the primary card's
          border and its 3xl type instead. */}
      <Figure
        label="Solde total"
        value={totalBalance()}
        pending={accounts.isPending || balances.isPending}
      />

      <Figure
        label="Dépenses du mois"
        value={monthlySpending}
        pending={summary.isPending}
        note={againstBudget}
      />

      <StreakCard run={runToday(streak.data, todayLocally())} pending={streak.isPending} />

      <NotificationCentre
        notifications={notifications.data ?? []}
        categories={categories.data}
        ready={notifications.isSuccess}
        onDismiss={(id) => dismiss.mutate(id)}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Prochaines échéances</h2>

        {debts.isSuccess && dues.length === 0 ? <p>Aucune échéance à venir.</p> : null}

        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {dues.map(({ debt, date, inDays }) => (
            <li key={debt.id} className="flex items-center justify-between gap-3 p-3">
              <span>
                <Link
                  to="/debts/$debtId"
                  params={{ debtId: debt.id }}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {debt.creditor}
                </Link>
                <span className="block text-sm text-muted">
                  {/* DET-02: money owed to the user falls due too, and reading
                      it as one more thing to pay is the opposite of the truth. */}
                  {debt.direction === 'je_dois' ? 'À payer' : 'À recevoir'} le {dayLabel(date)} ·{' '}
                  {inDays === 0 ? 'aujourd’hui' : `dans ${inDays} jour${inDays > 1 ? 's' : ''}`}
                </span>
              </span>
              <span className="tabular-nums">{formatAmount(toMoney(debt.monthly_payment))}</span>
            </li>
          ))}
        </ul>
      </section>

      <SpendingBreakdown
        spending={spending.data ?? []}
        categories={categories.data ?? []}
        ready={spending.isSuccess && categories.isSuccess}
      />
    </AppShell>
  )
}
