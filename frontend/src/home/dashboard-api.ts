import { useQuery } from '@tanstack/react-query'
import { type Notification } from '@/lib/collections'
import { useDerivedMutation } from '@/lib/mutations.ts'
import { pb } from '@/lib/pocketbase'

const notifications = () => pb.collection('notifications')

/** NOT-04, in-app side: everything the user has not dismissed, newest first. */
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      notifications().getFullList<Notification>({ filter: 'read = false', sort: '-created' }),
  })
}

export function useDismissNotification() {
  return useDerivedMutation([['notifications'], ['budget-alerts']], (id: string) =>
    notifications().update(id, { read: true }),
  )
}
