import { AppRouterProvider, createAppRouter } from './router.tsx'

const router = createAppRouter()

export function App() {
  return <AppRouterProvider router={router} />
}
