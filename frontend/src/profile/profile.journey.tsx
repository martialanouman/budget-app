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

// The header greets on every screen, so the name has to reach it from the one
// place it is written. What makes this worth a test is not the label but the
// refresh: the auth store's snapshot used to be the token alone, and a name
// saved without a new token left React comparing two identical snapshots and
// re-rendering nothing — right in the database, stale on screen.
it('greets the owner by the name they save', async () => {
  await createSignedInUser('profile')
  const { screen } = await renderApp('/profile')

  await screen.getByLabelText('Nom').fill('Aya')
  await screen.getByRole('button', { name: 'Enregistrer mon nom' }).click()

  await expect.element(screen.getByText('Bon retour, Aya')).toBeVisible()
})

// Nobody has a name until they give one, and "Bon retour," followed by nothing
// greets no one. The address is what the header showed before and what it
// falls back to.
it('falls back to the address while no name has been given', async () => {
  const email = await createSignedInUser('profile')
  const { screen } = await renderApp('/profile')

  await expect.element(screen.getByText(`Bon retour, ${email}`)).toBeVisible()
})

// The same greeting, refreshed from outside the React tree. The test above
// passes either way — saving the name re-renders the page, and the header
// re-reads the store on the way down — so it says nothing about useAuth
// itself. This does: nothing here re-renders anybody, so the only path to the
// screen is the auth store notifying its subscribers, which it can only do if
// the snapshot notices a record whose token has not changed.
//
// The path is real: the SDK replaces the record like this whenever it
// refreshes a session.
it('follows the name when the record changes under it', async () => {
  await createSignedInUser('profile')
  const { screen } = await renderApp('/profile')

  const record = pb.authStore.record!

  await expect.element(screen.getByText(/^Bon retour, /u)).toBeVisible()

  pb.authStore.save(pb.authStore.token, { ...record, name: 'Aya' })

  await expect.element(screen.getByText('Bon retour, Aya')).toBeVisible()
})
