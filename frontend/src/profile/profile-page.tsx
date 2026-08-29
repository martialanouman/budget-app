import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AppShell } from '@/components/app-shell'
import { FormError } from '@/components/form-feedback'
import { TextField } from '@/components/text-field'
import { useAuth } from '@/auth/auth.ts'
import { useCloseAccount, useExportData } from './profile-api.ts'

const DESTRUCTIVE =
  'w-full rounded-md bg-red-700 px-4 py-2.5 text-base font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-red-700/40 disabled:opacity-50'

export function ProfilePage() {
  const { email } = useAuth()
  const exportData = useExportData()
  const closeAccount = useCloseAccount()
  const navigate = useNavigate()
  const [confirmation, setConfirmation] = useState('')

  // Typing the address is what separates a deliberate closure from a slip. The
  // comparison is exact: an approximate match would defeat the point of asking.
  const confirmed = confirmation === email

  const close = async () => {
    try {
      await closeAccount.mutateAsync()
      await navigate({ to: '/sign-in' })
    } catch {
      // Surfaced through closeAccount.isError below.
    }
  }

  return (
    <AppShell title="Mon compte">
      <p className="text-sm text-slate-600">Connecté en tant que {email}</p>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Mes données</h2>
        <p className="text-sm text-slate-600">
          Un fichier contenant l’intégralité de ce que vous avez saisi : comptes, catégories,
          transactions, budgets, dettes, remboursements et notifications.
        </p>
        {exportData.isError ? (
          <FormError message="Le téléchargement a échoué. Vérifiez votre connexion et réessayez." />
        ) : null}
        {exportData.isSuccess ? (
          <p role="status" className="text-sm text-slate-600">
            Vos données ont été téléchargées.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            exportData.reset()
            exportData.mutate()
          }}
          disabled={exportData.isPending}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 disabled:opacity-60"
        >
          Télécharger mes données
        </button>
      </section>

      <section className="space-y-3 rounded-md border border-red-200 bg-red-50 p-4">
        <h2 className="text-lg font-medium text-red-900">Fermer mon compte</h2>
        <p className="text-sm text-red-900">
          Tout est supprimé définitivement : comptes, transactions, budgets, dettes et historique.
          Cette action est irréversible. Téléchargez vos données avant, si vous voulez les garder.
        </p>
        {closeAccount.isError ? (
          <FormError message="La fermeture du compte a échoué. Vérifiez votre connexion et réessayez." />
        ) : null}
        <TextField
          label="Confirmez avec votre adresse e-mail"
          type="email"
          autoComplete="off"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        <button
          type="button"
          onClick={() => void close()}
          disabled={!confirmed || closeAccount.isPending}
          className={DESTRUCTIVE}
        >
          Supprimer définitivement mon compte
        </button>
      </section>
    </AppShell>
  )
}
