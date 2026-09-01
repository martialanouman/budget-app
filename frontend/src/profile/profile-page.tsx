import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AppShell } from '@/components/app-shell'
import { FormError, SubmitButton } from '@/components/form-feedback'
import { TextField } from '@/components/text-field'
import { useAuth } from '@/auth/auth.ts'
import { useCloseAccount, useExportData, useSaveName } from './profile-api.ts'
import { SecuritySection } from './security-section.tsx'

/** What the `users.name` column holds; the field refuses more rather than the server. */
const NAME_MAX_LENGTH = 255

const DESTRUCTIVE =
  'w-full rounded-md bg-danger px-4 py-2.5 text-base font-medium text-on-accent outline-none focus-visible:ring-2 focus-visible:ring-danger/40 disabled:opacity-50'

export function ProfilePage() {
  const { email, name } = useAuth()
  const exportData = useExportData()
  const closeAccount = useCloseAccount()
  const saveName = useSaveName()
  const navigate = useNavigate()
  const [confirmation, setConfirmation] = useState('')
  const [nameDraft, setNameDraft] = useState(name ?? '')
  const [lastSeenName, setLastSeenName] = useState(name)

  // Seeded once, the field went on holding whatever it was born with. The auth
  // store carries a name saved in another tab into this one, so the header
  // followed it while the input did not — and saving here wrote the older name
  // back over the newer. Following it means an edit in progress gives way to a
  // name saved elsewhere, which is the right way round: that one is on record.
  //
  // Adjusted during the render rather than in an effect: React re-runs this
  // one before committing anything, so nothing flashes and no cascade of
  // renders follows. A `key` on the form would reset it too, but by remounting
  // — which drops focus from the button the owner has just pressed.
  if (name !== lastSeenName) {
    setLastSeenName(name)
    setNameDraft(name ?? '')
  }

  // Typing the address is what separates a deliberate closure from a slip, and
  // that is all it has to do. The comparison forgives case and surrounding
  // space: PocketBase authenticates case-insensitively but stores the case the
  // owner registered with, so an exact match would lock somebody who signed up
  // as Jean.Dupont@… out of ever closing their own account.
  const normalise = (value: string) => value.trim().toLowerCase()
  const confirmed = confirmation !== '' && normalise(confirmation) === normalise(email ?? '')

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
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Mon profil</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            saveName.reset()
            saveName.mutate(nameDraft)
          }}
          className="space-y-3"
        >
          {saveName.isError ? (
            <FormError message="L’enregistrement a échoué. Vérifiez votre connexion et réessayez." />
          ) : null}
          <TextField
            label="Nom"
            value={nameDraft}
            autoComplete="name"
            maxLength={NAME_MAX_LENGTH}
            onChange={(event) => setNameDraft(event.target.value)}
          />
          {/* Said aloud, like the export below it. Saving a name that is
              already the name changes nothing on screen, so without this the
              only evidence the click landed was the header — and none at all
              for a screen reader (WCAG 2.1 SC 4.1.3, which is AA). */}
          {saveName.isSuccess ? (
            <p role="status" className="text-sm text-muted">
              Votre nom a été enregistré.
            </p>
          ) : null}
          <SubmitButton pending={saveName.isPending}>Enregistrer mon nom</SubmitButton>
        </form>
      </section>

      <SecuritySection />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Mes données</h2>
        <p className="text-sm text-muted">
          Un fichier contenant l’intégralité de ce que vous avez saisi : comptes, catégories,
          transactions, budgets, dettes, remboursements et notifications.
        </p>
        {exportData.isError ? (
          <FormError message="Le téléchargement a échoué. Vérifiez votre connexion et réessayez." />
        ) : null}
        {exportData.isSuccess ? (
          <p role="status" className="text-sm text-muted">
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
          className="min-h-11 rounded-md border border-line px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60"
        >
          Télécharger mes données
        </button>
      </section>

      <section className="space-y-3 rounded-md border border-danger bg-danger-soft p-4">
        <h2 className="text-lg font-medium text-danger">Fermer mon compte</h2>
        <p className="text-sm text-danger">
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
