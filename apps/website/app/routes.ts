import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('explore', 'routes/explore.tsx', [
    index('routes/explore._index.tsx'),
    route('entry/:id', 'routes/explore.entry.$id.tsx'),
  ]),
  route('debugger', 'routes/debugger.tsx', [
    index('routes/debugger._index.tsx'),
    route('v1', 'routes/debugger.v1.tsx'),
  ]),
  route(
    '.well-known/appspecific/com.chrome.devtools.json',
    'routes/not-found.tsx'
  ),
] satisfies RouteConfig;
