import { type RouteConfig, index, route } from '@react-router/dev/routes';
import { Route } from 'react-router';

export default [
  index('routes/home.tsx'),
  route(
    '.well-known/appspecific/com.chrome.devtools.json',
    'routes/not-found.tsx'
  ),
] satisfies RouteConfig;
