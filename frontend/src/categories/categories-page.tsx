import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Disclosure } from '@/components/disclosure'
import { FormError } from '@/components/form-feedback'
import { ListSkeleton } from '@/components/list-skeleton'
import { SECONDARY_BUTTON_CLASS } from '@/components/secondary-button.ts'
import { hueClassOf, iconOf } from '@/lib/appearance'
import { CATEGORY_KIND_LABELS, type Category, type CategoryUsage } from '@/lib/collections'
import { CategoryForm } from './category-form.tsx'
import { EditCategorySheet } from './edit-category-sheet.tsx'
import {
  useCategories,
  useCategoryUsage,
  useCreateCategory,
  useDeleteCategory,
  useSetCategoryActive,
} from './categories-api.ts'

const countLabel = (count: number, one: string, many: string) =>
  count === 0 ? undefined : `${count} ${count === 1 ? one : many}`

/**
 * What is holding this category, or undefined when nothing is — and equally
 * when the counts have not been read. The delete button does not rely on that
 * ambiguity: it follows `deletable`, which is false until the counts are in.
 */
function heldBy(usage: CategoryUsage | undefined) {
  if (!usage) return undefined

  const holders = [
    countLabel(usage.transaction_count, 'transaction', 'transactions'),
    countLabel(usage.budget_count, 'enveloppe', 'enveloppes'),
    countLabel(usage.child_count, 'sous-catégorie', 'sous-catégories'),
  ].filter((holder) => holder !== undefined)

  return holders.length > 0 ? `Non supprimable — ${holders.join(', ')}` : undefined
}

// Roots and children share the row: CAT-02 must be reachable on both, and a
// deactivated one must look deactivated wherever it appears.
function CategoryRow({
  category,
  held,
  deletable,
  onEdit,
  onToggle,
  onDelete,
}: {
  category: Category
  held: string | undefined
  deletable: boolean
  onEdit: (category: Category) => void
  onToggle: (category: Category) => void
  onDelete: (category: Category) => void
}) {
  // The buttons sit on their own line rather than beside the name. Adding the
  // icon left "Alimentation" as "Alim…" on a 390px screen — the same squeeze
  // that the transactions rows hit when they gained a second button, and the
  // same answer.
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {/* Decoration, both of them. The name is right beside it, so neither the
            icon nor the hue is ever the only thing naming this category — the
            same reason the envelope bars can carry a colour at all. */}
        <span
          aria-hidden="true"
          className={`grid size-9 shrink-0 place-items-center rounded-field text-lg ${hueClassOf(category.color, category.name)}`}
        >
          {iconOf(category.icon)}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={
              category.active
                ? 'block truncate font-medium'
                : 'block truncate font-medium text-muted'
            }
          >
            {category.name}
          </span>
          <span className="block text-sm text-muted">
            {CATEGORY_KIND_LABELS[category.kind]}
            {category.active ? '' : ' — désactivée'}
          </span>
          {held ? <span className="block text-sm text-muted">{held}</span> : null}
        </span>
      </div>
      {/* The three fit on one line at 390px, measured: 86 + 102 + 102 and two
          gaps, so 306px of buttons in the 332 the row offers. `flex-wrap` is
          what those 26px of margin buy — a longer word in some future label
          drops to a second line instead of pushing the row into a sideways
          scroll. Keeping the words rather than trading them for icons is the
          deliberate half: "Désactiver" and "Supprimer" are too different to
          press by mistake. */}
      <div className="flex flex-wrap justify-end gap-2">
        {/* CAT-02 and CAT-04, which had no way in at all: the name, the nature
            and the ornament could only ever be set at creation. */}
        <button
          type="button"
          onClick={() => onEdit(category)}
          aria-label={`Modifier ${category.name}`}
          className={SECONDARY_BUTTON_CLASS}
        >
          Modifier
        </button>
        <button
          type="button"
          onClick={() => onToggle(category)}
          aria-label={`${category.active ? 'Désactiver' : 'Réactiver'} ${category.name}`}
          className={SECONDARY_BUTTON_CLASS}
        >
          {category.active ? 'Désactiver' : 'Réactiver'}
        </button>
        {/* Offered only when it will work. A button that fails teaches the
            obstacle at the costliest moment — after the user has acted. */}
        {deletable ? (
          <button
            type="button"
            onClick={() => onDelete(category)}
            aria-label={`Supprimer ${category.name}`}
            className={SECONDARY_BUTTON_CLASS}
          >
            Supprimer
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function CategoriesPage() {
  const categories = useCategories()
  const usage = useCategoryUsage()
  const createCategory = useCreateCategory()
  const setActive = useSetCategoryActive()
  const deleteCategory = useDeleteCategory()
  const [editing, setEditing] = useState<Category>()

  const roots = categories.data?.filter((category) => !category.parent) ?? []
  const childrenOf = (parentId: string) =>
    categories.data?.filter((category) => category.parent === parentId) ?? []

  const toggle = (category: Category) => {
    deleteCategory.reset()
    setActive.mutate({ id: category.id, active: !category.active })
  }

  const remove = (category: Category) => {
    setActive.reset()
    deleteCategory.mutate(category.id)
  }

  const usageOf = (id: string) => usage.data?.find((row) => row.id === id)

  const rowProps = (category: Category) => {
    const counts = usageOf(category.id)

    // The row itself has to be there. ['categories'] and ['category-usage'] are
    // two queries resolving in either order, so a category present in one
    // payload and not yet the other would otherwise be offered for deletion on
    // the strength of a figure nobody has read.
    return { held: heldBy(counts), deletable: counts !== undefined && heldBy(counts) === undefined }
  }

  // Kept apart from the form's: a failed deletion belongs beside the list, not
  // under the "add a category" form it has nothing to do with.
  const listMutationFailed = setActive.isError || deleteCategory.isError

  // A retired parent must not collect new children.
  const selectableParents = roots.filter((category) => category.active)

  /**
   * What may hold this one — two rules the creation form never had to state.
   * A category cannot be filed under itself, and one that already has children
   * cannot be filed at all: the screen draws the roots and then each root's
   * children, so a third level would simply not be drawn.
   *
   * Its own parent stays on offer even once deactivated, for the reason a
   * corrected transaction keeps its archived account: saving must not quietly
   * move a sub-category up to the root because the screen has stopped
   * proposing where it already sits.
   */
  const parentsFor = (category: Category) =>
    childrenOf(category.id).length > 0
      ? []
      : roots.filter((one) => one.id !== category.id && (one.active || one.id === category.parent))

  return (
    <AppShell title="Catégories">
      <Disclosure summary="Ajouter une catégorie">
        <CategoryForm
          parents={selectableParents}
          failed={createCategory.isError}
          onSave={(fields) => {
            createCategory.reset()

            return createCategory.mutateAsync(fields)
          }}
        />
      </Disclosure>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Mes catégories</h2>
        {categories.isPending ? <ListSkeleton /> : null}
        {categories.isError ? <FormError message="Impossible de charger vos catégories." /> : null}
        {listMutationFailed ? (
          <FormError message="L'opération sur cette catégorie a échoué. Vérifiez votre connexion et réessayez." />
        ) : null}
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {roots.map((category) => (
            <li key={category.id} className="p-3">
              <CategoryRow
                category={category}
                {...rowProps(category)}
                onEdit={setEditing}
                onToggle={toggle}
                onDelete={remove}
              />
              {childrenOf(category.id).length > 0 ? (
                <ul className="mt-3 ml-4 space-y-3 border-l border-line pl-3">
                  {childrenOf(category.id).map((child) => (
                    <li key={child.id}>
                      <CategoryRow
                        category={child}
                        {...rowProps(child)}
                        onEdit={setEditing}
                        onToggle={toggle}
                        onDelete={remove}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <EditCategorySheet
        category={editing}
        parents={editing ? parentsFor(editing) : []}
        onClose={() => setEditing(undefined)}
      />
    </AppShell>
  )
}
