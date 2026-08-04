import { Outlet } from 'react-router';

import type { Route } from './+types/debugger';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Message debugger · Live Model' },
    {
      name: 'description',
      content: 'Explore Live Model messages between two in-memory machines.',
    },
  ];
}

export default function DebuggerLayout() {
  return <Outlet />;
}
