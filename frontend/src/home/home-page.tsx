import { formatAmount, toMoney } from '@budget/domain'
import { Link } from '@tanstack/react-router'
import { useAccountBalances } from '@/accounts/accounts-api.ts'
import { useBudgetSpending, useBudgets } from '@/budgets/budgets-api.ts'
import { ceilingOf, remainingThisMonth } from '@/budgets/month-figures.ts'
import { useCategories } from '@/categories/categories-api.ts'
import { AppShell } from '@/components/app-shell'
import { useDebts } from '@/debts/debts-api.ts'
import { monthOf, todayLocally } from '@/lib/dates.ts'
import { useMonthlySummary } from '@/lib/monthly-summary.ts'
import { NotificationCentre } from './notification-centre.tsx'
import { SpendingBreakdown } from './spending-breakdown.tsx'
import { useDismissNotification, useNotifications } from './dashboard-api.ts'
import { upcomingDues } from './upcoming-dues.ts'

const Figure = ({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: string | undefined
}) => (
  <section className="rounded-md border border-slate-200 bg-white p-3">
    <h2 className="text-lg font-medium">{label}</h2>
    <p className="text-2xl tabular-nums">{value}</p>
    {note ? <p className="text-sm text-slate-600">{note}</p> : null}
  </section>
)

export function HomePage() {
  const month = monthOf(todayLocally())

  const balances = useAccountBalances()
  const summary = useMonthlySummary(month)
  const budgets = useBudgets(month)
  const spending = useBudgetSpending(month)
  const categories = useCategories()
  const debts = useDebts()
  const notifications = useNotifications()
  const dismiss = useDismissNotification()

  const total = toMoney(
    (balances.data ?? []).reduce((sum, account) => sum + (account.balance ?? 0), 0),
  )

  const spent = toMoney(summary.data?.spent ?? 0)
  const budgeted = toMoney((budgets.data ?? []).reduce((sum, budget) => sum + ceilingOf(budget), 0))

  const remaining = remainingThisMonth({
    income: summary.data?.income ?? 0,
    spent: summary.data?.spent ?? 0,
    budgets: budgets.data ?? [],
    spending: spending.data ?? [],
  })

  const dues = upcomingDues(debts.data ?? []).slice(0, 3)

  return (
    <AppShell title="Où j’en suis">
      <Figure label="Solde total" value={formatAmount(total)} />

      <Figure
        label="Dépenses du mois"
        value={`${formatAmount(spent)} sur ${formatAmount(budgeted)}`}
        note={budgeted === 0 ? 'Aucune enveloppe définie pour ce mois' : undefined}
      />

      <Figure
        label="Reste à vivre"
        value={formatAmount(remaining)}
        note="Revenus du mois, moins les dépenses réalisées et ce qui reste à payer sur les charges fixes."
      />

      <NotificationCentre
        notifications={notifications.data ?? []}
        categories={categories.data ?? []}
        ready={categories.isSuccess}
        onDismiss={(id) => dismiss.mutate(id)}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Prochaines échéances</h2>

        {dues.length === 0 ? <p>Aucune échéance à venir.</p> : null}

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
                  {date} ·{' '}
                  {inDays === 0 ? 'aujourd’hui' : `dans ${inDays} jour${inDays > 1 ? 's' : ''}`}
                </span>
              </span>
              <span className="tabular-nums">{formatAmount(toMoney(debt.monthly_payment))}</span>
            </li>
          ))}
        </ul>
      </section>

      <SpendingBreakdown spending={spending.data ?? []} categories={categories.data ?? []} />
    </AppShell>
  )
}
