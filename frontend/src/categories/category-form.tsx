import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ChoiceGrid } from '@/components/choice-grid'
import { HueGrid } from '@/components/hue-grid'
import { FormError, SubmitButton } from '@/components/form-feedback'
import { SelectField } from '@/components/select-field'
import { TextField } from '@/components/text-field'
import { FALLBACK_ICON, HUES, ICONS, hueOf, iconOf } from '@/lib/appearance'
import {
  CATEGORY_KINDS,
  CATEGORY_KIND_LABELS,
  type Category,
  type CategoryKind,
} from '@/lib/collections'

const schema = z.object({
  name: z.string().min(1, 'Nom requis').max(60, '60 caractères maximum'),
  kind: z.enum(CATEGORY_KINDS),
  parent: z.string(),
  // CAT-04. Both are chosen from a closed set, so the enum is the validation:
  // an emoji field open to anything would have to be validated for something.
  // Empty is the fourth state and the ordinary one on creation — nothing chosen
  // is stored as nothing, so the fallback lives in lib/appearance.ts rather
  // than being frozen into the row on the day it was created.
  icon: z.enum(ICONS).or(z.literal('')),
  color: z.enum(HUES).or(z.literal('')),
})

export type CategoryFields = z.infer<typeof schema>

/**
 * One form for creating a category and for correcting one (CAT-02, CAT-04).
 *
 * A second copy would be a second place for the rules on a name, a nature or an
 * ornament to drift — the same reason the entry form is shared between typing
 * an expense and correcting one.
 *
 * The appearance grids open differently in the two cases, and deliberately.
 * Creating, the colour rests on "Aucune" and no icon is ticked: what must never
 * be pre-selected is a *hue*, which would paint every new category alike.
 * Correcting, both open on what the row is actually wearing — derived from the
 * name when nothing was ever stored. A grid with nothing checked beside a row
 * that visibly has a colour reads as a defect, and it hid a real one: since the
 * hue is derived from the name, a correction to the spelling repainted the row
 * on the way past.
 */
export function CategoryForm({
  category,
  parents,
  failed,
  onSave,
  onSaved,
}: {
  /** The category being corrected, absent when one is being created. */
  category?: Category | undefined
  /** What may hold this one, already filtered by the screen that knows the tree. */
  parents: Category[]
  failed: boolean
  onSave: (fields: CategoryFields) => Promise<unknown>
  /** Called once the write is in and the form has been reset, never before. */
  onSaved?: (() => void) | undefined
}) {
  const correcting = category !== undefined

  const { register, handleSubmit, reset, formState } = useForm<CategoryFields>({
    resolver: zodResolver(schema),
    defaultValues: category
      ? {
          name: category.name,
          kind: category.kind,
          parent: category.parent,
          icon: iconOf(category.icon),
          color: hueOf(category.color, category.name),
        }
      : { name: '', kind: 'variable', parent: '', icon: '', color: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    // Removing the <option> resets what the browser shows but fires no change
    // event, so the form can still hold a parent deactivated meanwhile. What
    // the user sees — "Aucune" — is what gets saved.
    const parent = parents.some((one) => one.id === values.parent) ? values.parent : ''

    try {
      await onSave({ ...values, parent })
      reset(correcting ? { ...values, parent } : undefined)
      onSaved?.()
    } catch {
      // Surfaced through `failed` above.
    }
  })

  const parentOptions = [
    { value: '', label: 'Aucune (catégorie principale)' },
    ...parents.map((one) => ({ value: one.id, label: one.name })),
  ]

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
      {failed ? (
        <FormError
          message={
            correcting
              ? 'La modification a échoué. Vérifiez votre connexion et réessayez.'
              : 'La création de la catégorie a échoué. Vérifiez votre connexion et réessayez.'
          }
        />
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
        hint={correcting ? undefined : `Sans choix, l'étiquette neutre ${FALLBACK_ICON}.`}
        options={ICONS.map((icon) => ({
          value: icon,
          label: icon,
          swatch: <span className="text-xl">{icon}</span>,
        }))}
        {...register('icon')}
      />
      <HueGrid {...register('color')} />
      <SubmitButton pending={formState.isSubmitting}>
        {correcting ? 'Enregistrer les modifications' : 'Créer la catégorie'}
      </SubmitButton>
    </form>
  )
}
