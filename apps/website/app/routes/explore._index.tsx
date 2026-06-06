import { generateId } from 'live-model';
import { useControls } from 'leva';
import { Fragment, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

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
const oldListCommandItemClass = (commandInputFocused: boolean) =>
  [
    'rounded-none px-4 py-3 first:rounded-t-md last:rounded-b-md',
    'hover:!bg-accent hover:!text-accent-foreground',
    commandInputFocused
      ? 'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground'
      : 'data-[selected=true]:bg-transparent data-[selected=true]:text-foreground',
  ].join(' ');

export default function ExploreIndexPage() {
  // TODO: Where do we start from?
  // 1. Here's all your items! Go ahead, create something!
  // 2. (no) Everything must have an "edge" from something. Even if it's "user", or "app"
  // TODO: How do we use Live Model in this environment with no schemas/types??

  // TODO: This feels like it should be in LiveModel. Maybe as a Live<string[]> itself.
  const keys = useLocalStorageKeys();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [commandInputFocused, setCommandInputFocused] = useState(false);
  const {
    removeOldIdList,
    onlyShowCmdkOptionsAfterTyping,
    showCmdkOptionsAsOldList,
  } = useControls('Explore UI', {
    removeOldIdList: false,
    onlyShowCmdkOptionsAfterTyping: false,
    showCmdkOptionsAsOldList: false,
  });
  const trimmedSearch = search.trim();
  const hideOldIdList = removeOldIdList || showCmdkOptionsAsOldList;
  const showCommandOptions =
    !onlyShowCmdkOptionsAfterTyping || trimmedSearch.length > 0;
  const normalizedSearch = trimmedSearch.toLocaleLowerCase();
  const showCreateNewEntityAction =
    trimmedSearch.length > 0 &&
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
    trimmedSearch.length > 0 && !keys.includes(trimmedSearch);

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

      <Command
        shouldFilter={false}
        className={
          showCmdkOptionsAsOldList
            ? 'gap-3 overflow-visible rounded-none bg-transparent'
            : 'rounded-md border shadow-xs'
        }
      >
        <CommandInput
          placeholder="Search IDs or create an entity..."
          value={search}
          onValueChange={setSearch}
          onFocus={() => setCommandInputFocused(true)}
          onBlur={() => setCommandInputFocused(false)}
          wrapperClassName={
            showCmdkOptionsAsOldList
              ? 'rounded-md border border-b-0 bg-popover shadow-xs'
              : showCommandOptions
                ? undefined
                : 'border-b-0'
          }
        />
        {showCommandOptions ? (
          <CommandList
            className={
              showCmdkOptionsAsOldList
                ? 'max-h-none overflow-visible rounded-md border bg-popover shadow-xs'
                : undefined
            }
          >
            {showCmdkOptionsAsOldList ? (
              <>
                {showCreateNewEntityAction ? (
                  <CommandItem
                    value="create-new-entity"
                    className={oldListCommandItemClass(commandInputFocused)}
                    onSelect={() => createEntity(generateId())}
                  >
                    {createNewEntityLabel}
                  </CommandItem>
                ) : null}
                {showCreateNewEntityAction &&
                (filteredKeys.length > 0 || showSearchCreate) ? (
                  <CommandSeparator className="mx-0" />
                ) : null}
                {filteredKeys.map((key, index) => (
                  <Fragment key={key}>
                    {index > 0 ? <CommandSeparator className="mx-0" /> : null}
                    <CommandItem
                      value={`id:${key}`}
                      className={oldListCommandItemClass(commandInputFocused)}
                      onSelect={() => openEntity(key)}
                    >
                      <span className="truncate font-mono">{key}</span>
                    </CommandItem>
                  </Fragment>
                ))}
                {showSearchCreate ? (
                  <>
                    {showCreateNewEntityAction || filteredKeys.length > 0 ? (
                      <CommandSeparator className="mx-0" />
                    ) : null}
                    <CommandItem
                      value={`create:${trimmedSearch}`}
                      className={oldListCommandItemClass(commandInputFocused)}
                      onSelect={() => createEntity(trimmedSearch)}
                    >
                      create {trimmedSearch}
                    </CommandItem>
                  </>
                ) : null}
              </>
            ) : (
              <>
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
                      create "{trimmedSearch}"
                    </CommandItem>
                  ) : null}
                </CommandGroup>
              </>
            )}
          </CommandList>
        ) : null}
      </Command>

      {hideOldIdList ? null : keys.length === 0 ? (
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
