import { type ReactNode, useEffect, useId, useRef } from 'react'
import { SECONDARY_BUTTON_CLASS } from './secondary-button.ts'

/**
 * A modal sheet on a native `<dialog>`. The platform already gives the focus
 * trap, the Escape key, the inert background and the top layer — hand-rolling
 * those is where accessible modals usually go wrong, and none of it is worth a
 * dependency.
 *
 * The children are mounted only while it is open. A form left in the closed
 * dialog would still be in the document, so its fields would answer to a query
 * for a label the visible page also carries.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current

    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Escape and the backdrop close the dialog on their own; this is what
      // tells React the state it holds is now out of date.
      onClose={onClose}
      className="mt-auto mr-auto mb-0 ml-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-card bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-ink backdrop:bg-scrim sm:my-auto sm:rounded-card sm:pb-4"
    >
      {open ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <button type="button" onClick={onClose} className={SECONDARY_BUTTON_CLASS}>
              Fermer
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  )
}
