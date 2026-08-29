import { beforeEach, expect, it } from 'vitest'
import { PASSWORD, createSignedInUser, renderApp } from '../../test/journey-harness.tsx'
import { pb } from '@/lib/pocketbase'

beforeEach(() => {
  pb.authStore.clear()
})

// The download itself is browser plumbing and asserting it would test the
// browser. What can regress is the call behind it: a wrong route, or a refusal
// reported as success. The screen says when the export came back, and that is
// what this holds.
it('reports that the export came back', async () => {
  await createSignedInUser('profile')
  const { screen } = await renderApp('/profile')

  await screen.getByRole('button', { name: 'Télécharger mes données' }).click()

  await expect.element(screen.getByText(/Vos données ont été téléchargées/u)).toBeVisible()
})

// Closing an account destroys everything and cannot be undone. A button that
// does that on a single click is a trap, so it stays out of reach until the
// owner has written their own address.
it('keeps the closing button out of reach until the address is written', async () => {
  const email = await createSignedInUser('profile')
  const { screen } = await renderApp('/profile')

  const close = screen.getByRole('button', { name: 'Supprimer définitivement mon compte' })
  await expect.element(close).toBeDisabled()

  await screen.getByLabelText('Confirmez avec votre adresse e-mail').fill('autre@example.com')
  await expect.element(close).toBeDisabled()

  await screen.getByLabelText('Confirmez avec votre adresse e-mail').fill(email)
  await expect.element(close).toBeEnabled()

  // PocketBase authenticates case-insensitively but stores the case the owner
  // registered with. An exact comparison would lock somebody who signed up as
  // Jean.Dupont@… out of ever closing their own account.
  await screen
    .getByLabelText('Confirmez avec votre adresse e-mail')
    .fill(` ${email.toUpperCase()} `)
  await expect.element(close).toBeEnabled()
})

it('closes the account for good', async () => {
  const email = await createSignedInUser('profile')
  const { screen } = await renderApp('/profile')

  await screen.getByLabelText('Confirmez avec votre adresse e-mail').fill(email)
  await screen.getByRole('button', { name: 'Supprimer définitivement mon compte' }).click()

  // Back on the sign-in screen, and the account no longer exists: signing in
  // again is the only assertion that distinguishes "closed" from "logged out".
  await expect.element(screen.getByRole('button', { name: 'Se connecter' })).toBeVisible()
  await expect(pb.collection('users').authWithPassword(email, PASSWORD)).rejects.toThrow()
})
