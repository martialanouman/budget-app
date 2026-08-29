import { QueryClient } from '@tanstack/react-query'
import { ClientResponseError } from 'pocketbase'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // A refused or missing record answers the same way however often it is
        // asked: retrying a 4xx only postpones telling the user that the
        // figure could not be read, and the screens say so on purpose. Network
        // and server faults keep their retries.
        retry: (failureCount, error) =>
          !(error instanceof ClientResponseError && error.status >= 400 && error.status < 500) &&
          failureCount < 3,
      },
    },
  })
}
