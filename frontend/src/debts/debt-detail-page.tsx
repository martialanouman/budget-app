import { formatAmount, toMoney } from '@budget/domain'
import { AppShell } from '@/components/app-shell'
import { FormError } from '@/components/form-feedback'
import { DEBT_DIRECTION_LABELS, DEBT_KIND_LABELS } from '@/lib/collections'
import { dayLabel } from '@/lib/dates.ts'
import { PaymentForm } from './payment-form.tsx'
import { estimatedEnd, owedOn, scheduleOf } from './debt-figures.ts'
import { useDebt, useDebtPayments, useDeletePayment, useRecordPayment } from './debts-api.ts'

export function DebtDetailPage({ debtId }: { debtId: string }) {
  const debt = useDebt(debtId)
  const payments = useDebtPayments(debtId)
  const recordPayment = useRecordPayment()
  const deletePayment = useDeletePayment()

  if (!debt.isSuccess) {
    return (
      <AppShell title="Dette">
        {debt.isError ? (
          <FormError message="Impossible de charger cette dette." />
        ) : (
          <p>Chargement…</p>
        )}
      </AppShell>
    )
  }

  const end = estimatedEnd(debt.data)
  const schedule = scheduleOf(debt.data)

  return (
    <AppShell title={debt.data.creditor}>
      <section className="rounded-md border border-slate-200 bg-white p-3">
        <p className="text-sm text-slate-600">
          {DEBT_DIRECTION_LABELS[debt.data.direction]} · {DEBT_KIND_LABELS[debt.data.kind]}
          {debt.data.interest_rate > 0
            ? ` · ${debt.data.interest_rate} % par an`
            : ' · sans intérêt'}
        </p>
        <h2 className="text-lg font-medium">Capital restant dû</h2>
        <p className="text-2xl tabular-nums">{formatAmount(owedOn(debt.data))}</p>
        <p className="text-sm text-slate-600">
          Mensualité {formatAmount(toMoney(debt.data.monthly_payment))} le {debt.data.due_day} du
          mois
          {end
            ? ` · fin estimée le ${dayLabel(end)}`
            : owedOn(debt.data) <= 0
              ? ' · soldée'
              : ' · la mensualité ne couvre pas les intérêts'}
        </p>
      </section>

      <PaymentForm
        failed={recordPayment.isError}
        onRecord={(payment) => {
          recordPayment.reset()

          return recordPayment.mutateAsync({ ...payment, debt: debtId })
        }}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Échéancier</h2>
        {schedule.length === 0 ? (
          <p>
            {owedOn(debt.data) <= 0
              ? 'Aucune échéance à venir : la dette est soldée.'
              : 'Aucune échéance : la mensualité ne couvre pas les intérêts.'}
          </p>
        ) : null}
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {schedule.map((instalment) => (
            <li key={instalment.number} className="flex justify-between gap-3 p-3 text-sm">
              <span>
                {instalment.number}. {dayLabel(instalment.dueDate)}
              </span>
              <span className="tabular-nums">
                {`${formatAmount(instalment.principal)} de capital · ${formatAmount(instalment.interest)} d’intérêts`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* DET-08: what was actually repaid, and how each repayment divided. */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Historique des remboursements</h2>

        {deletePayment.isError ? <FormError message="La suppression a échoué." /> : null}
        {payments.isSuccess && payments.data.length === 0 ? <p>Aucun remboursement.</p> : null}

        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {(payments.data ?? []).map((payment) => (
            <li key={payment.id} className="flex items-center gap-3 p-3 text-sm">
              <span className="min-w-0 flex-1">
                {dayLabel(payment.date)}
                <span className="block text-slate-600 tabular-nums">
                  {`${formatAmount(toMoney(payment.principal_part))} de capital · ${formatAmount(toMoney(payment.interest_part))} d’intérêts`}
                </span>
              </span>
              <span className="tabular-nums">{formatAmount(toMoney(payment.amount))}</span>
              <button
                type="button"
                onClick={() => deletePayment.mutate(payment.id)}
                aria-label={`Supprimer le remboursement du ${dayLabel(payment.date)}`}
                className="shrink-0 min-h-11 rounded-md border border-slate-300 px-3 outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40"
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  )
}
