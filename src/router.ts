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

// Child routes — each lazy-loaded for code splitting
const configuratorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: lazyRouteComponent(
    () => import('./routes/configurator'),
    'ConfiguratorRoute',
  ),
});

const catalogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/catalog',
  component: lazyRouteComponent(
    () => import('./routes/catalog'),
    'CatalogRoute',
  ),
});

const wizardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wizard',
  component: lazyRouteComponent(
    () => import('./routes/wizard'),
    'WizardRoute',
  ),
});

// Build route tree
const routeTree = rootRoute.addChildren([
  configuratorRoute,
  catalogRoute,
  wizardRoute,
]);

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
