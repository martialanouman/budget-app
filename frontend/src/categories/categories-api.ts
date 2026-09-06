import { useQuery } from '@tanstack/react-query'
import { type Category, type CategoryKind, type CategoryUsage } from '@/lib/collections'
import { useDerivedMutation } from '@/lib/mutations.ts'
import { pb } from '@/lib/pocketbase'

const categories = () => pb.collection('categories')

export type CategoryDraft = {
  name: string
  kind: CategoryKind
  parent: string
  icon: string
  color: string
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => categories().getFullList<Category>({ sort: 'name' }),
  })
}

/**
 * What holds each category, counted server-side. Deriving it in the browser
 * would mean reading every transaction the account has ever recorded.
 */
export function useCategoryUsage() {
  return useQuery({
    queryKey: ['category-usage'],
    queryFn: () => pb.collection('category_usage').getFullList<CategoryUsage>(),
  })
}

const useCategoryMutation = <TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) =>
  useDerivedMutation<TVariables>([['categories'], ['category-usage']], mutationFn)

export type CategoryEdit = CategoryDraft & { id: string }

export function useCreateCategory() {
  return useCategoryMutation((draft: CategoryDraft) =>
    categories().create({
      user: pb.authStore.record?.id,
      name: draft.name,
      kind: draft.kind,
      parent: draft.parent,
      active: true,
      icon: draft.icon,
      color: draft.color,
    }),
  )
}

// CAT-02 deactivates rather than deletes: past transactions keep their category.
export function useSetCategoryActive() {
  return useCategoryMutation(({ id, active }: { id: string; active: boolean }) =>
    categories().update(id, { active }),
  )
}

/**
 * CAT-02 and CAT-04, on a category that already exists. One write for the name,
 * the nature, the parent and the ornament: they are corrected on one form, and
 * splitting the call would only let a half-saved row exist.
 *
 * It replaces `useRenameCategory`, which had been here since step 3 without a
 * single caller — the third field or hook of this repository found in that
 * state, after `useUpdateTransaction` and `accounts.color`.
 */
export function useUpdateCategory() {
  return useCategoryMutation(({ id, ...fields }: CategoryEdit) => categories().update(id, fields))
}

// Only a category nothing points at; the server refuses the rest, and the page
// does not offer the button. Deactivation stays the answer for everything with
// history behind it.
export function useDeleteCategory() {
  return useCategoryMutation((id: string) => categories().delete(id))
}
