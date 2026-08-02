'use client';

/**
 * Client provider tree + authenticated app shell, ported from the Vite app's
 * App.tsx (Allyvatemarketingos apps/web/src/app/App.tsx). Routing moved to the
 * Next.js app router, so the shell wraps page children instead of <AppRoutes>.
 */
import { Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@martechos/ui';
import {
  Palette,
  LibraryBig,
  Phone,
  LayoutPanelLeft,
  Megaphone,
  Mail,
  FileText,
  BarChart3,
  Folder,
  Plug,
} from 'lucide-react';
import '../i18n';
import { AuthProvider, useAuth } from '../components/Providers/AuthContext';
import { SignupOnboardingProvider } from '../components/Providers/SignupOnboardingContext';
import { ToastProvider } from '../components/Providers/ToastContext';
import { ApiClientGlobalHandlers } from '../components/ApiClientGlobalHandlers';
import { ErrorBoundary } from '../components/ErrorBoundary/ErrorBoundary';
import { WorkspaceSetupController } from '../components/WorkspaceSetup';
import { WorkspaceSwitcherDropdown } from '../components/WorkspaceSwitcher';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { useWorkspaces } from '../hooks/useWorkspaces';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/** Routes that render without an authenticated session (login, callbacks, signup). */
function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/signin' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/signup')
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common');
  const { isAuthenticated, authReady, workspaceId, userId, logout, roles } = useAuth();
  const { data: workspaces } = useWorkspaces();
  const router = useRouter();
  const pathname = usePathname() ?? '/';

  const sidebarItems = useMemo(
    () => [
      { id: 'brand-center', label: t('nav.brandCenter'), icon: Palette, route: '/brand-center' },
      { id: 'library', label: 'Content Engine', icon: LibraryBig, route: '/library' },
      { id: 'calls', label: 'Calls', icon: Phone, route: '/calls' },
      {
        id: 'studio',
        label: 'Creative Studio',
        icon: LayoutPanelLeft,
        route: '/studio/ads',
        // Icons mirror the studio's own mode rail so the sub-items stay
        // recognisable once the nav collapses to icons only.
        children: [
          { id: 'studio-ads', label: 'Ads', route: '/studio/ads', icon: Megaphone },
          { id: 'studio-email', label: 'Email', route: '/studio/email', icon: Mail },
          { id: 'studio-landing-pages', label: 'Landing pages', route: '/studio/landing-pages', icon: FileText },
          { id: 'studio-case-studies', label: 'Case studies', route: '/studio/case-studies', icon: BarChart3 },
          { id: 'studio-assets', label: 'Assets', route: '/studio/assets', icon: Folder },
          { id: 'studio-connections', label: 'Connections', route: '/studio/connections', icon: Plug },
        ],
      },
    ],
    [t]
  );
  const activeItemId = pathname.startsWith('/library')
    ? 'library'
    : pathname.startsWith('/calls')
      ? 'calls'
      : pathname.startsWith('/studio/')
        ? `studio-${pathname.split('/')[2] ?? 'ads'}`
        : pathname.startsWith('/studio')
          ? 'studio-ads'
          : 'brand-center';

  // Clear the React Query cache whenever the logged-in user changes so that
  // user A's cached data is never shown to user B.
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
      queryClient.clear();
    }
    prevUserIdRef.current = userId;
  }, [userId]);

  if (isPublicPath(pathname)) {
    return <>{children}</>;
  }

  if (!authReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <p className="text-[#666]">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Unauthenticated: show the login screen in place (URL is preserved, so after
    // login the user lands on the page they originally requested).
    return <LoginScreen />;
  }

  const currentWorkspace = workspaces?.items.find((w) => w.id === workspaceId);
  const userName = userId || t('user');
  const environment = (currentWorkspace?.defaultEnv || 'sandbox') as 'sandbox' | 'prod';

  return (
    <div className="flex h-screen">
      <Sidebar
        items={sidebarItems}
        activeItemId={activeItemId}
        onItemClick={(item) => {
          router.push(item.route);
        }}
        user={{
          name: userName,
          subtitle: roles.length > 0 ? roles[0].charAt(0).toUpperCase() + roles[0].slice(1) : undefined,
          role: <WorkspaceSwitcherDropdown canCreateWorkspace={false} environment={environment} />,
        }}
        onLogout={logout}
        logoutLabel={t('sidebar.signOut')}
        appName={t('sidebar.appName')}
        navAriaLabel={t('sidebar.mainNavAria')}
        systemLabel={t('sidebar.system')}
      />
      <main className="flex-1 overflow-hidden">{children}</main>
      <WorkspaceSetupController />
    </div>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <ApiClientGlobalHandlers />
            <SignupOnboardingProvider>
              <Suspense
                fallback={
                  <div className="flex h-screen items-center justify-center bg-white">
                    <p className="text-[#666]">Loading…</p>
                  </div>
                }
              >
                <AppShell>{children}</AppShell>
              </Suspense>
            </SignupOnboardingProvider>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
