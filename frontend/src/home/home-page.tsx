import { AppShell } from '@/components/app-shell'
import { useAuth } from '@/auth/auth.ts'

export function HomePage() {
  const { email } = useAuth()

  return (
    <AppShell title="Budget">
      <p className="text-slate-700">Connecté en tant que {email}</p>
    </AppShell>
  )
}
