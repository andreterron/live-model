# @live-model/explorer

Reusable Live Model Explorer pages and React Router Framework Mode adapters.

## Configure Live Model

The host application must configure the `live-model` client before rendering
any Explorer page.

To use the default client, configure it in the host application's client entry
or root module:

```ts
import { configureLiveModel } from 'live-model';

configureLiveModel({
  websocketUrl: 'ws://localhost:3001/',
});
```

Alternatively, create an explicit client and wrap the part of the application
that contains the Explorer routes:

```tsx
import { LiveModelClient, LiveModelClientProvider } from 'live-model';

const client = new LiveModelClient({
  websocketUrl: 'ws://localhost:3001/',
});

export function App({ children }: { children: React.ReactNode }) {
  return <LiveModelClientProvider client={client}>{children}</LiveModelClientProvider>;
}
```

Import the compiled stylesheet once in the host application's root module:

```ts
import '@live-model/explorer/styles.css';
```

## Page components

The base API lets the host own its route modules. Navigation is relative, so no
base-path prop or provider is required.

```tsx
import { ExplorerEntryPage, ExplorerIndexPage, ExplorerLayout } from '@live-model/explorer';
```

`ExplorerEntryPage` requires an `entryId` prop. The other components infer their
Live Model client and routing context.

For example, a React Router Framework Mode application can render the components
from local route modules.

`app/routes/explore.tsx`:

```tsx
import { ExplorerLayout } from '@live-model/explorer';
import { Outlet } from 'react-router';

export default function ExploreLayoutRoute() {
  return (
    <ExplorerLayout>
      <Outlet />
    </ExplorerLayout>
  );
}
```

`app/routes/explore._index.tsx`:

```tsx
import { ExplorerIndexPage } from '@live-model/explorer';

export default function ExploreIndexRoute() {
  return <ExplorerIndexPage />;
}
```

`app/routes/explore.entry.$id.tsx`:

```tsx
import { ExplorerEntryPage } from '@live-model/explorer';
import { useParams } from 'react-router';

export default function ExploreEntryRoute() {
  const { id = '' } = useParams();
  return <ExplorerEntryPage entryId={id} />;
}
```

## Thin route adapters

Hosts that want local route files can re-export the packaged route modules:

`app/routes/explore._index.tsx`:

```ts
export { ExplorerIndexRoute as default } from '@live-model/explorer';
```

`app/routes/explore.entry.$id.tsx`:

```ts
export { ExplorerEntryRoute as default } from '@live-model/explorer';
```

`app/routes/explore.tsx`:

```ts
export { explorerClientLoader as clientLoader, ExplorerHydrateFallback as HydrateFallback, ExplorerLayoutRoute as default } from '@live-model/explorer';

// Local route exports override or extend the packaged route module.
export function meta() {
  return [{ title: 'My Data Explorer' }, { name: 'description', content: 'Browse data stored by this application.' }];
}
```

The host still declares the route tree in `app/routes.ts`:

```ts
import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [route('explore', 'routes/explore.tsx', [index('routes/explore._index.tsx'), route('entry/:id', 'routes/explore.entry.$id.tsx')])] satisfies RouteConfig;
```

Loaders, actions, error boundaries, and other route-module exports can be added
to the local adapter files in the same way as the custom `meta` export above.

## Route config factory

React Router Framework Mode hosts can import the complete route tree:

```ts
import { explorerRoutes } from '@live-model/explorer/react-router';
import type { RouteConfig } from '@react-router/dev/routes';

export default [...explorerRoutes({ basePath: 'explore' })] satisfies RouteConfig;
```

Omit `basePath` to mount Explorer at the parent route's path. React Router skips
host type generation for route modules outside the host app directory, so these
modules are typechecked and built by this package instead.
