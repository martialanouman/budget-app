import { beforeEach, expect, it } from 'vitest'
import {
  PASSWORD,
  createSignedInUser,
  renderApp,
  uniqueEmail,
} from '../../test/journey-harness.tsx'
import { pb } from '@/lib/pocketbase'

const NEW_PASSWORD = 'nouveau-mot-de-passe'

beforeEach(() => {
  pb.authStore.clear()
})

// Changing a password rotates the account's tokenKey, so the session it was
// done from is dead the moment it succeeds. Landing back on the sign-in screen
// for having done an ordinary thing correctly is what the re-authentication
// avoids — and the screen staying put is how one can see it worked.
it('changes the password and leaves the owner where they were', async () => {
  await createSignedInUser('sec')
  const { screen } = await renderApp('/profile')

  await screen.getByLabelText('Mot de passe actuel').fill(PASSWORD)
  await screen.getByLabelText('Nouveau mot de passe', { exact: true }).fill(NEW_PASSWORD)
  await screen.getByLabelText('Confirmer le nouveau mot de passe').fill(NEW_PASSWORD)
  await screen.getByRole('button', { name: 'Changer mon mot de passe' }).click()

  await expect.element(screen.getByText('Votre mot de passe a été modifié.')).toBeVisible()
  // Exact: "Mon compte" is also inside "Fermer mon compte".
  await expect
    .element(screen.getByRole('heading', { name: 'Mon compte', exact: true }))
    .toBeVisible()
})

it('refuses the change when the current password is wrong', async () => {
  await createSignedInUser('sec')
  const { screen } = await renderApp('/profile')

  await screen.getByLabelText('Mot de passe actuel').fill('ce-nest-pas-le-bon')
  await screen.getByLabelText('Nouveau mot de passe', { exact: true }).fill(NEW_PASSWORD)
  await screen.getByLabelText('Confirmer le nouveau mot de passe').fill(NEW_PASSWORD)
  await screen.getByRole('button', { name: 'Changer mon mot de passe' }).click()

  await expect.element(screen.getByText(/Vérifiez votre mot de passe actuel/u)).toBeVisible()
})

// Naming the address back is the only way a typo is ever noticed: a link sent
// to an address nobody owns is indistinguishable from one still in flight.
it('names the address the confirmation was sent to', async () => {
  await createSignedInUser('sec')
  const wanted = uniqueEmail('wanted')
  const { screen } = await renderApp('/profile')

  await screen.getByLabelText('Nouvelle adresse e-mail').fill(wanted)
  await screen.getByRole('button', { name: 'Envoyer le lien de confirmation' }).click()

  await expect.element(screen.getByText(new RegExp(wanted, 'u'))).toBeVisible()
  await expect.element(screen.getByText(/reste active/u)).toBeVisible()
})

it('turns the second factor on and says so', async () => {
  await createSignedInUser('sec')
  const { screen } = await renderApp('/profile')

  const toggle = screen.getByRole('button', { name: 'Activer la double authentification' })
  await expect.element(toggle).toHaveAttribute('aria-pressed', 'false')

  await toggle.click()

  await expect
    .element(screen.getByRole('button', { name: 'Désactiver la double authentification' }))
    .toHaveAttribute('aria-pressed', 'true')
})

// The account with a second factor cannot be signed back in from this screen,
// so the session ends and the sign-in screen is where it ends. What this
// replaces is worse than the redirection: it used to announce a failure over a
// password that had in fact been changed.
it('sends the owner to sign in again when a code is owed', async () => {
  await createSignedInUser('sec')
  await pb.collection('users').update(pb.authStore.record!.id, { mfa_enabled: true })

  const { screen } = await renderApp('/profile')

  await screen.getByLabelText('Mot de passe actuel').fill(PASSWORD)
  await screen.getByLabelText('Nouveau mot de passe', { exact: true }).fill(NEW_PASSWORD)
  await screen.getByLabelText('Confirmer le nouveau mot de passe').fill(NEW_PASSWORD)
  await screen.getByRole('button', { name: 'Changer mon mot de passe' }).click()

  await expect.element(screen.getByRole('heading', { name: 'Connexion' })).toBeVisible()
  await expect
    .element(screen.getByText(/Vérifiez votre mot de passe actuel/u))
    .not.toBeInTheDocument()
})
