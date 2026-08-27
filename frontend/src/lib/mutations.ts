import { useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * A write followed by the invalidation of everything it derives.
 *
 * The cancellation is not decoration. A read still in flight when the write
 * starts resolves with pre-write data, and TanStack Query reuses that in-flight
 * request rather than starting a second one — so the invalidation that follows
 * is satisfied by an answer older than the write, and the screen keeps showing
 * a list without the row just created. Measured: a form submitted while the
 * list was still loading left the new envelope invisible until the next
 * navigation.
 */
export function useDerivedMutation<TVariables>(
  keys: readonly (readonly string[])[],
  mutationFn: (variables: TVariables) => Promise<unknown>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onMutate: () => Promise.all(keys.map((queryKey) => queryClient.cancelQueries({ queryKey }))),
    onSuccess: () =>
      Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  })
}
