import { ToggleSample } from '../components/samples/01-toggle';
import { DerivedSample } from '../components/samples/02-derived';
import type { Route } from './+types/home';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Live Model' },
    { name: 'description', content: 'Welcome to Live Model!' },
  ];
}

export function clientLoader({}: Route.ClientLoaderArgs) {
  return {};
}

export default function Home() {
  return (
    <div className="min-h-screen p-8">
      <div className="prose mb-4">
        <h1 className="text-2xl font-bold mb-4">Live Model</h1>
        <h2 className="text-lg font-semibold mb-2">1. One "bit"</h2>
        <p>
          Go ahead, toggle it! The value is persisted between page refreshes.
        </p>
      </div>
      <ToggleSample />
      <div className="prose mb-4 mt-10">
        <h2 className="text-lg font-semibold mb-2">2. Derived "bit"</h2>
      </div>
      <DerivedSample />
    </div>
  );
}
