import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId } from '../../test/journey-harness.tsx'
import { type Category } from '@/lib/collections'
import { pb } from '@/lib/pocketbase'

type Export = {
  exported_at: string
  account: Record<string, unknown>
  accounts: { name: string }[]
  categories: { name: string }[]
  transactions: { amount: number }[]
  budgets: { cap_amount: number }[]
  debts: { creditor: string }[]
  debt_payments: { amount: number }[]
  notifications: unknown[]
}

const exportEverything = () => pb.send<Export>('/api/export', { method: 'GET' })

/** One row in every collection the owner can fill. */
const aFurnishedAccount = async (creditor: string) => {
  const owner = currentUserId()!
  const account = await pb.collection('accounts').create({
    user: owner,
    name: `Compte de ${creditor}`,
    type: 'banque',
    initial_balance: 250_000,
  })
  const category = (await pb.collection('categories').getFullList<Category>())[0]!

  await pb.collection('transactions').create({
    user: owner,
    account: account.id,
    category: category.id,
    type: 'depense',
    amount: 12_000,
    date: '2026-08-20 10:00:00',
  })
  await pb.collection('budgets').create({
    user: owner,
    category: category.id,
    month: '2026-08',
    cap_amount: 80_000,
  })
  const debt = await pb.collection('debts').create({
    user: owner,
    creditor,
    kind: 'pret_bancaire',
    direction: 'je_dois',
    initial_amount: 500_000,
    interest_rate: 0,
    monthly_payment: 50_000,
    due_day: 5,
    start_date: '2026-01-10',
    status: 'active',
  })
  await pb.collection('debt_payments').create({
    user: owner,
    debt: debt.id,
    amount: 50_000,
    date: '2026-02-05',
  })
}

beforeEach(() => {
  pb.authStore.clear()
})

// USR-04. "L'export produit l'intégralité des données de l'utilisateur" — so
// the test asks for all of it, not for a sample.
it('hands the owner everything they put in', async () => {
  const email = await createSignedInUser('export')
  await aFurnishedAccount('Banque Atlantique')
  await pb.collection('users').update(currentUserId()!, { name: 'Aya Konaté' })

  const data = await exportEverything()

  expect(data.account.email).toBe(email)
  // The account block is an allow-list, so a field added to the screen and not
  // to the hook leaves the export quietly missing something the owner typed.
  expect(data.account.name).toBe('Aya Konaté')
  expect(data.accounts.map((one) => one.name)).toContain('Compte de Banque Atlantique')
  expect(data.transactions.map((one) => one.amount)).toContain(12_000)
  expect(data.budgets.map((one) => one.cap_amount)).toContain(80_000)
  expect(data.debts.map((one) => one.creditor)).toContain('Banque Atlantique')
  expect(data.debt_payments.map((one) => one.amount)).toContain(50_000)
  expect(data.categories.length).toBeGreaterThan(0)
  expect(data.exported_at).toMatch(/^\d{4}-\d{2}-\d{2}/u)
})

// An export route reads past the access rules by construction, so the only
// thing keeping one owner out of another's data is that it scopes itself to
// the caller. That is worth a test of its own.
it('never hands one owner another’s data', async () => {
  await createSignedInUser('victim')
  await aFurnishedAccount('Créancier de la victime')

  await createSignedInUser('intruder')
  await aFurnishedAccount('Créancier de l’intrus')

  const data = await exportEverything()

  expect(data.debts.map((one) => one.creditor)).toEqual(['Créancier de l’intrus'])
  expect(data.accounts.map((one) => one.name)).toEqual(['Compte de Créancier de l’intrus'])
})

// A dump of "everything about me" is the easiest place to leak a credential.
it('carries no password and no session key', async () => {
  await createSignedInUser('export')

  const serialised = JSON.stringify(await exportEverything())

  for (const secret of ['password', 'tokenKey', 'passwordConfirm']) {
    expect({ secret, found: serialised.includes(secret) }).toEqual({ secret, found: false })
  }
})
