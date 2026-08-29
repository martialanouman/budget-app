import { useMutation } from '@tanstack/react-query'
import { pb } from '@/lib/pocketbase'

/** Whatever the server gathered; the screen only ever writes it to a file. */
type AccountExport = Record<string, unknown>

const fileNameFor = (now: Date) => `budget-${now.toISOString().slice(0, 10)}.json`

export function useExportData() {
  return useMutation({
    mutationFn: async () => {
      const data = await pb.send<AccountExport>('/api/export', { method: 'GET' })

      // Indented on purpose. An export exists so somebody can read and keep
      // their own data, not only so a machine can parse it back.
      const file = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')

      link.href = url
      link.download = fileNameFor(new Date())

      // In the document, and revoked on a later tick. A detached anchor whose
      // object URL disappears in the same tick as the click saves nothing at
      // all on iOS Safari — the first target of a mobile-first application —
      // while the mutation resolves and the screen announces a file nobody
      // received.
      document.body.appendChild(link)
      link.click()
      link.remove()

      setTimeout(() => URL.revokeObjectURL(url), 0)
    },
  })
}

export function useCloseAccount() {
  return useMutation({
    mutationFn: async () => {
      const id = pb.authStore.record?.id

      if (!id) throw new Error('No account is signed in.')

      // The SDK empties the auth store itself when the deleted id is the
      // authenticated record — verified in pocketbase@0.27.1. Clearing it again
      // here would only fire a second onChange, and a second router
      // invalidation. What holds this is the journey: it asserts the sign-in
      // screen comes back, which only happens once the store is empty.
      await pb.collection('users').delete(id)
    },
  })
}
