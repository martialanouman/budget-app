/**
 * The shape of a full-width primary button: the one every form ends with, and
 * the one that closes an account.
 *
 * They were two hand-written copies differing only in their colour, and they
 * had already drifted three ways — 6px corners against a pill, medium against
 * semibold, and a disabled state at 50% against 60% — so the most dangerous
 * button of the application was also the only one shaped unlike the rest.
 *
 * A constant rather than a component, like `SECONDARY_BUTTON_CLASS` beside it:
 * one caller is a submit button that owns a pending state, the other a plain
 * button with an onClick, and folding them into one would mean inventing props
 * to tell them apart. The colour is what a caller adds, and it is meant to
 * differ — it is the only thing that says which of the two this is.
 */
export const PRIMARY_BUTTON_CLASS =
  'min-h-11 w-full rounded-full px-4 py-2.5 text-base font-semibold text-on-accent outline-none focus-visible:ring-2 disabled:opacity-60'
