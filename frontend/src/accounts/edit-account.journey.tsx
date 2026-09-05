import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { ACCOUNT_TYPE_ICONS } from '@/lib/appearance'
import { type Account } from '@/lib/collections'
import { pb } from '@/lib/pocketbase'

const SAVE = 'Enregistrer les modifications'

// Matched with \s: Intl separates thousands with narrow and non-breaking
// spaces, whose code points follow the ICU version bundled with the runtime.
const xof = (amount: string) => new RegExp(`^${amount.replace(/ /gu, '\\s')}\\sF\\sCFA$`, 'u')

const found = async (name: string) =>
  (await pb.collection('accounts').getFullList<Account>()).find((account) => account.name === name)

/** The swatch to the left of the name: decoration, so it is reached through its row. */
const decorationIn = (name: string) => {
  const row = [...document.querySelectorAll('li')].find((item) => item.textContent?.includes(name))
  const decoration = row?.querySelector<HTMLElement>('[aria-hidden="true"]')

  if (!decoration) throw new Error(`No row carrying "${name}" is on screen`)

  return decoration
}

const seedAccount = (fields: Partial<Account>) =>
  pb.collection('accounts').create<Account>({
    user: currentUserId(),
    type: 'banque',
    initial_balance: 0,
    color: '',
    archived: false,
    ...fields,
  })

beforeEach(() => {
  pb.authStore.clear()
})

/**
 * CPT-02. An account's icon is deduced from its type and is never chosen, which
 * makes the type the only way to correct one: an account opened as a bank
 * account when it is mobile money wore a bank until the type could be changed.
 */
it('renames an account and changes its type, so the icon it wears follows', async () => {
  await createSignedInUser('editacc')
  await seedAccount({ name: 'Compte courrant', type: 'banque', initial_balance: 150000 })

  const { screen } = await renderApp('/accounts')

  await expect
    .element(screen.getByRole('button', { name: 'Archiver Compte courrant' }))
    .toBeVisible()
  expect(decorationIn('Compte courrant').textContent).toBe(ACCOUNT_TYPE_ICONS.banque)

  await screen.getByRole('button', { name: 'Modifier Compte courrant' }).click()

  const sheet = screen.getByRole('dialog')
  await sheet.getByLabelText('Nom').fill('Wave')
  await sheet.getByLabelText('Type').selectOptions('mobile_money')
  await screen.getByRole('button', { name: SAVE }).click()

  await expect.element(screen.getByRole('button', { name: SAVE })).not.toBeInTheDocument()
  await expect.element(screen.getByRole('button', { name: 'Archiver Wave' })).toBeVisible()

  expect(decorationIn('Wave').textContent).toBe(ACCOUNT_TYPE_ICONS.mobile_money)
  expect((await found('Wave'))?.type).toBe('mobile_money')
})

/**
 * The measurable consequence §8 recorded: every account that predates the
 * refonte wears a hue derived from its name with no way to change it, because
 * the colour could only ever be chosen on the creation form.
 */
it('gives a chosen colour to an account that never had one', async () => {
  await createSignedInUser('editacc')
  await seedAccount({ name: 'Tontine', color: '' })

  const { screen } = await renderApp('/accounts')

  await screen.getByRole('button', { name: 'Modifier Tontine' }).click()
  await screen.getByRole('dialog').getByLabelText('Sarcelle').click()
  await screen.getByRole('button', { name: SAVE }).click()

  await expect.element(screen.getByRole('button', { name: SAVE })).not.toBeInTheDocument()

  expect((await found('Tontine'))?.color).toBe('sarcelle')
})

/**
 * The opening balance is on the correction form, and it is the one field there
 * that moves a figure already on screen. It is offered because there is no way
 * back from a mistyped one otherwise: an account is archived, never deleted, so
 * the alternative was carrying the wrong total for ever.
 *
 * The balance is summed from the entries at read time, so this also says the
 * derived figure is re-read after the write rather than left as it was.
 */
it('corrects a mistyped opening balance, and the balance follows', async () => {
  await createSignedInUser('editacc')
  await seedAccount({ name: 'Épargne logement', type: 'epargne', initial_balance: 90000 })

  const { screen } = await renderApp('/accounts')

  await expect.element(screen.getByText(xof('90 000'))).toBeVisible()

  await screen.getByRole('button', { name: 'Modifier Épargne logement' }).click()
  await screen.getByRole('dialog').getByLabelText('Solde initial').fill('900000')
  await screen.getByRole('button', { name: SAVE }).click()

  await expect.element(screen.getByRole('button', { name: SAVE })).not.toBeInTheDocument()
  await expect.element(screen.getByText(xof('900 000'))).toBeVisible()

  expect((await found('Épargne logement'))?.initial_balance).toBe(900000)
})
