import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId, signInAs } from '../../test/journey-harness.tsx'
import { type Category } from '@/lib/collections'
import { pb } from '@/lib/pocketbase'

const firstCategory = async () => (await pb.collection('categories').getFullList<Category>())[0]!

beforeEach(() => {
  pb.authStore.clear()
})

const anAccount = () =>
  pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 100_000,
  })

const spareCategory = (name = 'Créée par erreur') =>
  pb.collection('categories').create<Category>({
    user: currentUserId(),
    name,
    kind: 'variable',
    active: true,
  })

const categoryIds = async () =>
  (await pb.collection('categories').getFullList()).map((row) => row.id)

// A category nothing points at carries no history to preserve, so it can go.
// Deactivation still exists for every other case — that is what keeps past
// transactions attachable.
it('deletes a category nothing points at', async () => {
  await createSignedInUser('rules')
  const spare = await spareCategory()

  await pb.collection('categories').delete(spare.id)

  expect(await categoryIds()).not.toContain(spare.id)
})

it('refuses to delete a category a transaction still points at', async () => {
  await createSignedInUser('rules')
  const account = await anAccount()
  const used = await spareCategory('Utilisée')
  await pb.collection('transactions').create({
    user: currentUserId(),
    account: account.id,
    category: used.id,
    type: 'depense',
    amount: 5_000,
    date: '2026-08-12 10:00:00',
  })

  await expect(pb.collection('categories').delete(used.id)).rejects.toThrow()
  expect(await categoryIds()).toContain(used.id)
})

// budgets.category cascades. The refusal has to come before the delete, not
// after: a guard that ran late would reject the category and still have taken
// its envelopes with it, silently and with nothing on screen to say so.
it('keeps the envelopes of a category it refuses to delete', async () => {
  await createSignedInUser('rules')
  const budgeted = await spareCategory('Budgétée')
  const envelope = await pb.collection('budgets').create({
    user: currentUserId(),
    category: budgeted.id,
    month: '2026-08',
    cap_amount: 50_000,
  })

  await expect(pb.collection('categories').delete(budgeted.id)).rejects.toThrow()

  expect(await categoryIds()).toContain(budgeted.id)
  await expect(pb.collection('budgets').getOne(envelope.id)).resolves.toBeTruthy()
})

it('refuses to delete a category that still has children', async () => {
  await createSignedInUser('rules')
  const parent = await spareCategory('Parente')
  await pb.collection('categories').create({
    user: currentUserId(),
    name: 'Enfant',
    kind: 'variable',
    parent: parent.id,
    active: true,
  })

  await expect(pb.collection('categories').delete(parent.id)).rejects.toThrow()
  expect(await categoryIds()).toContain(parent.id)
})

// categories.user cascades, and PocketBase runs the delete hooks for cascaded
// records too. A guard that cannot tell a cascade from a deliberate delete sees
// the parent's surviving child and refuses — making any account that ever
// created a sub-category impossible to close (USR-04). Sub-categories are a
// first-class action on the categories page, so that is most accounts.
it('lets an owner close an account that has a sub-category', async () => {
  await createSignedInUser('closing')
  const owner = currentUserId()!
  const parent = (await pb.collection('categories').getFullList<Category>()).find(
    (category) => category.name === 'Loisirs',
  )!
  await pb.collection('categories').create({
    user: owner,
    name: 'Concert',
    kind: 'variable',
    parent: parent.id,
    active: true,
  })

  await expect(pb.collection('users').delete(owner)).resolves.toBe(true)
})

it('never lets an owner delete somebody else’s category', async () => {
  const victim = await createSignedInUser('victim')
  const theirs = await firstCategory()

  await createSignedInUser('intruder')

  await expect(pb.collection('categories').delete(theirs.id)).rejects.toThrow()

  // Read back as the owner: a refusal that had already deleted the record
  // would look identical from the intruder's side, which cannot see it either
  // way. Every sibling test here pairs the rejection with a survival check.
  await signInAs(victim)
  expect(await categoryIds()).toContain(theirs.id)
})

it('refuses to delete an account outright', async () => {
  await createSignedInUser('rules')
  const account = await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte courant',
    type: 'banque',
    initial_balance: 1_000,
  })

  await expect(pb.collection('accounts').delete(account.id)).rejects.toThrow()
})

// A category whose parent belongs to someone else renders nowhere: it is not a
// root, and no visible root claims it as a child. It would be unreachable.
it('refuses a parent category owned by somebody else', async () => {
  await createSignedInUser('victim')
  const theirs = await firstCategory()

  await createSignedInUser('intruder')

  await expect(
    pb.collection('categories').create({
      user: currentUserId(),
      name: 'Sournoise',
      kind: 'variable',
      parent: theirs.id,
    }),
  ).rejects.toThrow()
})

// PocketBase does not re-evaluate relation-path conditions on update, so the
// createRule guard alone leaves the move open.
it('refuses to move a transaction onto somebody else’s account', async () => {
  await createSignedInUser('victim')
  const theirAccount = await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte de la victime',
    type: 'banque',
    initial_balance: 100_000,
  })

  await createSignedInUser('intruder')
  const ownAccount = await pb.collection('accounts').create({
    user: currentUserId(),
    name: 'Compte propre',
    type: 'especes',
    initial_balance: 1_000,
  })
  const entry = await pb.collection('transactions').create({
    user: currentUserId(),
    account: ownAccount.id,
    category: (await firstCategory()).id,
    type: 'depense',
    amount: 500,
    date: '2026-08-12 10:00:00',
  })

  await expect(
    pb.collection('transactions').update(entry.id, { account: theirAccount.id }),
  ).rejects.toThrow()
})

it('still accepts a parent the caller owns', async () => {
  await createSignedInUser('owner')
  const mine = await firstCategory()

  const child = await pb.collection('categories').create({
    user: currentUserId(),
    name: 'Sous-catégorie',
    kind: 'variable',
    parent: mine.id,
  })

  expect(child.parent).toBe(mine.id)
})
