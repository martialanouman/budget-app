import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { installTheme } from './lib/theme.ts'
import './styles.css'

// Before the first render, not in an effect: a stored theme applied after
// mount shows one frame of the other one.
installTheme()

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root is missing from index.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
