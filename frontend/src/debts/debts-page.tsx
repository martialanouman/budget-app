import { formatAmount } from '@budget/domain'
import { Link } from '@tanstack/react-router'
import { AppShell } from '@/components/app-shell'
import { FormError } from '@/components/form-feedback'
import { DEBT_DIRECTION_LABELS, DEBT_KIND_LABELS, type Debt } from '@/lib/collections'
import { monthOf, todayLocally } from '@/lib/dates.ts'
import { DebtForm } from './debt-form.tsx'
import { estimatedEnd, owedOn, shareOfIncome, totalOwed } from './debt-figures.ts'
import { useCreateDebt, useDebts, useMonthlyIncome } from './debts-api.ts'

function DebtRow({ debt }: { debt: Debt }) {
  const end = estimatedEnd(debt)

  return (
    <li className="p-3">
      <Link
        to="/debts/$debtId"
        params={{ debtId: debt.id }}
        className="font-medium underline-offset-4 hover:underline"
      >
        {debt.creditor}
      </Link>
      <p className="text-sm text-slate-600">
        {DEBT_DIRECTION_LABELS[debt.direction]} · {DEBT_KIND_LABELS[debt.kind]}
        {debt.status === 'soldee' ? ' · soldée' : ''}
      </p>
      <p className="tabular-nums">{formatAmount(owedOn(debt))}</p>
      <p className="text-sm text-slate-600">
        {end
          ? `Fin estimée le ${end}`
          : owedOn(debt) <= 0
            ? 'Soldée'
            : 'La mensualité ne couvre pas les intérêts'}
      </p>
    </li>
  )
}

export function DebtsPage() {
  const debts = useDebts()
  const income = useMonthlyIncome(monthOf(todayLocally()))
  const createDebt = useCreateDebt()

  const all = debts.data ?? []
  const share = shareOfIncome(all, income.income)

  return (
    <AppShell title="Dettes">
      <section className="rounded-md border border-slate-200 bg-white p-3">
        <h2 className="text-lg font-medium">Total dû</h2>
        <p className="text-2xl tabular-nums">{formatAmount(totalOwed(all))}</p>
        <p className="text-sm text-slate-600">
          {share === undefined
            ? 'Part des revenus inconnue : aucun revenu ce mois-ci'
            : `${share} % des revenus du mois`}
        </p>
      </section>

      <DebtForm
        failed={createDebt.isError}
        onCreate={(draft) => {
          createDebt.reset()

          return createDebt.mutateAsync(draft)
        }}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Vos dettes</h2>

        {debts.isError ? <FormError message="Impossible de charger vos dettes." /> : null}
        {debts.isSuccess && all.length === 0 ? <p>Aucune dette enregistrée.</p> : null}

        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {all.map((debt) => (
            <DebtRow key={debt.id} debt={debt} />
          ))}
        </ul>
      </section>
    </AppShell>
  )
}
