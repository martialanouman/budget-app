import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { FormError, SubmitButton } from '@/components/form-feedback'
import { ListSkeleton } from '@/components/list-skeleton'
import { AppShell } from '@/components/app-shell'
import { Disclosure } from '@/components/disclosure'
import { SelectField } from '@/components/select-field'
import { TextField } from '@/components/text-field'
import { ChoiceGrid } from '@/components/choice-grid'
import { FALLBACK_ICON, HUES, HUE_LABELS, ICONS, hueClassOf, iconOf } from '@/lib/appearance'
import {
  CATEGORY_KINDS,
  CATEGORY_KIND_LABELS,
  type Category,
  type CategoryKind,
  type CategoryUsage,
} from '@/lib/collections'
import {
  useCategories,
  useCategoryUsage,
  useCreateCategory,
  useDeleteCategory,
  useSetCategoryActive,
} from './categories-api.ts'

const schema = z.object({
  name: z.string().min(1, 'Nom requis').max(60, '60 caractères maximum'),
  kind: z.enum(CATEGORY_KINDS),
  parent: z.string(),
  // CAT-04. Both are chosen from a closed set, so the enum is the validation:
  // an emoji field open to anything would have to be validated for something.
  icon: z.enum(ICONS),
  color: z.enum(HUES),
})

type FormValues = z.infer<typeof schema>

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
  onToggle,
  onDelete,
}: {
  category: Category
  held: string | undefined
  deletable: boolean
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
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onToggle(category)}
          aria-label={`${category.active ? 'Désactiver' : 'Réactiver'} ${category.name}`}
          className="min-h-11 shrink-0 rounded-md border border-line-strong px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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
            className="min-h-11 shrink-0 rounded-md border border-line-strong px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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

  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      kind: 'variable',
      parent: '',
      icon: FALLBACK_ICON,
      color: 'terracotta',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    createCategory.reset()

    // Removing the <option> resets what the browser shows but fires no change
    // event, so the form can still hold a parent deactivated meanwhile. What
    // the user sees — "Aucune" — is what gets saved.
    const parent = selectableParents.some((category) => category.id === values.parent)
      ? values.parent
      : ''

    try {
      await createCategory.mutateAsync({ ...values, parent })
      reset()
    } catch {
      // Surfaced through createCategory.isError below.
    }
  })

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
  const parentOptions = [
    { value: '', label: 'Aucune (catégorie principale)' },
    ...selectableParents.map((category) => ({ value: category.id, label: category.name })),
  ]

  return (
    <AppShell title="Catégories">
      <Disclosure summary="Ajouter une catégorie">
        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
          {createCategory.isError ? (
            <FormError message="La création de la catégorie a échoué. Vérifiez votre connexion et réessayez." />
          ) : null}
          <TextField label="Nom" error={formState.errors.name?.message} {...register('name')} />
          <SelectField
            label="Nature"
            options={CATEGORY_KINDS.map((kind: CategoryKind) => ({
              value: kind,
              label: CATEGORY_KIND_LABELS[kind],
            }))}
            error={formState.errors.kind?.message}
            {...register('kind')}
          />
          <SelectField label="Catégorie parente" options={parentOptions} {...register('parent')} />
          <ChoiceGrid
            legend="Icône"
            options={ICONS.map((icon) => ({
              value: icon,
              label: icon,
              swatch: <span className="text-xl">{icon}</span>,
            }))}
            {...register('icon')}
          />
          <ChoiceGrid
            legend="Couleur"
            options={HUES.map((hue) => ({
              value: hue,
              label: HUE_LABELS[hue],
              swatch: <span className={`size-6 rounded-full ${hueClassOf(hue, '')}`} />,
            }))}
            {...register('color')}
          />
          <SubmitButton pending={formState.isSubmitting}>Créer la catégorie</SubmitButton>
        </form>
      </Disclosure>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Mes catégories</h2>
        {categories.isPending ? <ListSkeleton /> : null}
        {categories.isError ? <FormError message="Impossible de charger vos catégories." /> : null}
        {listMutationFailed ? (
          <FormError message="L'opération sur cette catégorie a échoué. Vérifiez votre connexion et réessayez." />
        ) : null}
        <ul className="divide-y divide-line rounded-md border border-line bg-surface">
          {roots.map((category) => (
            <li key={category.id} className="p-3">
              <CategoryRow
                category={category}
                {...rowProps(category)}
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
    </AppShell>
  )
}
