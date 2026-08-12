import { QueryClient } from '@tanstack/react-query'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // View collections emit no realtime events, so freshness comes from
        // invalidating after a mutation rather than from a subscription.
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  })
}
