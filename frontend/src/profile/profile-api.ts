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
      link.click()

      URL.revokeObjectURL(url)
    },
  })
}

export function useCloseAccount() {
  return useMutation({
    mutationFn: async () => {
      const id = pb.authStore.record?.id

      if (!id) throw new Error('No account is signed in.')

      await pb.collection('users').delete(id)

      // The token outlives the record it belonged to, so the store has to be
      // emptied by hand: left alone it still looks valid to the route guard.
      pb.authStore.clear()
    },
  })
}
