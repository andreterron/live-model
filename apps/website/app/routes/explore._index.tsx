import { generateId } from 'live-model';
import { Plus } from 'lucide-react';
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
import { useLocalStorageKeys } from '../hooks/use-local-storage-keys';

const createNewEntityLabel = 'Create new Entity';

export default function ExploreIndexPage() {
  // TODO: Where do we start from?
  // 1. Here's all your items! Go ahead, create something!
  // 2. (no) Everything must have an "edge" from something. Even if it's "user", or "app"
  // TODO: How do we use Live Model in this environment with no schemas/types??

  // TODO: This feels like it should be in LiveModel. Maybe as a Live<string[]> itself.
  const keys = useLocalStorageKeys();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const trimmedSearch = search.trim();
  const normalizedSearch = trimmedSearch.toLocaleLowerCase();
  const showCommandOptions = trimmedSearch.length > 0;
  const showCreateNewEntityAction =
    showCommandOptions &&
    createNewEntityLabel.toLocaleLowerCase().includes(normalizedSearch);
  const filteredKeys = useMemo(() => {
    if (!normalizedSearch) {
      return keys;
    }

    return keys.filter((key) =>
      key.toLocaleLowerCase().includes(normalizedSearch)
    );
  }, [keys, normalizedSearch]);
  const showSearchCreate =
    showCommandOptions && !keys.includes(trimmedSearch);

  const openEntity = (id: string) => {
    navigate(`entry/${encodeURIComponent(id)}`);
  };

  const createEntity = (id: string) => {
    if (localStorage.getItem(id) === null) {
      localStorage.setItem(id, JSON.stringify({}));
      window.dispatchEvent(new StorageEvent('local-storage', { key: id }));
    }

    openEntity(id);
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Explore</h1>
      </header>

      <Button className="w-fit" onClick={() => createEntity(generateId())}>
        <Plus className="size-4" aria-hidden="true" />
        Create
      </Button>

      <Command shouldFilter={false} className="rounded-md border shadow-xs">
        <CommandInput
          placeholder="Search IDs or create an entity..."
          value={search}
          onValueChange={setSearch}
          wrapperClassName={showCommandOptions ? undefined : 'border-b-0'}
        />
        {showCommandOptions ? (
          <CommandList>
            {showCreateNewEntityAction ? (
              <>
                <CommandGroup heading="Actions">
                  <CommandItem
                    value="create-new-entity"
                    onSelect={() => createEntity(generateId())}
                  >
                    {createNewEntityLabel}
                  </CommandItem>
                </CommandGroup>

                <CommandSeparator />
              </>
            ) : null}

            <CommandGroup heading="IDs">
              {filteredKeys.map((key) => (
                <CommandItem
                  key={key}
                  value={`id:${key}`}
                  onSelect={() => openEntity(key)}
                >
                  <span className="truncate font-mono">{key}</span>
                </CommandItem>
              ))}
              {showSearchCreate ? (
                <CommandItem
                  value={`create:${trimmedSearch}`}
                  onSelect={() => createEntity(trimmedSearch)}
                >
                  create {trimmedSearch}
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        ) : null}
      </Command>
    </main>
  );
}
