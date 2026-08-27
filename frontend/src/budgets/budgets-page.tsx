import { formatAmount, reachedThresholds, remainingToLive, toMoney, unspent } from '@budget/domain'
import { useState } from 'react'
import { useCategories } from '@/categories/categories-api.ts'
import { AppShell } from '@/components/app-shell'
import { FormError } from '@/components/form-feedback'
import { TextField } from '@/components/text-field'
import { type Budget } from '@/lib/collections'
import { monthOf, todayLocally } from '@/lib/dates.ts'
import { AlertsPanel } from './alerts-panel.tsx'
import { useBudgetAlerts, useDismissAlert } from './alerts-api.ts'
import { CapForm } from './cap-form.tsx'
import {
  useBudgetSpending,
  useBudgets,
  useDuplicatePreviousMonth,
  useMonthlySummary,
  useSetCap,
} from './budgets-api.ts'

/** What the user is judged against: their own cap plus anything carried over. */
const ceilingOf = (budget: Budget) => toMoney(budget.cap_amount + budget.carried_amount)

function Envelope({ budget, spent }: { budget: Budget; spent: number }) {
  const cap = ceilingOf(budget)
  const total = toMoney(spent)
  const reached = reachedThresholds(cap, total)

  // Never colour alone: an alert that only exists as a hue says nothing to a
  // screen reader, nor to anyone who cannot separate amber from red.
  const alert = reached.includes(100)
    ? 'Plafond dépassé'
    : reached.includes(80)
      ? 'Seuil de 80 % atteint'
      : undefined

  return (
    <li className="space-y-2 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-medium">{budget.expand?.category?.name}</h3>
        <span className="text-sm tabular-nums text-slate-600">
          {`${formatAmount(total)} sur ${formatAmount(cap)}`}
        </span>
      </div>
      <progress
        value={Math.min(total, cap)}
        max={cap}
        aria-label={`Consommation de l'enveloppe ${budget.expand?.category?.name ?? ''}`}
        className="h-2 w-full"
      />
      <p className="text-sm text-slate-600">
        {`Reste ${formatAmount(unspent(cap, total))}`}
        {budget.carry_over ? ' · reporté le mois suivant' : ''}
      </p>
      {alert ? (
        <p className={reached.includes(100) ? 'text-sm text-red-700' : 'text-sm text-amber-700'}>
          {alert}
        </p>
      ) : null}
    </li>
  )
}

export function BudgetsPage() {
  const [month, setMonth] = useState(monthOf(todayLocally()))

  const categories = useCategories()
  const budgets = useBudgets(month)
  const spending = useBudgetSpending(month)
  const alerts = useBudgetAlerts()
  const dismissAlert = useDismissAlert()
  const summary = useMonthlySummary(month)
  const setCap = useSetCap()
  const duplicate = useDuplicatePreviousMonth()

  const activeCategories = (categories.data ?? []).filter((category) => category.active)

  const spentBy = new Map((spending.data ?? []).map((row) => [row.category, row.spent]))

  // Fixed envelopes are deducted for their unpaid part only: what has already
  // been paid is counted once, as spending.
  const unpaidFixedCharges = (budgets.data ?? [])
    .filter((budget) => budget.expand?.category?.kind === 'fixe')
    .reduce(
      (total, budget) =>
        toMoney(total + unspent(ceilingOf(budget), toMoney(spentBy.get(budget.category) ?? 0))),
      toMoney(0),
    )

  const remaining = remainingToLive({
    income: toMoney(summary.data?.income ?? 0),
    spent: toMoney(summary.data?.spent ?? 0),
    unpaidFixedCharges,
    // Debts arrive at step 6; the term is in the formula, its source is not.
    debtInstalments: toMoney(0),
  })

  return (
    <AppShell title="Budgets">
      <TextField
        label="Mois"
        type="month"
        value={month}
        onChange={(event) => setMonth(event.target.value || month)}
      />

      {categories.isSuccess ? (
        <CapForm
          categories={activeCategories}
          month={month}
          failed={setCap.isError}
          onSetCap={(draft) => {
            setCap.reset()

            return setCap.mutateAsync(draft)
          }}
        />
      ) : (
        <p>Chargement…</p>
      )}

      <section className="rounded-md border border-slate-200 bg-white p-3">
        <h2 className="text-lg font-medium">Reste à vivre</h2>
        <p className="text-2xl tabular-nums">{formatAmount(remaining)}</p>
        <p className="text-sm text-slate-600">
          Revenus du mois, moins les dépenses réalisées et ce qui reste à payer sur les charges
          fixes.
        </p>
      </section>

      <AlertsPanel
        alerts={alerts.data ?? []}
        categories={categories.data ?? []}
        onDismiss={(id) => dismissAlert.mutate(id)}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Enveloppes du mois</h2>
          <button
            type="button"
            onClick={() => {
              duplicate.reset()
              duplicate.mutate(month)
            }}
            disabled={duplicate.isPending}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 disabled:opacity-60"
          >
            Dupliquer le mois précédent
          </button>
        </div>

        {duplicate.isError ? <FormError message="La duplication a échoué." /> : null}
        {budgets.isError ? <FormError message="Impossible de charger vos budgets." /> : null}
        {budgets.isSuccess && budgets.data.length === 0 ? (
          <p>Aucune enveloppe pour ce mois.</p>
        ) : null}

        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {(budgets.data ?? []).map((budget) => (
            <Envelope key={budget.id} budget={budget} spent={spentBy.get(budget.category) ?? 0} />
          ))}
        </ul>
      </section>
    </AppShell>
  )
}
