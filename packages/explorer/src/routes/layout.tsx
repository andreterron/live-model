import { Outlet } from 'react-router';

import { ExplorerLayout } from '../explorer-layout.js';

export async function clientLoader() {
  return null;
}

clientLoader.hydrate = true as const;

export function HydrateFallback() {
  return null;
}

export function meta() {
  return [
    { title: 'Live Model Explorer' },
    { name: 'description', content: 'Browse and manage Live Model data.' },
  ];
}

export default function ExplorerLayoutRoute() {
  return (
    <ExplorerLayout>
      <Outlet />
    </ExplorerLayout>
  );
}
