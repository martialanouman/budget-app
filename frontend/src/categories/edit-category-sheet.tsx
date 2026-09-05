import { Sheet } from '@/components/sheet'
import { type Category } from '@/lib/collections'
import { CategoryForm } from './category-form.tsx'
import { useUpdateCategory } from './categories-api.ts'

/**
 * CAT-02 and CAT-04 on a row that already exists, in a sheet rather than in the
 * row itself. §8 left the choice open; this is the one the correction of a
 * transaction already made, and five fields edited in place would take the
 * height of the screen anyway on the device this is built for.
 *
 * The sheet mounts its children only while open, so the form's values need no
 * effect to stay in step with the row being corrected — each opening starts
 * from the record it was given.
 */
export function EditCategorySheet({
  category,
  parents,
  onClose,
}: {
  category?: Category | undefined
  /** What may hold it: the screen owns the tree, the sheet only passes it on. */
  parents: Category[]
  onClose: () => void
}) {
  return (
    <Sheet open={category !== undefined} title="Modifier la catégorie" onClose={onClose}>
      {category ? <EditFields category={category} parents={parents} onClose={onClose} /> : null}
    </Sheet>
  )
}

function EditFields({
  category,
  parents,
  onClose,
}: {
  category: Category
  parents: Category[]
  onClose: () => void
}) {
  const update = useUpdateCategory()

  return (
    <CategoryForm
      category={category}
      parents={parents}
      failed={update.isError}
      onSave={(fields) => {
        update.reset()

        return update.mutateAsync({ ...fields, id: category.id })
      }}
      onSaved={onClose}
    />
  )
}
