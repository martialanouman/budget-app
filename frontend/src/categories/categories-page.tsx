import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { FormError, SubmitButton } from '@/components/form-feedback'
import { AppShell } from '@/components/app-shell'
import { SelectField } from '@/components/select-field'
import { TextField } from '@/components/text-field'
import {
  CATEGORY_KINDS,
  CATEGORY_KIND_LABELS,
  type Category,
  type CategoryKind,
} from '@/lib/collections'
import { useCategories, useCreateCategory, useSetCategoryActive } from './categories-api.ts'

const schema = z.object({
  name: z.string().min(1, 'Nom requis').max(60, '60 caractères maximum'),
  kind: z.enum(CATEGORY_KINDS),
  parent: z.string(),
})

type FormValues = z.infer<typeof schema>

// Roots and children share the row: CAT-02 must be reachable on both, and a
// deactivated one must look deactivated wherever it appears.
function CategoryRow({
  category,
  onToggle,
}: {
  category: Category
  onToggle: (category: Category) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex-1">
        <span className={category.active ? 'font-medium' : 'font-medium text-slate-400'}>
          {category.name}
        </span>
        <span className="block text-sm text-slate-600">
          {CATEGORY_KIND_LABELS[category.kind]}
          {category.active ? '' : ' — désactivée'}
        </span>
      </span>
      <button
        type="button"
        onClick={() => onToggle(category)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40"
      >
        {category.active ? 'Désactiver' : 'Réactiver'} {category.name}
      </button>
    </div>
  )
}

export function CategoriesPage() {
  const categories = useCategories()
  const createCategory = useCreateCategory()
  const setActive = useSetCategoryActive()

  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', kind: 'variable', parent: '' },
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

  const toggle = (category: Category) =>
    setActive.mutate({ id: category.id, active: !category.active })

  // A retired parent must not collect new children.
  const selectableParents = roots.filter((category) => category.active)
  const parentOptions = [
    { value: '', label: 'Aucune (catégorie principale)' },
    ...selectableParents.map((category) => ({ value: category.id, label: category.name })),
  ]

  return (
    <AppShell title="Catégories">
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
        <h2 className="text-lg font-medium">Ajouter une catégorie</h2>
        {createCategory.isError || setActive.isError ? (
          <FormError message="L'opération a échoué. Vérifiez votre connexion et réessayez." />
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
        <SubmitButton pending={formState.isSubmitting}>Créer la catégorie</SubmitButton>
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Mes catégories</h2>
        {categories.isPending ? <p>Chargement…</p> : null}
        {categories.isError ? <FormError message="Impossible de charger vos catégories." /> : null}
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {roots.map((category) => (
            <li key={category.id} className="p-3">
              <CategoryRow category={category} onToggle={toggle} />
              {childrenOf(category.id).length > 0 ? (
                <ul className="mt-3 ml-4 space-y-3 border-l border-slate-200 pl-3">
                  {childrenOf(category.id).map((child) => (
                    <li key={child.id}>
                      <CategoryRow category={child} onToggle={toggle} />
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
