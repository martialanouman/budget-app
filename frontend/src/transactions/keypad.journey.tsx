import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { pb } from '@/lib/pocketbase'

const xof = (amount: string) => new RegExp(`^-?${amount.replace(/ /gu, '\\s')}\\sF\\sCFA$`, 'u')

beforeEach(() => {
  pb.authStore.clear()
})

async function anAccount(initialBalance: number) {
  await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: initialBalance,
  })
}

/**
 * TRX-09. The franc has no subunit, and a phone's numeric keyboard offers a
 * decimal key regardless — so the amount is typed on a keypad the application
 * draws itself, where every key is a franc.
 *
 * The keypad is on screen the moment the sheet opens, and reachable without a
 * tap on the field first — which is what keeps TRX-01's gesture count, measured
 * next door, where it was.
 */
it('records an expense typed on the in-app keypad', async () => {
  await createSignedInUser('kp')
  await anAccount(150_000)

  const { screen } = await renderApp('/')

  await expect.element(screen.getByText(xof('150 000'))).toBeVisible()

  await screen.getByRole('button', { name: 'Nouvelle transaction' }).click()
  await screen.getByRole('button', { name: '2', exact: true }).click()
  await screen.getByRole('button', { name: '0', exact: true }).click()
  await screen.getByRole('button', { name: '000', exact: true }).click()
  await screen.getByLabelText('Catégorie', { exact: true }).selectOptions('Alimentation')
  await screen.getByRole('button', { name: 'Enregistrer' }).click()

  await expect.element(screen.getByText(xof('130 000'))).toBeVisible()
})

/**
 * "Le montant en cours est annoncé". Pressing a key moves focus to the key, so
 * a screen reader hears "2" and nothing about the total — the live region is
 * the only thing that says what has been typed so far.
 *
 * It carries the formatted figure rather than the digits: the grouping and the
 * currency are what make "20000" readable as twenty thousand francs.
 */
it('announces the amount in francs as it is typed', async () => {
  await createSignedInUser('kp')
  await anAccount(150_000)

  const { screen } = await renderApp('/')

  await screen.getByRole('button', { name: 'Nouvelle transaction' }).click()
  await screen.getByRole('button', { name: '1', exact: true }).click()
  await screen.getByRole('button', { name: '5', exact: true }).click()
  await screen.getByRole('button', { name: '000', exact: true }).click()

  await expect.element(screen.getByRole('status')).toHaveTextContent(xof('15 000'))
})

/** A keypad with no way back is a keypad you have to close the sheet to escape. */
it('takes back the last digit', async () => {
  await createSignedInUser('kp')
  await anAccount(150_000)

  const { screen } = await renderApp('/')

  await screen.getByRole('button', { name: 'Nouvelle transaction' }).click()
  await screen.getByRole('button', { name: '9', exact: true }).click()
  await screen.getByRole('button', { name: '000', exact: true }).click()
  await screen.getByRole('button', { name: 'Effacer le dernier chiffre' }).click()

  await expect.element(screen.getByRole('status')).toHaveTextContent(xof('900'))
})

/**
 * The other half of TRX-09, and the one a keypad quietly takes away: the field
 * is still an input, so a physical keyboard and assistive technology still
 * enter an amount. `inputmode="none"` is what suppresses the system keyboard
 * without making the field read-only — asserted here because a browser under
 * test never opens one, so nothing else in this suite can see the difference.
 */
it('still takes an amount from a keyboard', async () => {
  await createSignedInUser('kp')
  await anAccount(150_000)

  const { screen } = await renderApp('/')

  await screen.getByRole('button', { name: 'Nouvelle transaction' }).click()

  const amount = screen.getByLabelText('Montant', { exact: true })

  await expect.element(amount).toHaveAttribute('inputmode', 'none')

  await amount.fill('20 000')
  await screen.getByLabelText('Catégorie', { exact: true }).selectOptions('Alimentation')
  await screen.getByRole('button', { name: 'Enregistrer' }).click()

  await expect.element(screen.getByText(xof('130 000'))).toBeVisible()
})

/**
 * "05" is worth five francs and reads like a mistake. The status line would not
 * see the difference — Number("05000") is five thousand either way — so the
 * assertion is on the figure the field shows.
 */
it('drops a leading zero rather than carrying it', async () => {
  await createSignedInUser('kp')
  await anAccount(150_000)

  const { screen } = await renderApp('/')

  await screen.getByRole('button', { name: 'Nouvelle transaction' }).click()
  await screen.getByRole('button', { name: '0', exact: true }).click()
  await screen.getByRole('button', { name: '5', exact: true }).click()
  await screen.getByRole('button', { name: '000', exact: true }).click()

  await expect.element(screen.getByLabelText('Montant', { exact: true })).toHaveValue('5000')
})
