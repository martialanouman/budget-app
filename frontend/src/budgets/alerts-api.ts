import { useQuery } from '@tanstack/react-query'
import { type Notification } from '@/lib/collections'
import { useDerivedMutation } from '@/lib/mutations.ts'
import { pb } from '@/lib/pocketbase'

const notifications = () => pb.collection('notifications')

/** Only what the user has not dismissed: a read alert has done its job. */
export function useBudgetAlerts() {
  return useQuery({
    queryKey: ['budget-alerts'],
    queryFn: () =>
      notifications().getFullList<Notification>({
        filter: "type = 'depassement_budget' && read = false",
        sort: '-created',
      }),
  })
}

/** The same row backs the dashboard's centre: both listings have to be told. */
export function useDismissAlert() {
  return useDerivedMutation([['budget-alerts'], ['notifications']], (id: string) =>
    notifications().update(id, { read: true }),
  )
}
