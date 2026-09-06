import { useId } from 'react'
import {
  THEME_PREFERENCES,
  type ThemePreference,
  setThemePreference,
  useThemePreference,
} from '@/lib/theme.ts'
import { SettingsSection } from './settings-section.tsx'

const LABELS: Record<ThemePreference, string> = {
  system: 'Système',
  light: 'Clair',
  dark: 'Sombre',
}

/**
 * USR-10, the half that had no way in.
 *
 * `lib/theme.ts` reads the stored choice before React paints, writes the root
 * attribute, repaints the browser chrome and follows the other tabs — all of it
 * built and covered by `theme.journey.ts`. Nothing called `setThemePreference`.
 * So the requirement's "un réglage explicite la remplace" was unreachable, and
 * with it the entire `[data-theme]` half of the palette, which no product path
 * could ever put on the page.
 *
 * Native radios rather than buttons, for the reason `ChoiceGrid` gives: a radio
 * group already answers the arrow keys and already tells a screen reader how
 * many options there are and which one is current. The input covers its whole
 * pill instead of being clipped into a corner of it — the tap target is then
 * the box the eye follows.
 *
 * Written straight to the store on change, with no Enregistrer: the page
 * repaints under the click, so the confirmation is the result itself. A button
 * would be asking someone to confirm something they can already see.
 *
 * Kept on the device rather than on the account, and it has to be: the palette
 * has to be right on the sign-in screen, where there is no session to read a
 * preference from. USR-10 asks that the choice survive from one session to the
 * next, which `localStorage` answers; a second device starts from its own
 * system setting, which is the answer someone who set their phone to dark at
 * night has already given.
 */
export function ThemeSection() {
  const preference = useThemePreference()
  const name = useId()
  const hintId = useId()

  return (
    <SettingsSection title="Apparence">
      <fieldset aria-describedby={hintId} className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium text-ink">Thème</legend>
        <p id={hintId} className="text-sm text-muted">
          « Système » suit le réglage de votre appareil.
        </p>
        <div className="flex gap-2">
          {THEME_PREFERENCES.map((option) => (
            <label
              key={option}
              className="relative flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-field border border-line-strong bg-surface px-3 text-sm text-ink has-checked:border-accent has-checked:bg-accent-soft has-checked:font-medium has-focus-visible:ring-2 has-focus-visible:ring-accent/40"
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={preference === option}
                onChange={() => setThemePreference(option)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              {LABELS[option]}
            </label>
          ))}
        </div>
      </fieldset>
    </SettingsSection>
  )
}
