import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId } from '../../test/journey-harness.tsx'
import { type Category } from '@/lib/collections'
import { pb } from '@/lib/pocketbase'

const firstCategory = async () => (await pb.collection('categories').getFullList<Category>())[0]!

beforeEach(() => {
  pb.authStore.clear()
})

// Nothing is ever deleted: an account is archived, a category deactivated, so
// past transactions stay attachable. The storage layer has to enforce that —
// the UI merely respects it.
it('refuses to delete a category outright', async () => {
  await createSignedInUser('rules')
  const category = await firstCategory()

  await expect(pb.collection('categories').delete(category.id)).rejects.toThrow()
  expect((await pb.collection('categories').getFullList()).map((row) => row.id)).toContain(
    category.id,
  )
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
