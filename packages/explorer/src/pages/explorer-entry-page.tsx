import {
  liveReference,
  useLiveModelClient,
  type LiveState,
  type Operation,
  type TypeDefinition,
} from 'live-model';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js';
import Play from 'lucide-react/dist/esm/icons/play.js';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate } from 'react-router';

import { Button } from '../components/button.js';
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
  const client = useLiveModelClient();
  const live = useMemo(() => client.forKey(entryId), [client, entryId]);
  const state = useLiveSnapshot(live);
  const operationSetId =
    state.kind === 'loading'
      ? 'default'
      : state.metadata?.op_set?.root ?? 'default';
  const operationSet = client.operationSetRegistry.get(operationSetId);
  const operationSets = client.operationSetRegistry.list();
  const [operationType, setOperationType] = useState('set_value');
  const [argument, setArgument] = useState('{}');
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const value = useMemo(
    () =>
      state.kind === 'value' ? client.encodeReferences(state.value) : undefined,
    [client, state]
  );
  const isMissing = state.kind === 'absent';
  const operationDefinition = operationSet?.operations[operationType];

  useEffect(() => recordRecentExplorerKey(entryId), [entryId]);

  useEffect(() => {
    if (!operationSet) return;
    const availableOperations = Object.keys(operationSet.operations);
    const nextOperation = availableOperations.includes(operationType)
      ? operationType
      : availableOperations[0];
    setOperationType(nextOperation);
    setArgument(defaultArgument(operationSet, nextOperation, value));
    setStatus(undefined);
    setError(undefined);
  }, [operationSet, operationType, value]);

  const updateOperationSet = (nextId: string) => {
    const result = live.op({
      type: 'set_metadata',
      data: { op_set: { root: nextId } },
    });
    if (result.status === 'error') {
      setError(result.error.message);
      setStatus(undefined);
      return;
    }

    setStatus(`Operation set changed to ${nextId}`);
    setError(undefined);
  };

  const executeOperation = () => {
    if (!operationSet || !operationDefinition) return;
    const operation = createOperation(
      operationSet,
      operationDefinition.name,
      argument
    );
    if (operation.status === 'error') {
      setError(operation.error);
      setStatus(undefined);
      return;
    }

    const result = live.op(operation.operation);
    if (result.status === 'error') {
      setError(result.error.message);
      setStatus(undefined);
      return;
    }

    setError(undefined);
    setStatus(`${operationLabel(operationDefinition.name)} sent`);
    if (operationDefinition.name === 'delete') {
      removeRecentExplorerKey(entryId);
      navigate('..');
    }
  };

  if (!operationSet) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <p className="text-destructive text-sm">
          The operation set “{operationSetId}” is not registered in this client.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Link
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-2 text-sm"
        to=".."
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Keys
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="break-all font-mono text-2xl font-bold">{entryId}</h1>
          {isMissing ? (
            <span className="text-muted-foreground rounded-sm border px-1.5 py-0.5 text-xs">
              Missing
            </span>
          ) : null}
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Execute operations accepted by this key’s operation set.
        </p>
      </header>

      <section className="grid gap-2 rounded-md border p-4">
        <label className="text-sm font-semibold" htmlFor="operation-set">
          Operation set
        </label>
        <select
          id="operation-set"
          className={inputClassName}
          value={operationSet.name}
          onChange={(event) => updateOperationSet(event.target.value)}
        >
          {operationSets.map((definition) => (
            <option key={definition.name} value={definition.name}>
              {operationLabel(definition.name)}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">
          Changing this immediately sends a set_metadata operation.
        </p>
      </section>

      <section className="grid gap-4 rounded-md border p-4">
        <div className="grid gap-2">
          <label className="text-sm font-semibold" htmlFor="operation-type">
            Operation
          </label>
          <select
            id="operation-type"
            className={inputClassName}
            value={operationType}
            onChange={(event) => {
              const nextType = event.target.value;
              setOperationType(nextType);
              setArgument(defaultArgument(operationSet, nextType, value));
              setStatus(undefined);
              setError(undefined);
            }}
          >
            {Object.values(operationSet.operations).map((definition) => (
              <option key={definition.name} value={definition.name}>
                {operationLabel(definition.name)}
              </option>
            ))}
          </select>
        </div>

        {operationDefinition?.hasArgument ? (
          <OperationArgument
            operationSetName={operationSet.name}
            operationType={operationType}
            value={argument}
            onChange={(nextValue) => {
              setArgument(nextValue);
              setStatus(undefined);
              setError(undefined);
            }}
          />
        ) : null}

        {operationSet.name === 'counter' && isMissing ? (
          <p className="text-destructive text-sm">
            Increment requires an existing numeric value. Select Default and
            execute set value first.
          </p>
        ) : null}

        {operationSet.name === 'multiset' ? (
          <p className="text-muted-foreground text-xs">
            Insert appends a reference, including duplicates. Remove deletes one
            matching occurrence. Create or update the referenced entity
            separately.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div aria-live="polite">
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            {!error && status ? (
              <p className="text-muted-foreground text-sm">{status}</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            {operationDefinition?.hasArgument ? (
              <Button
                variant="outline"
                onClick={() =>
                  setArgument(
                    defaultArgument(operationSet, operationType, value)
                  )
                }
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset
              </Button>
            ) : null}
            <Button
              variant={operationType === 'delete' ? 'destructive' : 'default'}
              onClick={() =>
                operationType === 'delete'
                  ? setDeleteConfirmationOpen(true)
                  : executeOperation()
              }
            >
              {operationType === 'delete' ? (
                <Trash2 className="size-4" aria-hidden="true" />
              ) : (
                <Play className="size-4" aria-hidden="true" />
              )}
              {operationLabel(operationType)}
            </Button>
          </div>
        </div>
      </section>

      {deleteConfirmationOpen ? (
        <section
          className="border-destructive/40 bg-destructive/5 flex flex-col gap-4 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alertdialog"
          aria-labelledby="delete-key-title"
        >
          <h2 id="delete-key-title" className="text-sm font-semibold">
            Delete this key?
          </h2>
          <div className="flex shrink-0 justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmationOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={executeOperation}>
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </Button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-2">
        <h2 className="text-sm font-semibold">Current state</h2>
        <pre className="bg-muted/30 min-h-24 overflow-x-auto rounded-md border p-4 font-mono text-sm leading-6">
          {JSON.stringify(
            state.kind === 'value' ? { ...state, value } : state,
            null,
            2
          )}
        </pre>
      </section>
    </main>
  );
}

function OperationArgument({
  operationSetName,
  operationType,
  value,
  onChange,
}: {
  operationSetName: string;
  operationType: string;
  value: string;
  onChange: (value: string) => void;
}) {
  if (operationType === 'increment') {
    return (
      <label className="grid gap-2 text-sm font-semibold">
        Amount
        <input
          className={inputClassName}
          type="number"
          step="any"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    );
  }

  if (
    operationSetName === 'multiset' &&
    (operationType === 'insert' || operationType === 'remove')
  ) {
    return (
      <label className="grid gap-2 text-sm font-semibold">
        Entity key
        <input
          className={inputClassName}
          type="text"
          value={value}
          placeholder="todos/first"
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="text-muted-foreground text-xs font-normal">
          Explorer will send this as a root Live reference.
        </span>
      </label>
    );
  }

  return (
    <label className="grid gap-2 text-sm font-semibold">
      Value
      <textarea
        className="bg-muted/30 focus-visible:border-ring focus-visible:ring-ring/50 min-h-72 w-full resize-y rounded-md border p-4 font-mono text-sm leading-6 outline-none focus-visible:ring-[3px]"
        aria-label="Operation value"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function createOperation(
  operationSet: TypeDefinition,
  operationType: string,
  argument: string
):
  | { status: 'success'; operation: Operation }
  | { status: 'error'; error: string } {
  const definition = operationSet.operations[operationType];
  if (!definition) {
    return { status: 'error', error: 'Operation is not defined' };
  }
  if (!definition.hasArgument) {
    return { status: 'success', operation: { type: operationType } };
  }

  let value: unknown;
  if (operationSet.name === 'counter' && operationType === 'increment') {
    value = argument.trim() === '' ? Number.NaN : Number(argument);
  } else if (
    operationSet.name === 'multiset' &&
    (operationType === 'insert' || operationType === 'remove')
  ) {
    const memberKey = argument.trim();
    if (memberKey === '') {
      return { status: 'error', error: 'Entity key is required' };
    }
    value = liveReference(memberKey);
  } else {
    const parsedJson = parseJson(argument);
    if (parsedJson.status === 'invalid') {
      return { status: 'error', error: parsedJson.error };
    }
    value = parsedJson.value;
  }

  const parsed = definition.schema.safeParse(value);
  if (!parsed.success) {
    return {
      status: 'error',
      error: parsed.error.issues[0]?.message ?? 'Invalid data',
    };
  }
  return {
    status: 'success',
    operation: { type: operationType, data: parsed.data },
  };
}

function defaultArgument(
  operationSet: TypeDefinition,
  operationType: string,
  currentValue: unknown
): string {
  if (operationSet.name === 'counter' && operationType === 'increment') {
    return '1';
  }
  if (operationType === 'set_value') {
    return formatJson(currentValue) ?? '{}';
  }
  return '';
}

function operationLabel(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function useLiveSnapshot(live: {
  get(): LiveState<unknown>;
  subscribe(subscriber: { next(): void }): { unsubscribe(): void };
}): LiveState<unknown> {
  return useSyncExternalStore(
    (onStoreChange) => {
      const subscription = live.subscribe({ next: onStoreChange });
      return () => subscription.unsubscribe();
    },
    () => live.get(),
    () => live.get()
  );
}

const inputClassName =
  'border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]';
