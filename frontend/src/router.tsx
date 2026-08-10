import {
  Outlet,
  type RouterHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import { ForgotPasswordPage } from '@/auth/forgot-password-page.tsx'
import { ResetPasswordPage } from '@/auth/reset-password-page.tsx'
import { SignInPage } from '@/auth/sign-in-page.tsx'
import { SignUpPage } from '@/auth/sign-up-page.tsx'
import { HomePage } from '@/home/home-page.tsx'
import { pb } from '@/lib/pocketbase'

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

const routeTree = rootRoute.addChildren([
  signInRoute,
  signUpRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  protectedRoute.addChildren([homeRoute]),
])

export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, ...(history ? { history } : {}) })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
