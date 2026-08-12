import {
  Outlet,
  RouterProvider,
  type RouterHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { AccountsPage } from '@/accounts/accounts-page.tsx'
import { ForgotPasswordPage } from '@/auth/forgot-password-page.tsx'
import { ResetPasswordPage } from '@/auth/reset-password-page.tsx'
import { SignInPage } from '@/auth/sign-in-page.tsx'
import { SignUpPage } from '@/auth/sign-up-page.tsx'
import { CategoriesPage } from '@/categories/categories-page.tsx'
import { NotFoundPage } from '@/components/not-found-page'
import { HomePage } from '@/home/home-page.tsx'
import { pb } from '@/lib/pocketbase'
import { createQueryClient } from '@/lib/query-client'

const rootRoute = createRootRoute({ component: () => <Outlet /> })

function redirectAuthenticatedUsers() {
  if (pb.authStore.isValid) {
    throw redirect({ to: '/' })
  }
}

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-in',
  beforeLoad: redirectAuthenticatedUsers,
  component: SignInPage,
})

const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-up',
  beforeLoad: redirectAuthenticatedUsers,
  component: SignUpPage,
})

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  component: ForgotPasswordPage,
})

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search['token'] === 'string' ? search['token'] : '',
  }),
  // A truncated link is a routing problem, not a form error: send the user back
  // to ask for a fresh one instead of letting them fill in a doomed form.
  beforeLoad: ({ search }) => {
    if (!search.token) {
      throw redirect({ to: '/forgot-password' })
    }
  },
  component: function ResetPassword() {
    const { token } = resetPasswordRoute.useSearch()

    return <ResetPasswordPage token={token} />
  },
})

const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'protected',
  beforeLoad: () => {
    if (!pb.authStore.isValid) {
      throw redirect({ to: '/sign-in' })
    }
  },
  component: () => <Outlet />,
})

const homeRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/',
  component: HomePage,
})

const accountsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/accounts',
  component: AccountsPage,
})

const categoriesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/categories',
  component: CategoriesPage,
})

const routeTree = rootRoute.addChildren([
  signInRoute,
  signUpRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  protectedRoute.addChildren([homeRoute, accountsRoute, categoriesRoute]),
])

export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    defaultNotFoundComponent: NotFoundPage,
    ...(history ? { history } : {}),
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

// beforeLoad only runs on navigation, so a session cleared elsewhere (another
// tab, an expired token) would otherwise leave the user sitting on a protected
// screen. Re-running the guards on every authStore change closes that gap.
export function AppRouterProvider({ router }: { router: AppRouter }) {
  // One client per provider, so journeys never share cached data between tests.
  const [queryClient] = useState(createQueryClient)

  useEffect(() => pb.authStore.onChange(() => void router.invalidate()), [router])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter
  }
}
