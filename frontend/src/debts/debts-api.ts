import { useQuery } from '@tanstack/react-query'
import { type Debt, type DebtPayment } from '@/lib/collections'
import { useMonthlySummary } from '@/lib/monthly-summary.ts'
import { useDerivedMutation } from '@/lib/mutations.ts'
import { pb } from '@/lib/pocketbase'

const debts = () => pb.collection('debts')
const payments = () => pb.collection('debt_payments')

/** Everything a repayment derives: the debt itself, its history, the totals. */
const DEBT_KEYS = [['debts'], ['debt-payments']] as const

export type DebtDraft = {
  creditor: string
  kind: string
  direction: string
  initialAmount: number
  interestRate: number
  monthlyPayment: number
  dueDay: number
  startDate: string
}

export function useDebts() {
  return useQuery({
    queryKey: ['debts'],
    queryFn: () => debts().getFullList<Debt>({ sort: 'status,creditor' }),
  })
}

export function useDebt(id: string) {
  return useQuery({
    queryKey: ['debts', id],
    queryFn: () => debts().getOne<Debt>(id),
  })
}

export function useDebtPayments(debtId: string) {
  return useQuery({
    queryKey: ['debt-payments', debtId],
    queryFn: () =>
      payments().getFullList<DebtPayment>({
        filter: pb.filter('debt = {:debt}', { debt: debtId }),
        sort: '-date,-created',
      }),
  })
}

/**
 * DET-05 needs the month's income to state what share the debts take. It reads
 * the same view as the budgets screen and deliberately shares its cache entry:
 * the two used to hold the same key for different shapes, so arriving from one
 * screen made the other read an object as a number.
 */
export function useMonthlyIncome(month: string) {
  const summary = useMonthlySummary(month)

  return { ...summary, income: summary.data?.income ?? 0 }
}

export function useCreateDebt() {
  return useDerivedMutation(DEBT_KEYS, (draft: DebtDraft) =>
    debts().create({
      user: pb.authStore.record?.id,
      creditor: draft.creditor,
      kind: draft.kind,
      direction: draft.direction,
      initial_amount: draft.initialAmount,
      remaining_amount: draft.initialAmount,
      interest_rate: draft.interestRate,
      monthly_payment: draft.monthlyPayment,
      due_day: draft.dueDay,
      start_date: draft.startDate,
      status: 'active',
    }),
  )
}

export function useRecordPayment() {
  return useDerivedMutation(DEBT_KEYS, (payment: { debt: string; amount: number; date: string }) =>
    payments().create({ user: pb.authStore.record?.id, ...payment }),
  )
}

export function useDeletePayment() {
  return useDerivedMutation(DEBT_KEYS, (id: string) => payments().delete(id))
}
