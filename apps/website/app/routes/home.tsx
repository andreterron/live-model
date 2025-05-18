import { ToggleSample } from '../components/samples/01-toggle';
import { DerivedSample } from '../components/samples/02-derived';
import { ReactivitySample } from '../components/samples/03-reactivity';
import { CollectionsSample } from '../components/samples/04-collections';
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
        <h2 className="text-lg font-semibold mb-2">1. Boolean state</h2>
        <p>
          Go ahead, toggle it! The value is persisted between page refreshes.
        </p>
      </div>
      <ToggleSample />
      <div className="prose mb-4 mt-10">
        <h2 className="text-lg font-semibold mb-2">2. Derived state</h2>
      </div>
      <DerivedSample />
      <div className="prose mb-4 mt-10">
        <h2 className="text-lg font-semibold mb-2">3. Reactivity</h2>
      </div>
      <ReactivitySample />
      <div className="prose mb-4 mt-10">
        <h2 className="text-lg font-semibold mb-2">4. Collections</h2>
      </div>
      <CollectionsSample />
      {/* Blank space at the bottom to avoid the screen moving as collections grow/shrink */}
      <div className="h-96" />
    </div>
  );
}
