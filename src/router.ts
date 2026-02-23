import {
  createRootRoute,
  createRoute,
  createRouter,
  createHashHistory,
  lazyRouteComponent,
} from '@tanstack/react-router';

// Root route — layout loaded from routes/__root.tsx
const rootRoute = createRootRoute({
  component: lazyRouteComponent(() => import('./routes/__root'), 'RootLayout'),
});

// Single child route — configurator is the entire app
const configuratorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: lazyRouteComponent(
    () => import('./routes/configurator'),
    'ConfiguratorRoute',
  ),
});

// Build route tree
const routeTree = rootRoute.addChildren([configuratorRoute]);

// Hash history for client-side routing without server config
const hashHistory = createHashHistory();

// Create and export the router instance
export const router = createRouter({
  routeTree,
  history: hashHistory,
});

// Type-safe navigation declaration
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
