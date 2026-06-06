import { Outlet } from 'react-router';

export default function ExploreLayout() {
  return (
    <div className="min-h-screen p-8">
      <Outlet />
    </div>
  );
}
