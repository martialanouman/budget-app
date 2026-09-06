/**
 * The pill a screen uses for everything that is not its main action: archive,
 * deactivate, delete, correct, load more, close.
 *
 * Written out thirteen times before this, once per site, and it had already
 * drifted — the same button was `rounded-md` in every list row and
 * `rounded-full` on the sheet that opens over them, so pressing "Modifier"
 * changed the shape of the button under the thumb. A constant rather than a
 * component, like `CONTROL_CLASS` beside it: two of these sites are links, not
 * buttons, and a wrapper would have had to be duplicated to serve both.
 *
 * `min-h-11` is the 44px touch target the rest of the interface holds to.
 * Callers append what is theirs alone — `w-full`, `disabled:opacity-60`, an
 * `aria-pressed` treatment — and nothing else.
 */
export const SECONDARY_BUTTON_CLASS =
  'min-h-11 shrink-0 rounded-full border border-line-strong px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/40'
