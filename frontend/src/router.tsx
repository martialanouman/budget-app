import {
  Outlet,
  RouterProvider,
  type RouterHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { AccountsPage } from '@/accounts/accounts-page.tsx'
import { BudgetsPage } from '@/budgets/budgets-page.tsx'
import { DebtDetailPage } from '@/debts/debt-detail-page.tsx'
import { DebtsPage } from '@/debts/debts-page.tsx'
import { ForgotPasswordPage } from '@/auth/forgot-password-page.tsx'
import { ResetPasswordPage } from '@/auth/reset-password-page.tsx'
import { ConfirmEmailChangePage } from '@/auth/confirm-email-change-page.tsx'
import { SignInPage } from '@/auth/sign-in-page.tsx'
import { SignUpPage } from '@/auth/sign-up-page.tsx'
import { CategoriesPage } from '@/categories/categories-page.tsx'
import { ProfilePage } from '@/profile/profile-page.tsx'
import { NotFoundPage } from '@/components/not-found-page'
import { TransactionsPage } from '@/transactions/transactions-page.tsx'
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

// Public, and it has to be: the link is opened from the NEW address, quite
// possibly in a browser that has never carried a session for this account.
const confirmEmailChangeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/confirm-email-change',
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search['token'] === 'string' ? search['token'] : '',
  }),
  beforeLoad: ({ search }) => {
    if (!search.token) {
      throw redirect({ to: '/sign-in' })
    }
  },
  component: function ConfirmEmailChange() {
    const { token } = confirmEmailChangeRoute.useSearch()

    return <ConfirmEmailChangePage token={token} />
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

const budgetsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/budgets',
  component: BudgetsPage,
})

const debtsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/debts',
  component: DebtsPage,
})

const debtDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/debts/$debtId',
  component: function DebtDetail() {
    const { debtId } = debtDetailRoute.useParams()

    return <DebtDetailPage debtId={debtId} />
  },
})

const categoriesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/categories',
  component: CategoriesPage,
})

const profileRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/profile',
  component: ProfilePage,
})

const transactionsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/transactions',
  component: TransactionsPage,
})

const routeTree = rootRoute.addChildren([
  signInRoute,
  signUpRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  confirmEmailChangeRoute,
  protectedRoute.addChildren([
    homeRoute,
    transactionsRoute,
    profileRoute,
    budgetsRoute,
    debtsRoute,
    debtDetailRoute,
    accountsRoute,
    categoriesRoute,
  ]),
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
export function AppRouterProvider({
  router,
  client,
}: {
  router: AppRouter
  /** Injectable so journeys can assert on the cache itself. */
  client?: QueryClient
}) {
  // One client per provider, so journeys never share cached data between tests.
  const [fallback] = useState(createQueryClient)
  const queryClient = client ?? fallback

  // The provider never unmounts, so the cache would otherwise outlive the user
  // and show a second account the first one's data. Purged on identity change
  // only: onChange also fires on token refreshes and cross-tab storage events,
  // and blanking a working screen for those would be noise.
  useEffect(() => {
    let signedInAs = pb.authStore.record?.id

    return pb.authStore.onChange(() => {
      const nowSignedInAs = pb.authStore.record?.id

      if (nowSignedInAs !== signedInAs) {
        signedInAs = nowSignedInAs
        queryClient.clear()
      }

      void router.invalidate()
    })
  }, [queryClient, router])

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
