import { useQuery } from '@tanstack/react-query'
import { type Category, type CategoryKind, type CategoryUsage } from '@/lib/collections'
import { useDerivedMutation } from '@/lib/mutations.ts'
import { pb } from '@/lib/pocketbase'

const categories = () => pb.collection('categories')

export type CategoryDraft = {
  name: string
  kind: CategoryKind
  parent?: string
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

export function useCreateCategory() {
  return useCategoryMutation((draft: CategoryDraft) =>
    categories().create({
      user: pb.authStore.record?.id,
      name: draft.name,
      kind: draft.kind,
      parent: draft.parent ?? '',
      active: true,
    }),
  )
}

// CAT-02 deactivates rather than deletes: past transactions keep their category.
export function useSetCategoryActive() {
  return useCategoryMutation(({ id, active }: { id: string; active: boolean }) =>
    categories().update(id, { active }),
  )
}

export function useRenameCategory() {
  return useCategoryMutation(({ id, name }: { id: string; name: string }) =>
    categories().update(id, { name }),
  )
}

// Only a category nothing points at; the server refuses the rest, and the page
// does not offer the button. Deactivation stays the answer for everything with
// history behind it.
export function useDeleteCategory() {
  return useCategoryMutation((id: string) => categories().delete(id))
}
