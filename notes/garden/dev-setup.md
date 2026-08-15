# Developer setup

Status: current development-server decisions, 2026-08-15.

## `optimizeDeps.noDiscovery`

The website originally set `optimizeDeps.noDiscovery` to `true` and explicitly
included the React runtime entries. This was added for long-lived browser tabs
accessed through the Terron AI tunnel. Visiting a route with a dependency Vite
had not seen yet caused dependency re-optimization and changed Vite's browser
hash. When the tunneled tab missed the corresponding full reload, React hooks
and React DOM could remain loaded from different optimizer generations, causing
invalid hook calls and leaving stale debugger instances alive.

`noDiscovery` prevented that route-driven optimizer change, but it also meant
that ESM packages outside `optimizeDeps.include` were served directly. This was
especially costly for `lucide-react`: importing named icons through its barrel
module exposed the browser to the package's complete icon export graph. The same
behavior could make other packages with large ESM barrels expensive in
development.

The setting was removed after the tunnel's HMR handling was fixed and the
website was changed to scan all possible route entry points up front. React and
React DOM remain explicitly included and deduplicated. Lucide imports also use
individual ESM icon modules, so only icons used by the application are
optimized and served.

## `optimizeDeps.entries`

The website now sets `optimizeDeps.entries` to cover:

- The application root.
- Every website route.
- Website components that routes can load.
- The linked Explorer package's TypeScript source, excluding tests.

Vite scans these files before serving the initial page. As a result, navigating
to `/explore`, `/debugger`, or another existing route should not discover a new
dependency and create a new optimizer generation. Unlike `noDiscovery`, normal
dependency optimization remains enabled, so large or CommonJS dependencies can
still be pre-bundled.

When adding a new source area that can introduce browser dependencies but is
not reachable from the existing entry patterns, update the entries in
`apps/website/vite.config.ts`. Keep test files excluded so test-only packages do
not enter the browser dependency cache.

