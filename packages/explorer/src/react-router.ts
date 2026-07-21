import { fileURLToPath } from 'node:url';

export interface ExplorerRoutesOptions {
  /** Mount path relative to the parent route. Omit it for a pathless layout. */
  basePath?: string;
}

export interface ExplorerRouteConfigEntry {
  id?: string;
  file: string;
  path?: string;
  index?: boolean;
  children?: ExplorerRouteConfigEntry[];
}

// Keep these URLs static so Vite preserves them as package-relative files
// instead of treating a template literal as an asset glob.
const layoutRouteFile = fileURLToPath(
  new URL(/* @vite-ignore */ './route-layout.js', import.meta.url)
);
const indexRouteFile = fileURLToPath(
  new URL(/* @vite-ignore */ './route-index.js', import.meta.url)
);
const entryRouteFile = fileURLToPath(
  new URL(/* @vite-ignore */ './route-entry.js', import.meta.url)
);

/**
 * Returns React Router Framework Mode route config backed by this package's
 * published route modules. React Router intentionally leaves external route
 * modules out of the host application's generated route types.
 */
export function explorerRoutes(
  options: ExplorerRoutesOptions = {}
): ExplorerRouteConfigEntry[] {
  return [
    {
      id: 'live-model-explorer/layout',
      ...(options.basePath ? { path: options.basePath } : {}),
      file: layoutRouteFile,
      children: [
        {
          id: 'live-model-explorer/index',
          index: true,
          file: indexRouteFile,
        },
        {
          id: 'live-model-explorer/entry',
          path: 'entry/:id',
          file: entryRouteFile,
        },
      ],
    },
  ];
}
