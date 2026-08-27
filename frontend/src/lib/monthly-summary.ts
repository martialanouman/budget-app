import { useQuery } from '@tanstack/react-query'
import { type MonthlySummary } from '@/lib/collections'
import { pb } from '@/lib/pocketbase'

/**
 * The month's income and spending, read by the budgets screen and by the debts
 * screen alike. Shared rather than copied: the two once held the same cache
 * key for different shapes — a number here, an object there — so arriving from
 * one screen made the other read the wrong one, and the share of income
 * rendered as "NaN %" until the background refetch landed.
 */
export function useMonthlySummary(month: string) {
  return useQuery({
    queryKey: ['monthly-summary', month],
    queryFn: async () => {
      const rows = await pb.collection('monthly_summary').getFullList<MonthlySummary>({
        filter: pb.filter('month = {:month}', { month }),
      })

      return rows[0] ?? { income: 0, spent: 0 }
    },
  })
}
