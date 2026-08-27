import { beforeEach, expect, it } from 'vitest'
import { createSignedInUser, currentUserId } from '../../test/journey-harness.tsx'
import { type Budget, type Category } from '@/lib/collections'
import { monthOf, todayLocally } from '@/lib/dates.ts'
import { pb } from '@/lib/pocketbase'

const myCategory = async (name = 'Alimentation') => {
  const categories = await pb.collection('categories').getFullList<Category>()

  return categories.find((one) => one.name === name)!.id
}

const anEnvelope = async (category: string, fields: Record<string, unknown> = {}) =>
  pb.collection('budgets').create<Budget>({
    user: currentUserId(),
    month: monthOf(todayLocally()),
    category,
    cap_amount: 100_000,
    carry_over: false,
    carried_amount: 0,
    ...fields,
  })

beforeEach(() => {
  pb.authStore.clear()
})

// PocketBase applies `category.user = @request.auth.id` when a record is
// created and not when it is updated — measured on transactions at step 4, and
// left open here. A budget moved onto a stranger's category renders without a
// title, never matches the spending view, and hangs off a record its owner
// cannot see.
it('refuses to move an envelope onto another owner’s category', async () => {
  await createSignedInUser('victim')
  const theirs = await myCategory()

  await createSignedInUser('intruder')
  const envelope = await anEnvelope(await myCategory())

  await expect(pb.collection('budgets').update(envelope.id, { category: theirs })).rejects.toThrow()

  const kept = await pb.collection('budgets').getOne<Budget>(envelope.id)

  expect(kept.category).not.toBe(theirs)
})

// `carried_amount` is the server's to write: it is what the previous month
// leaves behind, not a figure the client may state.
it('ignores a carry-over amount stated by the client', async () => {
  await createSignedInUser('own')

  const forged = await anEnvelope(await myCategory(), {
    cap_amount: 1,
    carried_amount: 5_000_000,
  })

  expect(forged.carried_amount).toBe(0)
})
