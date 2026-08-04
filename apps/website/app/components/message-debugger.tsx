import type {
  DebuggerInputMessage,
  DebuggerMachineSnapshot,
  DebuggerMessageEvent,
  DebuggerOperationRecord,
} from '../lib/in-memory-message-debugger';
import { InMemoryMessageDebugger } from '../lib/in-memory-message-debugger';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';

const machines = [
  { id: 'client-a', label: 'Client A', role: 'client' },
  { id: 'client-b', label: 'Client B', role: 'client' },
] as const;

type MessageKind =
  | 'set_value'
  | 'delete'
  | 'custom'
  | 'subscribe'
  | 'unsubscribe';

interface ComposerDraft {
  kind: MessageKind;
  key: string;
  value: string;
  customType: string;
}

const initialDraft: ComposerDraft = {
  kind: 'set_value',
  key: 'document.title',
  value: '"Hello from Live Model"',
  customType: 'increment',
};

function createMessageDebugger() {
  // A new browser session intentionally starts with an empty debugger history.
  return new InMemoryMessageDebugger(machines);
}

export function MessageDebugger() {
  const [storedMessageDebugger, setMessageDebugger] = useState(
    createMessageDebugger
  );
  const [activeView, setActiveView] = useState<'messages' | 'operations'>(
    'messages'
  );
  const [operationCount, setOperationCount] = useState(0);
  const [draft, setDraft] = useState<ComposerDraft>(() => ({
    ...initialDraft,
  }));
  const [directionReversed, setDirectionReversed] = useState(false);
  const [, setRevision] = useState(0);
  const messageDebugger = isCurrentMessageDebugger(storedMessageDebugger)
    ? storedMessageDebugger
    : createMessageDebugger();
  const snapshots = messageDebugger.machines;

  useEffect(() => {
    if (messageDebugger === storedMessageDebugger) {
      return;
    }

    // Fast Refresh can preserve an instance created by an older debugger class.
    setMessageDebugger(messageDebugger);
    setOperationCount(0);
  }, [messageDebugger, storedMessageDebugger]);

  function sendMessage() {
    const source = directionReversed ? snapshots[1] : snapshots[0];
    const target = directionReversed ? snapshots[0] : snapshots[1];
    messageDebugger.send(source.id, target.id, toMessage(draft));
    setOperationCount(messageDebugger.operations.length);
    setRevision((revision) => revision + 1);
  }

  function updateDraft(patch: Partial<ComposerDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-medium text-sky-600 dark:text-sky-400">
            Local protocol lab
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Message debugger
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Send protocol messages between two isolated in-memory machines and
            inspect every request, result, and state response.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              messageDebugger.clearHistory();
              setOperationCount(0);
              setRevision((revision) => revision + 1);
            }}
            disabled={messageDebugger.events.length === 0}
          >
            <Trash2 /> Clear history
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setMessageDebugger(createMessageDebugger());
              setOperationCount(0);
            }}
          >
            <RotateCcw /> Reset machines
          </Button>
        </div>
      </div>

      <aside className="mb-6 rounded-xl border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-semibold">Next investigations</p>
        <p className="mt-1 text-amber-900/80 dark:text-amber-100/70">
          Time branching · conflict-driven automatic branching · operation
          acceptance hooks · dependency visualization for unordered operations
        </p>
      </aside>

      <MessageComposerCard
        draft={draft}
        directionReversed={directionReversed}
        onDirectionChange={() => setDirectionReversed((current) => !current)}
        onDraftChange={updateDraft}
        onSend={sendMessage}
      />

      <section className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <MachineCard machine={snapshots[0]} />
        <MachineCard machine={snapshots[1]} />
      </section>

      <DebuggerViews
        activeView={activeView}
        onViewChange={setActiveView}
        messageDebugger={messageDebugger}
        snapshots={snapshots}
        operationCount={operationCount}
        onOperationCountChange={setOperationCount}
      />
    </main>
  );
}

function MessageComposerCard({
  draft,
  directionReversed,
  onDirectionChange,
  onDraftChange,
  onSend,
}: {
  draft: ComposerDraft;
  directionReversed: boolean;
  onDirectionChange: () => void;
  onDraftChange: (patch: Partial<ComposerDraft>) => void;
  onSend: () => void;
}) {
  const source = directionReversed ? machines[1] : machines[0];
  const target = directionReversed ? machines[0] : machines[1];
  const needsValue = draft.kind === 'set_value' || draft.kind === 'custom';

  return (
    <Card className="mb-6 overflow-hidden">
      <CardHeader className="border-b pb-5 pt-5">
        <CardTitle>Send message</CardTitle>
        <CardDescription>
          Choose a direction, then compose a protocol message.
        </CardDescription>
      </CardHeader>
      <CardContent className="py-5">
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            onSend();
          }}
        >
          <button
            type="button"
            aria-label={`Reverse direction. Currently sending from ${source.label} to ${target.label}.`}
            aria-pressed={directionReversed}
            onClick={onDirectionChange}
            className="group grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border bg-muted/40 p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
          >
            <DirectionEndpoint
              label={machines[0].label}
              direction={directionReversed ? 'To' : 'From'}
            />
            <span className="flex size-11 items-center justify-center rounded-full border bg-background text-primary shadow-sm transition-transform group-active:scale-95">
              <ArrowRight
                className={`size-5 transition-transform duration-300 ease-out ${
                  directionReversed ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </span>
            <DirectionEndpoint
              label={machines[1].label}
              direction={directionReversed ? 'From' : 'To'}
              align="right"
            />
          </button>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Message">
              <select
                value={draft.kind}
                onChange={(event) =>
                  onDraftChange({ kind: event.target.value as MessageKind })
                }
                className={inputClassName}
              >
                <option value="set_value">Set value</option>
                <option value="delete">Delete</option>
                <option value="custom">Custom operation</option>
                <option value="subscribe">Subscribe</option>
                <option value="unsubscribe">Unsubscribe</option>
              </select>
            </Field>
            <Field label="Key">
              <input
                required
                value={draft.key}
                onChange={(event) => onDraftChange({ key: event.target.value })}
                className={inputClassName}
              />
            </Field>
          </div>
          {draft.kind === 'custom' && (
            <Field label="Operation type">
              <input
                required
                value={draft.customType}
                onChange={(event) =>
                  onDraftChange({ customType: event.target.value })
                }
                className={inputClassName}
                placeholder="increment"
              />
            </Field>
          )}
          {needsValue && (
            <Field label={draft.kind === 'custom' ? 'Operation data' : 'Value'}>
              <input
                value={draft.value}
                onChange={(event) =>
                  onDraftChange({ value: event.target.value })
                }
                className={inputClassName}
                placeholder='JSON or plain text, e.g. {"count": 1}'
              />
            </Field>
          )}
          <Button type="submit" className="w-full sm:w-auto">
            <Send /> Send from {source.label} to {target.label}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function DirectionEndpoint({
  label,
  direction,
  align = 'left',
}: {
  label: string;
  direction: 'From' | 'To';
  align?: 'left' | 'right';
}) {
  return (
    <span className={align === 'right' ? 'text-right' : undefined}>
      <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {direction}
      </span>
      <span className="mt-1 block font-semibold">{label}</span>
    </span>
  );
}

function MachineCard({ machine }: { machine: DebuggerMachineSnapshot }) {
  const values = Object.entries(machine.values);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b pb-5 pt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>{machine.label}</CardTitle>
            <CardDescription className="mt-1 capitalize">
              {machine.role} machine
            </CardDescription>
          </div>
          <span className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <span className="size-2 rounded-full bg-emerald-500" /> In memory
          </span>
        </div>
      </CardHeader>
      <CardContent className="py-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Local values
        </p>
        {values.length === 0 ? (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            No values yet
          </p>
        ) : (
          <div className="space-y-2">
            {values.map(([key, state]) => (
              <div key={key} className="rounded-lg bg-muted p-3 text-sm">
                <code className="font-semibold">{key}</code>
                <pre className="mt-1 overflow-x-auto text-xs text-muted-foreground">
                  {JSON.stringify(state, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DebuggerViews({
  activeView,
  onViewChange,
  messageDebugger,
  snapshots,
  operationCount,
  onOperationCountChange,
}: {
  activeView: 'messages' | 'operations';
  onViewChange: (view: 'messages' | 'operations') => void;
  messageDebugger: InMemoryMessageDebugger;
  snapshots: readonly DebuggerMachineSnapshot[];
  operationCount: number;
  onOperationCountChange: (count: number) => void;
}) {
  return (
    <section className="mt-8">
      <div
        role="tablist"
        aria-label="Debugger views"
        className="mb-5 flex w-full gap-1 rounded-lg bg-muted p-1 sm:w-fit"
      >
        <ViewTab
          id="messages-tab"
          panelId="messages-panel"
          selected={activeView === 'messages'}
          onClick={() => onViewChange('messages')}
        >
          Messages by machine
        </ViewTab>
        <ViewTab
          id="operations-tab"
          panelId="operations-panel"
          selected={activeView === 'operations'}
          onClick={() => onViewChange('operations')}
        >
          Operation timeline
        </ViewTab>
      </div>

      {activeView === 'messages' ? (
        <MessagesByMachine
          events={messageDebugger.events}
          snapshots={snapshots}
        />
      ) : (
        <OperationTimeline
          messageDebugger={messageDebugger}
          operationCount={operationCount}
          onOperationCountChange={onOperationCountChange}
        />
      )}
    </section>
  );
}

function ViewTab({
  id,
  panelId,
  selected,
  onClick,
  children,
}: {
  id: string;
  panelId: string;
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={panelId}
      tabIndex={selected ? 0 : -1}
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:flex-none ${
        selected
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function MessagesByMachine({
  events,
  snapshots,
}: {
  events: readonly DebuggerMessageEvent[];
  snapshots: readonly DebuggerMachineSnapshot[];
}) {
  const labels = new Map(
    snapshots.map((machine) => [machine.id, machine.label])
  );

  return (
    <div id="messages-panel" role="tabpanel" aria-labelledby="messages-tab">
      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Send a message from either machine to populate its inbox and outbox.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {snapshots.map((machine) => (
            <MachineMessageLog
              key={machine.id}
              machine={machine}
              events={events.filter(
                (event) =>
                  event.sourceMachineId === machine.id ||
                  event.targetMachineId === machine.id
              )}
              labels={labels}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MachineMessageLog({
  machine,
  events,
  labels,
}: {
  machine: DebuggerMachineSnapshot;
  events: readonly DebuggerMessageEvent[];
  labels: ReadonlyMap<string, string>;
}) {
  const sentCount = events.filter(
    (event) => event.sourceMachineId === machine.id
  ).length;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b pb-5">
        <CardTitle>{machine.label}</CardTitle>
        <CardDescription>
          {sentCount} sent · {events.length - sentCount} received
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ol className="divide-y">
          {events.map((event) => {
            const sent = event.sourceMachineId === machine.id;
            const otherMachineId = sent
              ? event.targetMachineId
              : event.sourceMachineId;

            return (
              <li key={`${machine.id}-${event.id}`} className="p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      sent
                        ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}
                  >
                    {sent ? <ArrowUpRight /> : <ArrowDownLeft />}
                    {sent ? 'Sent' : 'Received'}
                  </span>
                  <span className="text-muted-foreground">
                    {sent ? 'to' : 'from'} {labels.get(otherMachineId)}
                  </span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    #{event.sequence}
                  </span>
                  <MessageBadge event={event} />
                </div>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                  {JSON.stringify(event.message, null, 2)}
                </pre>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function OperationTimeline({
  messageDebugger,
  operationCount,
  onOperationCountChange,
}: {
  messageDebugger: InMemoryMessageDebugger;
  operationCount: number;
  onOperationCountChange: (count: number) => void;
}) {
  const operations = messageDebugger.operations;
  const selectedOperation =
    operationCount === 0 ? undefined : operations[operationCount - 1];
  const snapshots = messageDebugger.machinesAtOperationCount(operationCount);
  const labels = new Map(
    snapshots.map((machine) => [machine.id, machine.label])
  );

  return (
    <div id="operations-panel" role="tabpanel" aria-labelledby="operations-tab">
      {operations.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Send a set, delete, or custom operation to create operation history.
        </div>
      ) : (
        <>
          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Operation time</p>
                <p className="text-sm text-muted-foreground">
                  {operationCount === 0
                    ? 'Before the first operation'
                    : `Operation ${operationCount} of ${operations.length}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="Previous operation"
                  disabled={operationCount === 0}
                  onClick={() => onOperationCountChange(operationCount - 1)}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="Next operation"
                  disabled={operationCount === operations.length}
                  onClick={() => onOperationCountChange(operationCount + 1)}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={operations.length}
              step={1}
              value={operationCount}
              onChange={(event) =>
                onOperationCountChange(Number(event.target.value))
              }
              aria-label="Operation timeline position"
              className="mt-4 w-full accent-sky-600"
            />
            <div className="mt-1 flex justify-between font-mono text-xs text-muted-foreground">
              <span>start</span>
              <span>{operations.length}</span>
            </div>
          </div>

          <SelectedOperation operation={selectedOperation} labels={labels} />

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {snapshots.map((machine) => (
              <MachineOperationKnowledge
                key={machine.id}
                machine={machine}
                operations={operations.slice(0, operationCount)}
                labels={labels}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SelectedOperation({
  operation,
  labels,
}: {
  operation: DebuggerOperationRecord | undefined;
  labels: ReadonlyMap<string, string>;
}) {
  if (!operation) {
    return (
      <div className="mt-4 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
        No operation has happened yet. Both machines begin with empty state.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-sky-300 bg-sky-50 p-5 dark:border-sky-900 dark:bg-sky-950/30">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono text-xs text-sky-700 dark:text-sky-300">
          op #{operation.operationSequence}
        </span>
        <span className="font-semibold">
          {labels.get(operation.sourceMachineId)}
        </span>
        <ArrowRight className="size-3.5" />
        <span className="font-semibold">
          {labels.get(operation.targetMachineId)}
        </span>
        <span className="rounded-full bg-sky-100 px-2 py-0.5 font-mono text-xs text-sky-700 dark:bg-sky-950 dark:text-sky-300">
          {operation.operation.type}
        </span>
      </div>
      <p className="mt-2 text-sm">
        Applied to <code className="font-semibold">{operation.key}</code> ·{' '}
        <span
          className={
            operation.status.status === 'success'
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-red-700 dark:text-red-300'
          }
        >
          {operation.status.status}
        </span>
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <StateBlock
          label="Target state before"
          state={operation.targetStateBefore}
        />
        <StateBlock
          label="Target state after"
          state={operation.targetStateAfter}
        />
      </div>
    </div>
  );
}

function MachineOperationKnowledge({
  machine,
  operations,
  labels,
}: {
  machine: DebuggerMachineSnapshot;
  operations: readonly DebuggerOperationRecord[];
  labels: ReadonlyMap<string, string>;
}) {
  const knownOperations = operations.filter(
    (operation) =>
      operation.sourceMachineId === machine.id ||
      operation.targetMachineId === machine.id
  );
  const values = Object.entries(machine.values);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b pb-5">
        <CardTitle>{machine.label}</CardTitle>
        <CardDescription>
          Knows {knownOperations.length}{' '}
          {knownOperations.length === 1 ? 'operation' : 'operations'} at this
          point
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 py-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Known operations
          </p>
          {knownOperations.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              None yet
            </p>
          ) : (
            <ol className="space-y-2">
              {knownOperations.map((operation) => {
                const sent = operation.sourceMachineId === machine.id;
                const otherId = sent
                  ? operation.targetMachineId
                  : operation.sourceMachineId;
                return (
                  <li
                    key={operation.id}
                    className="rounded-lg bg-muted p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        #{operation.operationSequence}
                      </span>
                      <span className="font-semibold">
                        {sent ? 'Sent' : 'Received'} {operation.operation.type}
                      </span>
                      <span className="text-muted-foreground">
                        {sent ? 'to' : 'from'} {labels.get(otherId)}
                      </span>
                    </div>
                    <code className="mt-1 block text-xs text-muted-foreground">
                      {operation.key}
                    </code>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            State at this point
          </p>
          {values.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              Empty state
            </p>
          ) : (
            <div className="space-y-2">
              {values.map(([key, state]) => (
                <StateBlock key={key} label={key} state={state} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StateBlock({ label, state }: { label: string; state: unknown }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted p-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <pre className="mt-1 overflow-x-auto text-xs">
        {JSON.stringify(state, null, 2)}
      </pre>
    </div>
  );
}

function MessageBadge({ event }: { event: DebuggerMessageEvent }) {
  const message = event.message;
  const isError = message.type === 'op_status' && message.status === 'error';
  const label = message.type === 'op' ? message.operation.type : message.type;

  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-xs ${
        isError
          ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
          : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
      }`}
    >
      {label}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function toMessage(draft: ComposerDraft): DebuggerInputMessage {
  if (draft.kind === 'subscribe' || draft.kind === 'unsubscribe') {
    return { type: draft.kind, key: draft.key };
  }

  if (draft.kind === 'delete') {
    return { type: 'op', key: draft.key, operation: { type: 'delete' } };
  }

  return {
    type: 'op',
    key: draft.key,
    operation: {
      type: draft.kind === 'custom' ? draft.customType : 'set_value',
      data: parseValue(draft.value),
    },
  };
}

function parseValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

const inputClassName =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40';

function isCurrentMessageDebugger(
  messageDebugger: InMemoryMessageDebugger
): boolean {
  const runtimeDebugger = messageDebugger as unknown as Record<string, unknown>;

  return (
    runtimeDebugger['apiVersion'] === 2 &&
    typeof runtimeDebugger['machinesAtOperationCount'] === 'function' &&
    typeof runtimeDebugger['clearHistory'] === 'function' &&
    Array.isArray(runtimeDebugger['operations'])
  );
}
