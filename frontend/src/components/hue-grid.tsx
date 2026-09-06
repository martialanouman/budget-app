import { type InputHTMLAttributes } from 'react'
import { HUES, HUE_LABELS, hueClass } from '@/lib/appearance'
import { ChoiceGrid } from './choice-grid.tsx'

/**
 * The eight hues a category or an account may be given, and the way back out of
 * them (CAT-04, CPT-02).
 *
 * "Aucune" is the ninth option and it is what makes the choice reversible: the
 * grid held the eight and nothing else, so the derived colour became
 * unreachable the moment anything was picked — a one-way door that only became
 * visible once a row could be corrected at all.
 *
 * It is also the checked option when a row is being created, and that is the
 * same decision as before rather than a reversal of it: what must never be
 * pre-selected is a *hue*, which would paint every new row alike. Saying "no
 * colour, derived from the name" out loud is what the hint used to say beside
 * an empty grid, and an option carries it better than a sentence a screen
 * reader only meets by walking past it.
 *
 * Written once because the two forms that show it were word-for-word twins, and
 * the ninth option would have had to be added to both — the way `text-field`
 * and `select-field` drifted before `Field` was pulled out of them.
 */
export function HueGrid(
  radio: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'aria-label'>,
) {
  return (
    <ChoiceGrid
      legend="Couleur"
      // On the fieldset rather than in the option's own name, and not only for
      // room: a label is matched by substring everywhere it is queried, and
      // "dérivée du nom" made this radio answer to "Nom" — the label the two
      // forms carry, in ten journeys. A description is announced on entering
      // the group and collides with nothing.
      hint="Sans choix, la teinte est dérivée du nom."
      options={[
        {
          value: '',
          label: 'Aucune',
          // Dashed, so it reads as the absence of a colour rather than as a
          // ninth one. It is a swatch either way, so it holds the grid's shape.
          swatch: <span className="size-6 rounded-full border border-dashed border-line-strong" />,
        },
        ...HUES.map((hue) => ({
          value: hue,
          label: HUE_LABELS[hue],
          swatch: <span className={`size-6 rounded-full ${hueClass(hue)}`} />,
        })),
      ]}
      {...radio}
    />
  )
}
