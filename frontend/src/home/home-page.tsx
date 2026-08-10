import { useNavigate } from '@tanstack/react-router'
import { signOut, useAuth } from '@/auth/auth.ts'

export function HomePage() {
  const navigate = useNavigate()
  const { email } = useAuth()

  return (
    <main className="min-h-dvh bg-slate-50 p-6">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">Budget</h1>
        <p className="text-slate-700">Connecté en tant que {email}</p>
        <button
          type="button"
          onClick={() => {
            signOut()
            void navigate({ to: '/sign-in' })
          }}
          className="self-start rounded-md border border-slate-300 px-4 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40"
        >
          Se déconnecter
        </button>
      </div>
    </main>
  )
}
