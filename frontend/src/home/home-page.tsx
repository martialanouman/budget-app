import { formatAmount, toMoney } from '@budget/domain'
import { useId } from 'react'
import { Link } from '@tanstack/react-router'
import { useAccountBalances, useAccounts } from '@/accounts/accounts-api.ts'
import { useBudgetSpending, useBudgets } from '@/budgets/budgets-api.ts'
import { ceilingOf, remainingThisMonth } from '@/budgets/month-figures.ts'
import { useCategories } from '@/categories/categories-api.ts'
import { AppShell } from '@/components/app-shell'
import { useDebts, useMonthPayments } from '@/debts/debts-api.ts'
import { dayLabel, monthOf, todayLocally } from '@/lib/dates.ts'
import { useMonthlySummary } from '@/lib/monthly-summary.ts'
import { NotificationCentre } from './notification-centre.tsx'
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
}: {
  label: string
  value: string | undefined
  note?: string | undefined
  pending?: boolean
  primary?: boolean
}) => {
  const labelId = useId()

  return (
    // Named after its own heading, so each figure is a region a reader can jump
    // to — and so the same amount appearing in two of them stays tellable apart.
    <section
      aria-labelledby={labelId}
      className={
        primary
          ? 'rounded-lg border-2 border-slate-900 bg-white p-4'
          : 'rounded-md border border-slate-200 bg-white p-3'
      }
    >
      <h2 id={labelId} className="text-sm font-medium text-slate-600">
        {label}
      </h2>
      {pending ? (
        <p className={primary ? 'py-1' : ''}>
          <span className="sr-only">Chargement…</span>
          <span
            aria-hidden="true"
            className={`block animate-pulse rounded bg-slate-200 ${primary ? 'h-9 w-56' : 'h-8 w-44'}`}
          />
        </p>
      ) : (
        <p className={primary ? 'text-3xl font-semibold tabular-nums' : 'text-2xl tabular-nums'}>
          {value ?? UNKNOWN}
        </p>
      )}
      {note ? <p className="text-sm text-slate-600">{note}</p> : null}
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

  const remaining =
    summary.isSuccess &&
    budgets.isSuccess &&
    spending.isSuccess &&
    debts.isSuccess &&
    payments.isSuccess
      ? formatAmount(
          remainingThisMonth({
            income: summary.data.income,
            spent: summary.data.spent,
            budgets: budgets.data,
            spending: spending.data,
            debts: debts.data,
            payments: payments.data,
          }),
        )
      : undefined

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
        note="Revenus du mois, moins les dépenses réalisées, ce qui reste à payer sur les charges fixes et les échéances de dettes."
      />

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

      <NotificationCentre
        notifications={notifications.data ?? []}
        categories={categories.data}
        ready={notifications.isSuccess}
        onDismiss={(id) => dismiss.mutate(id)}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Prochaines échéances</h2>

        {debts.isSuccess && dues.length === 0 ? <p>Aucune échéance à venir.</p> : null}

        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
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
                <span className="block text-sm text-slate-600">
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
        ready={spending.isSuccess}
      />
    </AppShell>
  )
}
