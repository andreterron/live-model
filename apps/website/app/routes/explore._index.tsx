import { Link } from 'react-router';

import { useLocalStorageKeys } from '../hooks/use-local-storage-keys';

export default function ExploreIndexPage() {
  // TODO: Where do we start from?
  // 1. Here's all your items! Go ahead, create something!
  // 2. (no) Everything must have an "edge" from something. Even if it's "user", or "app"
  // TODO: How do we use Live Model in this environment with no schemas/types??

  // TODO: This feels like it should be in LiveModel. Maybe as a Live<string[]> itself.
  const keys = useLocalStorageKeys();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Explore</h1>
      </header>

      {keys.length === 0 ? (
        <p className="text-muted-foreground">No localStorage keys found.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {keys.map((key) => (
            <li key={key}>
              <Link
                className="block truncate px-4 py-3 font-mono text-sm hover:bg-accent hover:text-accent-foreground"
                to={`entry/${encodeURIComponent(key)}`}
              >
                {key}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
