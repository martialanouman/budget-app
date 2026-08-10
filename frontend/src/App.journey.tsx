import { expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { App } from './App.tsx'

it('renders the application shell', async () => {
  const screen = await render(<App />)

  await expect.element(screen.getByRole('heading', { level: 1 })).toBeVisible()
})
