import { useQuery } from '@tanstack/react-query'
import { type Notification } from '@/lib/collections'
import { useDerivedMutation } from '@/lib/mutations.ts'
import { pb } from '@/lib/pocketbase'

const notifications = () => pb.collection('notifications')

/**
 * NOT-04, in-app side: what the user has not dismissed, newest first.
 *
 * Bounded rather than exhaustive. A dashboard that has gone unread for months
 * would otherwise pull every reminder the crons ever wrote into a screen meant
 * to be read at a glance, on a phone connection.
 */
const MOST_RECENT = 20

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () =>
      (
        await notifications().getList<Notification>(1, MOST_RECENT, {
          filter: 'read = false',
          sort: '-created',
        })
      ).items,
  })
}

export function useDismissNotification() {
  return useDerivedMutation([['notifications'], ['budget-alerts']], (id: string) =>
    notifications().update(id, { read: true }),
  )
}
