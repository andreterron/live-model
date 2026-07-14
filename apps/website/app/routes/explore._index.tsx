import { generateId, useAllKeys, useLiveModelClient } from 'live-model';
import { Clock3, Database, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '../components/ui/button';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '../components/ui/command';
import {
  recordRecentExplorerKey,
  useRecentExplorerKeys,
} from '../hooks/use-recent-explorer-keys';
import type { Route } from './+types/explore._index';

export function clientLoader({}: Route.ClientLoaderArgs) {
  return {};
}

export default function ExploreIndexPage() {
  // TODO: Where do we start from?
  // 1. Here's all your items! Go ahead, create something!
  // 2. (no) Everything must have an "edge" from something. Even if it's "user", or "app"
  // TODO: How do we use Live Model in this environment with no schemas/types??

  const client = useLiveModelClient();
  const keys = useAllKeys();
  // TODO: This feels like it should be in LiveModel. Maybe as a Live<string[]> itself.
  const recentKeys = useRecentExplorerKeys();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const trimmedSearch = search.trim();
  const normalizedSearch = trimmedSearch.toLocaleLowerCase();
  const showSearchCreate =
    trimmedSearch.length > 0 && !keys.includes(trimmedSearch);
  const filteredKeys = useMemo(() => {
    if (!normalizedSearch) return keys;
    return keys.filter((key) =>
      key.toLocaleLowerCase().includes(normalizedSearch)
    );
  }, [keys, normalizedSearch]);
  const filteredRecentKeys = useMemo(
    () =>
      recentKeys.filter(
        (key) =>
          keys.includes(key) &&
          (!normalizedSearch ||
            key.toLocaleLowerCase().includes(normalizedSearch))
      ),
    [keys, normalizedSearch, recentKeys]
  );

  const openEntity = (id: string) => {
    recordRecentExplorerKey(id);
    navigate(`entry/${encodeURIComponent(id)}`);
  };

  const createEntity = (id: string) => {
    if (keys.includes(id)) {
      openEntity(id);
      return;
    }

    client.forKey(id).setValue({});
    openEntity(id);
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-7">
      <header>
        <h1 className="text-2xl font-bold">Explore</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and manage stored values.
        </p>
      </header>

      <Button className="w-fit" onClick={() => createEntity(generateId())}>
        <Plus className="size-4" aria-hidden="true" />
        Create
      </Button>

      <section className="grid gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-semibold">Keys</h2>
          <span className="text-xs text-muted-foreground">
            {keys.length} {keys.length === 1 ? 'key' : 'keys'}
          </span>
        </div>

        <Command shouldFilter={false} className="rounded-md border shadow-xs">
          <CommandInput
            placeholder="Filter keys..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[32rem]">
            {keys.length === 0 && !trimmedSearch ? (
              <div className="px-4 py-10 text-center">
                <Database
                  className="mx-auto mb-3 size-5 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium">No keys stored yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create the first key above.
                </p>
              </div>
            ) : (
              <>
                {showSearchCreate ? (
                  <>
                    <CommandGroup heading="Actions">
                      <CommandItem
                        value={`create:${trimmedSearch}`}
                        onSelect={() => createEntity(trimmedSearch)}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        <span className="truncate">
                          {`Create "${trimmedSearch}"`}
                        </span>
                      </CommandItem>
                    </CommandGroup>
                    {filteredKeys.length > 0 ? <CommandSeparator /> : null}
                  </>
                ) : null}

                {filteredRecentKeys.length > 0 ? (
                  <>
                    <CommandGroup heading="Recent">
                      {filteredRecentKeys.map((key) => (
                        <CommandItem
                          key={key}
                          value={`recent:${key}`}
                          onSelect={() => openEntity(key)}
                        >
                          <Clock3
                            className="size-4 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <span className="truncate font-mono">{key}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandSeparator />
                  </>
                ) : null}

                {filteredKeys.length > 0 ? (
                  <CommandGroup heading="All keys">
                    {filteredKeys.map((key) => (
                      <CommandItem
                        key={key}
                        value={`key:${key}`}
                        onSelect={() => openEntity(key)}
                      >
                        <Database
                          className="size-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="truncate font-mono">{key}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
              </>
            )}
          </CommandList>
        </Command>
      </section>
    </main>
  );
}
