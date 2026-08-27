import { useQuery } from '@tanstack/react-query'
import { type Budget, type BudgetSpending } from '@/lib/collections'
import { previousMonth } from '@/lib/dates.ts'
import { useDerivedMutation } from '@/lib/mutations.ts'
import { pb } from '@/lib/pocketbase'

const budgets = () => pb.collection('budgets')

export type CapDraft = {
  month: string
  category: string
  cap: number
  carryOver: boolean
}

export function useBudgets(month: string) {
  return useQuery({
    queryKey: ['budgets', month],
    queryFn: () =>
      budgets().getFullList<Budget>({
        filter: pb.filter('month = {:month}', { month }),
        expand: 'category',
        sort: 'category.name',
      }),
  })
}

export function useBudgetSpending(month: string) {
  return useQuery({
    queryKey: ['budget-spending', month],
    queryFn: () =>
      pb.collection('budget_spending').getFullList<BudgetSpending>({
        filter: pb.filter('month = {:month}', { month }),
      }),
  })
}

const useBudgetMutation = <TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) =>
  useDerivedMutation<TVariables>([['budgets']], mutationFn)

/**
 * One envelope per category and month, so setting a cap twice adjusts the
 * existing one. The unique index is what actually guarantees it; this lookup
 * only spares the user an error they did not cause.
 */
export function useSetCap() {
  return useBudgetMutation(async (draft: CapDraft) => {
    const existing = await budgets()
      .getFirstListItem<Budget>(
        pb.filter('month = {:month} && category = {:category}', {
          month: draft.month,
          category: draft.category,
        }),
      )
      .catch(() => null)

    const fields = { cap_amount: draft.cap, carry_over: draft.carryOver }

    return existing
      ? budgets().update(existing.id, fields)
      : budgets().create({
          user: pb.authStore.record?.id,
          month: draft.month,
          category: draft.category,
          carried_amount: 0,
          ...fields,
        })
  })
}

export function useRemoveCap() {
  return useBudgetMutation((id: string) => budgets().delete(id))
}

/**
 * BUD-02. Envelopes already set for the target month are left alone rather
 * than overwritten: the click is meant to fill an empty month, and silently
 * replacing a cap someone has just adjusted would lose their work.
 */
export function useDuplicatePreviousMonth() {
  return useBudgetMutation(async (month: string) => {
    const [previous, current] = await Promise.all([
      budgets().getFullList<Budget>({
        filter: pb.filter('month = {:month}', { month: previousMonth(month) }),
      }),
      budgets().getFullList<Budget>({ filter: pb.filter('month = {:month}', { month }) }),
    ])

    const alreadySet = new Set(current.map((budget) => budget.category))

    return Promise.all(
      previous
        .filter((budget) => !alreadySet.has(budget.category))
        .map((budget) =>
          budgets().create({
            user: pb.authStore.record?.id,
            month,
            category: budget.category,
            cap_amount: budget.cap_amount,
            carry_over: budget.carry_over,
            carried_amount: 0,
          }),
        ),
    )
  })
}
