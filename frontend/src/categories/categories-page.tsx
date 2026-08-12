import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { AppShell } from '@/components/app-shell'
import { SelectField } from '@/components/select-field'
import { TextField } from '@/components/text-field'
import { CATEGORY_KINDS, CATEGORY_KIND_LABELS, type CategoryKind } from '@/lib/collections'
import { useCategories, useCreateCategory, useSetCategoryActive } from './categories-api.ts'

const schema = z.object({
  name: z.string().min(1, 'Nom requis'),
  kind: z.enum(CATEGORY_KINDS),
  parent: z.string(),
})

type FormValues = z.infer<typeof schema>

export function CategoriesPage() {
  const categories = useCategories()
  const createCategory = useCreateCategory()
  const setActive = useSetCategoryActive()

  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', kind: 'variable', parent: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    await createCategory.mutateAsync(values)
    reset()
  })

  const roots = categories.data?.filter((category) => !category.parent) ?? []
  const childrenOf = (parentId: string) =>
    categories.data?.filter((category) => category.parent === parentId) ?? []

  const parentOptions = [
    { value: '', label: 'Aucune (catégorie principale)' },
    ...roots.map((category) => ({ value: category.id, label: category.name })),
  ]

  return (
    <AppShell title="Catégories">
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
        <h2 className="text-lg font-medium">Ajouter une catégorie</h2>
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
        <button
          type="submit"
          disabled={formState.isSubmitting}
          className="rounded-md bg-slate-900 px-4 py-2.5 font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 disabled:opacity-60"
        >
          Créer la catégorie
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Mes catégories</h2>
        {categories.isPending ? <p>Chargement…</p> : null}
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {roots.map((category) => (
            <li key={category.id} className="p-3">
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
                  onClick={() =>
                    void setActive.mutateAsync({ id: category.id, active: !category.active })
                  }
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40"
                >
                  {category.active ? 'Désactiver' : 'Réactiver'} {category.name}
                </button>
              </div>
              {childrenOf(category.id).length > 0 ? (
                <ul className="mt-2 ml-4 space-y-1 border-l border-slate-200 pl-3">
                  {childrenOf(category.id).map((child) => (
                    <li key={child.id} className="text-sm text-slate-700">
                      {child.name}
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
