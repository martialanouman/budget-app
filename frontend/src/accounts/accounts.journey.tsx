import { createMemoryHistory } from '@tanstack/react-router'
import { beforeEach, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { pb } from '@/lib/pocketbase'
import { AppRouterProvider, createAppRouter } from '@/router.tsx'

const PASSWORD = 'motdepasse-solide'

let seq = 0
const uniqueEmail = () => `owner${Date.now()}-${++seq}@example.com`

async function renderApp(initialPath: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [initialPath] }))

  return render(<AppRouterProvider router={router} />)
}

async function signUpAndSignIn() {
  const email = uniqueEmail()

  await pb.collection('users').create({ email, password: PASSWORD, passwordConfirm: PASSWORD })
  await pb.collection('users').authWithPassword(email, PASSWORD)

  return email
}

beforeEach(() => {
  pb.authStore.clear()
})

it('creates two accounts and archives one of them', async () => {
  await signUpAndSignIn()
  const screen = await renderApp('/accounts')

  await screen.getByLabelText('Nom').fill('Compte courant')
  await screen.getByLabelText('Solde initial').fill('150 000')
  await screen.getByRole('button', { name: 'Créer le compte' }).click()

  await expect.element(screen.getByText('150 000 F CFA')).toBeVisible()

  await screen.getByLabelText('Nom').fill('Espèces')
  await screen.getByLabelText('Type').selectOptions('especes')
  await screen.getByLabelText('Solde initial').fill('25 000')
  await screen.getByRole('button', { name: 'Créer le compte' }).click()

  await expect.element(screen.getByText('25 000 F CFA')).toBeVisible()

  await screen.getByRole('button', { name: 'Archiver Espèces' }).click()

  // Gone from the active list, but still restorable: the history is kept.
  await expect.element(screen.getByRole('heading', { name: 'Comptes archivés' })).toBeVisible()
  await expect.element(screen.getByRole('button', { name: 'Restaurer Espèces' })).toBeVisible()
  await expect.element(screen.getByText('25 000 F CFA')).not.toBeInTheDocument()
})

it('refuses an initial balance with decimals, which the franc has none of', async () => {
  await signUpAndSignIn()
  const screen = await renderApp('/accounts')

  await screen.getByLabelText('Nom').fill('Compte bancaire')
  await screen.getByLabelText('Solde initial').fill('1500,75')
  await screen.getByRole('button', { name: 'Créer le compte' }).click()

  await expect.element(screen.getByText('Montant en francs, sans décimale')).toBeVisible()
})

it('shows the balance from the server view, not from the form input', async () => {
  await signUpAndSignIn()

  const created = await pb.collection('accounts').create({
    user: pb.authStore.record?.id,
    name: 'Épargne',
    type: 'epargne',
    initial_balance: 90_000,
  })
  const balances = await pb.collection('account_balances').getFullList<{ id: string }>()

  expect(balances.map((entry) => entry.id)).toEqual([created.id])
})

it('never exposes another owner’s accounts or balances', async () => {
  await signUpAndSignIn()
  await pb.collection('accounts').create({
    user: pb.authStore.record?.id,
    name: 'Compte privé',
    type: 'banque',
    initial_balance: 1_000,
  })

  await signUpAndSignIn()

  expect(await pb.collection('accounts').getFullList()).toEqual([])
  expect(await pb.collection('account_balances').getFullList()).toEqual([])
})
