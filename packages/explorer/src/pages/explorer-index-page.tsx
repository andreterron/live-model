import { generateId, useAllKeys, useLiveModelClient } from 'live-model';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3.js';
import Database from 'lucide-react/dist/esm/icons/database.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '../components/button.js';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '../components/command.js';
import {
  recordRecentExplorerKey,
  useRecentExplorerKeys,
} from '../hooks/use-recent-explorer-keys.js';

export function ExplorerIndexPage() {
  const client = useLiveModelClient();
  const keys = useAllKeys();
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

  const openEntry = (id: string) => {
    recordRecentExplorerKey(id);
    navigate(`entry/${encodeURIComponent(id)}`);
  };

  const createEntry = (id: string) => {
    if (!keys.includes(id)) client.forKey(id).setValue({});
    openEntry(id);
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-7">
      <header>
        <h1 className="text-2xl font-bold">Explore</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Browse and manage stored values.
        </p>
      </header>

      <Button className="w-fit" onClick={() => createEntry(generateId())}>
        <Plus className="size-4" aria-hidden="true" />
        Create
      </Button>

      <section className="grid gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-semibold">Keys</h2>
          <span className="text-muted-foreground text-xs">
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
                  className="text-muted-foreground mx-auto mb-3 size-5"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium">No keys stored yet</p>
                <p className="text-muted-foreground mt-1 text-xs">
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
                        onSelect={() => createEntry(trimmedSearch)}
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
                          onSelect={() => openEntry(key)}
                        >
                          <Clock3
                            className="text-muted-foreground size-4"
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
                        onSelect={() => openEntry(key)}
                      >
                        <Database
                          className="text-muted-foreground size-4"
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
