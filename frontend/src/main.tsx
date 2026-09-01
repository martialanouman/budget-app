import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { installTheme } from './lib/theme.ts'
import './styles.css'

// The second of two applications, and the one that matters for the rest of the
// session: it also starts following theme changes made in other tabs. The first
// is the blocking snippet in index.html, which is what actually beats the first
// paint — this module is deferred behind the bundle and cannot.
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
