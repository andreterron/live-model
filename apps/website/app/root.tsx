import {
  isRouteErrorResponse,
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router';
import { configureLiveModel } from 'live-model';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

import type { Route } from './+types/root';
import './app.css';
import { ThemeProvider } from './components/theme-provider';

const websocketUrl =
  typeof window === 'undefined'
    ? 'ws://127.0.0.1:3001/'
    : (() => {
        const url = new URL(window.location.href);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        if (url.port) url.port = '3001';
        url.pathname = '/';
        url.search = '';
        url.hash = '';
        return url;
      })();

configureLiveModel({
  websocketUrl,
});

export const links: Route.LinksFunction = () => [];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      {/* suppressHydrationWarning because of CollorZilla extension */}
      <body suppressHydrationWarning>
        <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
          {children}
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <NavLink
            to="/"
            className="font-semibold tracking-tight"
            onClick={() => setMobileNavigationOpen(false)}
          >
            Live Model
          </NavLink>
          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Primary navigation"
          >
            <TopNavLink to="/" end>
              State
            </TopNavLink>
            <TopNavLink to="/explore">Explorer</TopNavLink>
            <TopNavLink to="/debugger">Message debugger</TopNavLink>
          </nav>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
            aria-controls="mobile-navigation"
            aria-expanded={mobileNavigationOpen}
            aria-label={
              mobileNavigationOpen ? 'Close navigation' : 'Open navigation'
            }
            onClick={() => setMobileNavigationOpen((open) => !open)}
          >
            {mobileNavigationOpen ? <X /> : <Menu />}
          </button>
        </div>
        {mobileNavigationOpen && (
          <nav
            id="mobile-navigation"
            className="border-t px-4 py-3 md:hidden"
            aria-label="Mobile navigation"
          >
            <div className="mx-auto grid max-w-7xl gap-1">
              <TopNavLink
                to="/"
                end
                mobile
                onClick={() => setMobileNavigationOpen(false)}
              >
                State
              </TopNavLink>
              <TopNavLink
                to="/explore"
                mobile
                onClick={() => setMobileNavigationOpen(false)}
              >
                Explorer
              </TopNavLink>
              <TopNavLink
                to="/debugger"
                mobile
                onClick={() => setMobileNavigationOpen(false)}
              >
                Message debugger
              </TopNavLink>
            </div>
          </nav>
        )}
      </header>
      <Outlet />
    </div>
  );
}

function TopNavLink({
  children,
  mobile = false,
  ...props
}: Omit<React.ComponentProps<typeof NavLink>, 'className'> & {
  mobile?: boolean;
}) {
  return (
    <NavLink
      {...props}
      className={({ isActive }) =>
        `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          mobile ? 'block w-full' : ''
        } ${
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Oops!';
  let details = 'An unexpected error occurred.';
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details =
      error.status === 404
        ? 'The requested page could not be found.'
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
