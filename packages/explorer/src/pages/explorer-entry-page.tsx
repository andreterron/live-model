import { useLiveState } from 'live-model';
import {
  ArrowLeft,
  MoreHorizontal,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Button } from '../components/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/dropdown-menu.js';
import {
  recordRecentExplorerKey,
  removeRecentExplorerKey,
} from '../hooks/use-recent-explorer-keys.js';
import { formatJson, parseJson } from '../lib/explorer-values.js';

export interface ExplorerEntryPageProps {
  entryId: string;
}

export function ExplorerEntryPage({ entryId }: ExplorerEntryPageProps) {
  const navigate = useNavigate();
  const { value, setValue, deleteValue } = useLiveState(entryId);
  const [draft, setDraft] = useState('{}');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [validationVisible, setValidationVisible] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const storedJson = useMemo(
    () => (value === undefined ? null : formatJson(value)),
    [value]
  );
  const parsedDraft = useMemo(() => parseJson(draft), [draft]);
  const showJsonError = validationVisible && parsedDraft.status === 'invalid';
  const isMissing = value === undefined;
  const hasChanges =
    storedJson === null ? draft !== '{}' : draft !== storedJson;
  const canSave =
    (isMissing || storedJson !== null) &&
    parsedDraft.status === 'valid' &&
    (isMissing || hasChanges);

  useEffect(() => recordRecentExplorerKey(entryId), [entryId]);

  useEffect(() => {
    setDraft(value === undefined ? '{}' : (storedJson ?? '{}'));
    setSaveStatus('idle');
    setValidationVisible(false);
  }, [storedJson, value]);

  const saveValue = () => {
    if (parsedDraft.status !== 'valid') return;
    const formatted = formatJson(parsedDraft.value);
    if (formatted === null) return;
    setValue(parsedDraft.value);
    setDraft(formatted);
    setSaveStatus('saved');
    setValidationVisible(false);
  };

  const deleteEntry = () => {
    deleteValue();
    removeRecentExplorerKey(entryId);
    navigate('..');
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Link
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-2 text-sm"
        to=".."
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Keys
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-all font-mono text-2xl font-bold">
              {entryId}
            </h1>
            {isMissing ? (
              <span className="text-muted-foreground rounded-sm border px-1.5 py-0.5 text-xs">
                New key
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {isMissing ? 'Save a value to create this key.' : 'Stored JSON value'}
          </p>
        </div>

        {!isMissing ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="-mr-2"
                aria-label="Open key actions"
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteConfirmationOpen(true)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Delete key
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>

      {deleteConfirmationOpen ? (
        <section
          className="border-destructive/40 bg-destructive/5 flex flex-col gap-4 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alertdialog"
          aria-labelledby="delete-key-title"
          aria-describedby="delete-key-description"
        >
          <div>
            <h2 id="delete-key-title" className="text-sm font-semibold">
              Delete this key?
            </h2>
            <p id="delete-key-description" className="text-muted-foreground mt-1 text-sm">
              This permanently removes the stored value.
            </p>
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmationOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteEntry}>
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </Button>
          </div>
        </section>
      ) : null}

      {value !== undefined && storedJson === null ? (
        <section className="border-destructive/40 rounded-md border p-4">
          <h2 className="text-sm font-semibold">Value cannot be edited</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            This value cannot be represented as JSON.
          </p>
        </section>
      ) : (
        <section className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Value</h2>
            <div className="flex items-center gap-2">
              {saveStatus === 'saved' && !hasChanges ? (
                <span className="text-muted-foreground text-xs" role="status">
                  Saved
                </span>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraft(storedJson ?? '{}');
                  setSaveStatus('idle');
                  setValidationVisible(false);
                }}
                disabled={!hasChanges}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset
              </Button>
              <Button size="sm" onClick={saveValue} disabled={!canSave}>
                <Save className="size-4" aria-hidden="true" />
                {isMissing ? 'Create' : 'Save'}
              </Button>
            </div>
          </div>

          <textarea
            className="bg-muted/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 min-h-96 w-full resize-y rounded-md border p-4 font-mono text-sm leading-6 outline-none focus-visible:ring-[3px]"
            aria-label="JSON value"
            aria-invalid={showJsonError}
            aria-describedby={showJsonError ? 'json-error' : undefined}
            spellCheck={false}
            value={draft}
            onBlur={() => setValidationVisible(true)}
            onFocus={() => setValidationVisible(false)}
            onChange={(event) => {
              setDraft(event.target.value);
              setSaveStatus('idle');
              setValidationVisible(false);
            }}
          />

          {showJsonError && parsedDraft.status === 'invalid' ? (
            <p id="json-error" className="text-destructive text-sm" role="alert">
              {parsedDraft.error}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              {hasChanges || isMissing ? 'Unsaved changes' : 'No unsaved changes'}
            </p>
          )}
        </section>
      )}
    </main>
  );
}
