import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, renderApp } from '../../test/journey-harness.tsx'
import { type Account, type Category } from '@/lib/collections'
import { monthOf, todayLocally } from '@/lib/dates.ts'
import { pb } from '@/lib/pocketbase'

// Matched with \s: Intl separates thousands with narrow and non-breaking
// spaces, whose code points follow the ICU version bundled with the runtime.
const xof = (amount: string) => new RegExp(`^${amount.replace(/ /gu, '\\s')}\\sF\\sCFA$`, 'u')

beforeEach(() => {
  pb.authStore.clear()
})

/**
 * The nature of a category is not a label: `month-figures.ts` deducts the
 * unpaid part of every **fixed** envelope from what is left to live on, and it
 * reads that nature through `budget.expand.category.kind` — a copy carried
 * inside the `['budgets']` payload rather than read from `['categories']`.
 *
 * So correcting a category from the categories screen changes a figure that
 * lives on two other screens, and this is what says whether it actually
 * arrives there.
 */
it('recomputes what is left to live on when a category becomes a fixed charge', async () => {
  await createSignedInUser('kind')
  const user = currentUserId()

  const account = await pb.collection('accounts').create<Account>({
    user,
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 0,
    color: '',
    archived: false,
  })
  const category = await pb.collection('categories').create<Category>({
    user,
    name: 'Loyer',
    kind: 'variable',
    active: true,
    parent: '',
    icon: '',
    color: '',
  })

  await pb.collection('transactions').create({
    user,
    account: account.id,
    category: category.id,
    type: 'revenu',
    amount: 100000,
    date: todayLocally(),
    note: '',
  })
  await pb.collection('budgets').create({
    user,
    month: monthOf(todayLocally()),
    category: category.id,
    cap_amount: 30000,
    carried_amount: 0,
    carry_over: false,
  })

  const { screen } = await renderApp('/budgets')

  // Nothing is deducted yet: the envelope is a variable expense.
  await expect.element(screen.getByText(xof('100 000'))).toBeVisible()

  await screen.getByRole('button', { name: 'Menu' }).click()
  await screen.getByRole('link', { name: 'Catégories' }).click()

  await screen.getByRole('button', { name: 'Modifier Loyer' }).click()
  await screen.getByRole('dialog').getByLabelText('Nature').selectOptions('fixe')
  await screen.getByRole('button', { name: 'Enregistrer les modifications' }).click()

  await expect
    .element(screen.getByRole('button', { name: 'Enregistrer les modifications' }))
    .not.toBeInTheDocument()

  await screen.getByRole('link', { name: 'Budgets' }).click()

  // 100 000 of income, less the 30 000 the fixed envelope has still to pay.
  await expect.element(screen.getByText(xof('70 000'))).toBeVisible()
})
