/**
 * What a category or an account looks like in a list: a colour, and for a
 * category an icon (CAT-04, CPT-02).
 *
 * Both are stored, both may be empty, and nothing back-filled the rows that
 * existed before the migration. So every read goes through here, and an absent
 * value is answered by one derived from the name rather than by a blank —
 * a colourless dot in a column of coloured ones reads as a defect, not as a
 * default.
 */
export const HUES = [
  'terracotta',
  'ambre',
  'olive',
  'vert',
  'sarcelle',
  'indigo',
  'prune',
  'framboise',
] as const

export type Hue = (typeof HUES)[number]

/**
 * Written out one by one because Tailwind reads the source as text: a class
 * built as `bg-hue-${key}` appears nowhere in the file, so nothing generates
 * it and the dot comes out transparent.
 */
const HUE_CLASS: Record<Hue, string> = {
  terracotta: 'bg-hue-terracotta',
  ambre: 'bg-hue-ambre',
  olive: 'bg-hue-olive',
  vert: 'bg-hue-vert',
  sarcelle: 'bg-hue-sarcelle',
  indigo: 'bg-hue-indigo',
  prune: 'bg-hue-prune',
  framboise: 'bg-hue-framboise',
}

export const HUE_LABELS: Record<Hue, string> = {
  terracotta: 'Terre cuite',
  ambre: 'Ambre',
  olive: 'Olive',
  vert: 'Vert',
  sarcelle: 'Sarcelle',
  indigo: 'Indigo',
  prune: 'Prune',
  framboise: 'Framboise',
}

const isHue = (value: string): value is Hue => (HUES as readonly string[]).includes(value)

/**
 * The same name always gives the same hue, and two names rarely give the same
 * one. Stability is the point: a category whose colour moved between two
 * renders would be worse than one with no colour at all.
 *
 * Deliberately not a cryptographic hash — this decides a dot, and the sum of
 * the code points spreads eight ways well enough.
 */
export function hueFor(name: string): Hue {
  let sum = 0

  for (const character of name.trim().toLowerCase()) sum += character.codePointAt(0) ?? 0

  return HUES[sum % HUES.length] as Hue
}

export const hueClassOf = (stored: string | undefined, name: string): string =>
  HUE_CLASS[stored && isHue(stored) ? stored : hueFor(name)]

/**
 * A restricted grid rather than a free emoji field. An arbitrary character can
 * be an unrendered box on one platform and three columns wide on another, and
 * a field that accepts anything has to be validated for something.
 */
export const ICONS = [
  '🏠',
  '🔁',
  '🎓',
  '🏦',
  '💰',
  '🍚',
  '🚕',
  '💊',
  '👪',
  '🎬',
  '🧴',
  '📱',
  '👕',
  '🎁',
  '✈️',
  '⚽',
  '🐶',
  '🔧',
  '💼',
  '🍺',
  '☕',
  '📚',
  '💡',
  '🏷️',
] as const

/** What a category with no icon of its own shows: neutral, never a guess. */
export const FALLBACK_ICON = '🏷️'

export const iconOf = (stored: string | undefined): string =>
  stored && (ICONS as readonly string[]).includes(stored) ? stored : FALLBACK_ICON
