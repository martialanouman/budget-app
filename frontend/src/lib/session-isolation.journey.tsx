import { beforeEach, expect, it } from 'vitest'
import {
  PASSWORD,
  createSignedInUser,
  currentUserId,
  renderApp,
} from '../../test/journey-harness.tsx'
import { pb } from '@/lib/pocketbase'

const createAccountNamed = (name: string, type: string) =>
  pb.collection('accounts').create({
    user: currentUserId(),
    name,
    type,
    initial_balance: 1_000,
  })

beforeEach(() => {
  pb.authStore.clear()
})

// The provider never unmounts on sign-out, so without an explicit clear the
// query cache outlives the session and renders the previous user's data.
it('shows nothing of the previous account after switching users in the same tab', async () => {
  // Both accounts exist before the app mounts: creating one mid-session would
  // change the auth store under the running app and trigger a redirect.
  const kofi = await createSignedInUser('kofi')
  await createAccountNamed('Compte de Kofi', 'especes')

  await createSignedInUser('awa')
  await createAccountNamed('Compte de Awa', 'banque')

  const { screen, client } = await renderApp('/accounts')
  await expect.element(screen.getByRole('button', { name: 'Archiver Compte de Awa' })).toBeVisible()
  expect(client.getQueryData(['accounts'])).toBeDefined()

  await screen.getByRole('button', { name: 'Se déconnecter' }).click()
  await expect.element(screen.getByRole('heading', { name: 'Connexion' })).toBeVisible()

  // Asserted on the cache, not the screen: the exposure window closes as soon
  // as the background refetch lands, so a rendered check would pass either way.
  expect(client.getQueryData(['accounts'])).toBeUndefined()
  expect(client.getQueryData(['account-balances'])).toBeUndefined()

  await screen.getByLabelText('Adresse e-mail').fill(kofi)
  await screen.getByLabelText('Mot de passe', { exact: true }).fill(PASSWORD)
  await screen.getByRole('button', { name: 'Se connecter' }).click()

  await screen.getByRole('link', { name: 'Comptes' }).click()

  await expect
    .element(screen.getByRole('button', { name: 'Archiver Compte de Kofi' }))
    .toBeVisible()
  await expect
    .element(screen.getByRole('button', { name: 'Archiver Compte de Awa' }))
    .not.toBeInTheDocument()
})
