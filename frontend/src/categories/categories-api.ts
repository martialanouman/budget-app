import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type Category, type CategoryKind } from '@/lib/collections'
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

function useCategoryMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  })
}

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
