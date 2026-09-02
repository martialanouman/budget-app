import { expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { WIDE_SCREEN, useMediaQuery } from './media-query.ts'

/**
 * A journey rather than a domain scenario, for the same reason as the theme
 * module: `matchMedia` and a real window are the subject, and neither exists
 * under node.
 *
 * It is tested here rather than through the shell, and that is a correction
 * rather than a preference. The first version of this test resized the window
 * with the whole application mounted and watched the rail appear — and removing
 * the subscription entirely left it green. Measured: the resize does not remount
 * the app, but it does make a query refetch, the route component re-renders, the
 * shell re-renders with it, and `useSyncExternalStore` re-reads the snapshot on
 * the way down. The width was right for a reason that had nothing to do with the
 * subscription, which is the only thing this hook adds over reading the width
 * once.
 *
 * Nothing else re-renders this probe. If the subscription does not notify, the
 * text does not change.
 */
function Probe() {
  return <p>{useMediaQuery(WIDE_SCREEN) ? 'large' : 'étroit'}</p>
}

it('follows the window across the breakpoint, with nothing else to re-render it', async () => {
  await page.viewport(414, 896)

  const screen = await render(<Probe />)

  await expect.element(screen.getByText('étroit')).toBeVisible()

  try {
    await page.viewport(1280, 900)
    await expect.element(screen.getByText('large')).toBeVisible()

    await page.viewport(414, 896)
    await expect.element(screen.getByText('étroit')).toBeVisible()
  } finally {
    await page.viewport(414, 896)
  }
})
