import { formatAmount, parseAmount } from '@budget/domain'
import { Field } from './field.tsx'

/** 1, 2, 3 / 4, 5, 6 / 7, 8, 9 / 000, 0 — the erase key closes the last row. */
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0'] as const

/**
 * As far as the keypad will build: nine hundred and ninety-nine billion francs,
 * past any amount a household enters.
 *
 * It binds the keys and nothing else. A cap on what is typed would rewrite the
 * amount rather than refuse it — the very thing `tidy` exists to prevent — and
 * it would buy nothing: the input keeps its width and scrolls its own text
 * (measured: neither the field nor the sheet grows), and `toMoney` already
 * refuses anything past the exact-integer range.
 */
const MAX_DIGITS = 12

/**
 * Tidies a whole number of francs and leaves anything else exactly as typed.
 *
 * Stripping the stray characters instead was measured against the suite and is
 * wrong by a factor of a hundred: "1500,75" loses its comma and becomes 150 075
 * francs, silently, in the field the entry is decided on. The franc has no
 * subunit, so there is no right amount to guess at — the schema refuses it and
 * says so, which is what it did before the keypad existed.
 */
const tidy = (value: string) =>
  /^\d*$/u.test(value)
    ? // "05" is worth five francs and reads like a mistake. Leading zeros go,
      // except the lone one of an amount just started.
      value.replace(/^0+(?=\d)/u, '')
    : value

/** A key press, which does nothing at all once the amount is as long as the keypad builds. */
const pressed = (value: string, key: string) => {
  const next = tidy(value + key)

  return next.length > MAX_DIGITS ? value : next
}

const KEY_CLASS =
  'min-h-12 rounded-field border border-line-strong bg-surface text-lg tabular-nums text-ink outline-none active:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent/40'

/** What the status line says. An amount the schema will refuse still has to be readable. */
function announce(value: string): string {
  if (!value) return 'Aucun montant'

  try {
    return formatAmount(parseAmount(value))
  } catch {
    return 'Montant non valide'
  }
}

/**
 * An amount in francs, typed on a keypad the application draws (TRX-09).
 *
 * The franc has no subunit, and a phone's numeric keyboard offers a decimal key
 * regardless. So the system keyboard is suppressed with `inputmode="none"`
 * rather than by making the field read-only, and that distinction is the
 * requirement's "jamais la seule voie": the control stays an ordinary input, so
 * a physical keyboard types into it and assistive technology edits it. The keys
 * are ordinary buttons for the same reason — reachable by tab, and by a screen
 * reader's own navigation.
 *
 * The value it carries is bare digits. Grouping them inside the input would put
 * a separator between the caret and the digit behind it, where backspace
 * appears to do nothing; the grouped, currency-formatted figure lives in the
 * status line instead, which is also where it is announced.
 *
 * The keypad stands rather than folding away with the focus, and folding would
 * genuinely have bought room: it is 218px of the 806 the sheet holds against a
 * 760px window, so a keypad that closed when the category took focus would have
 * left no scrolling at all. Two things cost more than that scroll.
 *
 * It would have to be opened by focusing the field, and nothing focuses it:
 * measured, `showModal()` gives focus to the sheet's own "Fermer" button, and
 * React renders no `autofocus` attribute for the dialog to prefer. So the
 * amount would wait behind a tap on a control that looks like an ordinary
 * field.
 *
 * And it would fold while the category's native picker is open — a system
 * overlay that hides the page moving 218px underneath it. A jump under the
 * thumb costs a mis-tap; a scroll is a gesture someone chose to make.
 *
 * It takes no ref, so react-hook-form cannot move focus here when the amount is
 * refused: the compiler's rule against reading a ref during render rejects the
 * library's callback ref, and it flags the `value` and `onChange` beside it as
 * well. The refusal is announced by the error's own `role="alert"`.
 */
export function AmountField({
  label,
  value,
  onChange,
  error,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string | undefined
}) {
  const spoken = announce(value)

  return (
    <Field label={label} error={error}>
      {(wiring) => (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-field border border-line-strong bg-surface px-3 py-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30 has-aria-invalid:border-danger">
            <input
              {...wiring}
              value={value}
              onChange={(event) => onChange(tidy(event.target.value))}
              // Not a hint about which keyboard to open, but an instruction to
              // open none: this field brings its own.
              inputMode="none"
              className="min-h-11 w-full min-w-0 flex-1 bg-transparent text-2xl tabular-nums text-ink outline-none"
            />
            {/* The status line says the currency out loud already. */}
            <span aria-hidden="true" className="shrink-0 text-sm text-muted">
              F CFA
            </span>
          </div>

          {/* Pressing a key moves focus to the key, so a screen reader hears
              "2" and nothing of the total. This is the only thing that says
              what has been typed so far. */}
          <p role="status" className="text-sm tabular-nums text-muted">
            {spoken}
          </p>

          <div role="group" aria-label="Pavé numérique" className="grid grid-cols-3 gap-1.5">
            {KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onChange(pressed(value, key))}
                className={KEY_CLASS}
              >
                {key}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onChange(tidy(value.slice(0, -1)))}
              aria-label="Effacer le dernier chiffre"
              className={KEY_CLASS}
            >
              <span aria-hidden="true">⌫</span>
            </button>
          </div>
        </div>
      )}
    </Field>
  )
}
