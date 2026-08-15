import type {
  DebuggerInputMessage,
  DebuggerMachineSnapshot,
  DebuggerMessageEvent,
  DebuggerOperationKnowledgeStep,
  DebuggerOperationRecord,
} from '../lib/in-memory-message-debugger';
import { InMemoryMessageDebugger } from '../lib/in-memory-message-debugger';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left.js';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw.js';
import Send from 'lucide-react/dist/esm/icons/send.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

const machines = [
  { id: 'client-a', label: 'Client A', role: 'client' },
  { id: 'client-b', label: 'Client B', role: 'client' },
] as const;

type ViewMode = 'events' | 'operations';
type MessageKind = 'set_value' | 'delete' | 'subscribe' | 'unsubscribe';

type SelectedItem =
  | {
      kind: 'event';
      machineId: string;
      item: DebuggerMessageEvent;
    }
  | {
      kind: 'operation';
      machineId: string;
      item: DebuggerOperationRecord;
    };

function createDebugger() {
  return new InMemoryMessageDebugger(machines);
}

export function MessageDebuggerV2() {
  const [storedMessageDebugger, setMessageDebugger] = useState(createDebugger);
  const [viewMode, setViewMode] = useState<ViewMode>('operations');
  const [directionReversed, setDirectionReversed] = useState(false);
  const [messageKind, setMessageKind] = useState<MessageKind>('set_value');
  const [key, setKey] = useState('document.title');
  const [value, setValue] = useState('"Hello from Live Model"');
  const [knowledgeStep, setKnowledgeStep] = useState(0);
  const [revision, setRevision] = useState(0);
  // TODO: Use React Router navigation for selected items if debugging data becomes persistent.
  const [selectedItem, setSelectedItem] = useState<SelectedItem>();

  const messageDebugger = supportsKnowledgeTimeline(storedMessageDebugger)
    ? storedMessageDebugger
    : createDebugger();
  const snapshots = messageDebugger.machines;
  const source = directionReversed ? snapshots[1] : snapshots[0];
  const target = directionReversed ? snapshots[0] : snapshots[1];

  useEffect(() => {
    setSelectedItem(undefined);
  }, [viewMode]);

  useEffect(() => {
    if (messageDebugger === storedMessageDebugger) return;
    setMessageDebugger(messageDebugger);
    setKnowledgeStep(0);
    setSelectedItem(undefined);
  }, [messageDebugger, storedMessageDebugger]);

  function sendMessage() {
    messageDebugger.send(
      source.id,
      target.id,
      createMessage(messageKind, key, value)
    );
    setKnowledgeStep(messageDebugger.operationKnowledgeSteps.length);
    setRevision((current) => current + 1);
  }

  function reset() {
    setMessageDebugger(createDebugger());
    setKnowledgeStep(0);
    setSelectedItem(undefined);
    setRevision((current) => current + 1);
  }

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-medium text-sky-600 dark:text-sky-400">
            Device sequence
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Message debugger</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Compare the events and operations known by each client. Matching
            letters identify the same item on every device.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild type="button" variant="outline">
            <Link to="/debugger/v1">Open classic debugger</Link>
          </Button>
          <Button type="button" variant="outline" onClick={reset}>
            <RotateCcw /> Reset
          </Button>
        </div>
      </header>

      <MessageComposer
        directionReversed={directionReversed}
        messageKind={messageKind}
        messageKey={key}
        value={value}
        source={source}
        target={target}
        onDirectionChange={() => setDirectionReversed((current) => !current)}
        onKindChange={setMessageKind}
        onKeyChange={setKey}
        onValueChange={setValue}
        onSend={sendMessage}
      />

      <div
        className={`grid items-start gap-6 ${
          selectedItem ? 'md:grid-cols-[minmax(0,1fr)_24rem]' : ''
        }`}
      >
        <div className="min-w-0">
          <div className="mb-6 flex rounded-lg bg-muted p-1 sm:w-fit">
            <ViewButton
              selected={viewMode === 'events'}
              onClick={() => setViewMode('events')}
            >
              Events
            </ViewButton>
            <ViewButton
              selected={viewMode === 'operations'}
              onClick={() => setViewMode('operations')}
            >
              Operations
            </ViewButton>
          </div>

          {viewMode === 'operations' && (
            <OperationKnowledgeTimeline
              steps={messageDebugger.operationKnowledgeSteps}
              value={knowledgeStep}
              snapshots={snapshots}
              onChange={(nextStep) => {
                setKnowledgeStep(nextStep);
                setSelectedItem(undefined);
              }}
            />
          )}

          <section
            key={revision}
            className="grid gap-10 rounded-2xl border bg-card/40 p-5 sm:p-8 lg:grid-cols-2 lg:gap-12 lg:p-10"
            aria-label={`${viewMode} by client`}
          >
            {snapshots.map((machine, index) => (
              <DeviceSequence
                key={machine.id}
                machine={machine}
                deviceLetter={String.fromCharCode(65 + index)}
                viewMode={viewMode}
                events={messageDebugger.events}
                operations={messageDebugger.operations}
                knownOperationIds={
                  messageDebugger
                    .operationKnowledgeAtStep(knowledgeStep)
                    .find((knowledge) => knowledge.id === machine.id)
                    ?.operationIds ?? []
                }
                snapshots={snapshots}
                onSelect={setSelectedItem}
              />
            ))}
          </section>
        </div>

        {selectedItem && (
          <DetailsPanel
            selectedItem={selectedItem}
            snapshots={snapshots}
            onClose={() => setSelectedItem(undefined)}
          />
        )}
      </div>
    </main>
  );
}

function MessageComposer({
  directionReversed,
  messageKind,
  messageKey,
  value,
  source,
  target,
  onDirectionChange,
  onKindChange,
  onKeyChange,
  onValueChange,
  onSend,
}: {
  directionReversed: boolean;
  messageKind: MessageKind;
  messageKey: string;
  value: string;
  source: DebuggerMachineSnapshot;
  target: DebuggerMachineSnapshot;
  onDirectionChange: () => void;
  onKindChange: (kind: MessageKind) => void;
  onKeyChange: (key: string) => void;
  onValueChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <Card className="mb-6">
      <CardContent className="grid gap-4 py-5 sm:grid-cols-2">
        <label className="text-sm font-medium">
          <span className="mb-1.5 block">Message</span>
          <select
            value={messageKind}
            onChange={(event) => onKindChange(event.target.value as MessageKind)}
            className={inputClassName}
          >
            <option value="set_value">Set value</option>
            <option value="delete">Delete</option>
            <option value="subscribe">Subscribe</option>
            <option value="unsubscribe">Unsubscribe</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          <span className="mb-1.5 block">Key</span>
          <input
            required
            value={messageKey}
            onChange={(event) => onKeyChange(event.target.value)}
            className={inputClassName}
          />
        </label>
        {messageKind === 'set_value' && (
          <label className="text-sm font-medium sm:col-span-2">
            <span className="mb-1.5 block">Value</span>
            <input
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              className={inputClassName}
              placeholder="JSON or plain text"
            />
          </label>
        )}
        <div className="flex gap-3 sm:col-span-2 sm:justify-end">
          <button
            type="button"
            onClick={onDirectionChange}
            aria-label={`Reverse direction. Currently ${source.label} to ${target.label}.`}
            className="grid h-10 min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-xs"
          >
            <span className="truncate font-semibold">Client A</span>
            <ArrowRight
              className={`size-4 transition-transform duration-300 ${
                directionReversed ? 'rotate-180' : ''
              }`}
            />
            <span className="truncate font-semibold">Client B</span>
          </button>
          <Button
            type="button"
            onClick={onSend}
            disabled={messageKey.trim().length === 0}
          >
            <Send /> Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function OperationKnowledgeTimeline({
  steps,
  value,
  snapshots,
  onChange,
}: {
  steps: readonly DebuggerOperationKnowledgeStep[];
  value: number;
  snapshots: readonly DebuggerMachineSnapshot[];
  onChange: (value: number) => void;
}) {
  const currentStep = value === 0 ? undefined : steps[value - 1];

  return (
    <div className="mb-6 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Operation knowledge</p>
          <p className="text-sm text-muted-foreground">
            {currentStep
              ? knowledgeStepDescription(currentStep, snapshots)
              : 'Before either client knows an operation'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="mr-1 font-mono text-xs text-muted-foreground">
            Time {value} of {steps.length}
          </span>
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Previous knowledge step"
            disabled={value === 0}
            onClick={() => onChange(value - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Next knowledge step"
            disabled={value === steps.length}
            onClick={() => onChange(value + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(steps.length, 1)}
        step={1}
        value={value}
        disabled={steps.length === 0}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Operation knowledge timeline position"
        className="mt-4 w-full accent-sky-600 disabled:opacity-40"
      />
      <div className="mt-1 flex justify-between font-mono text-xs text-muted-foreground">
        <span>start</span>
        <span>{steps.length}</span>
      </div>
    </div>
  );
}

function DeviceSequence({
  machine,
  deviceLetter,
  viewMode,
  events,
  operations,
  knownOperationIds,
  snapshots,
  onSelect,
}: {
  machine: DebuggerMachineSnapshot;
  deviceLetter: string;
  viewMode: ViewMode;
  events: readonly DebuggerMessageEvent[];
  operations: readonly DebuggerOperationRecord[];
  knownOperationIds: readonly string[];
  snapshots: readonly DebuggerMachineSnapshot[];
  onSelect: (item: SelectedItem) => void;
}) {
  const machineEvents = events.filter(
    (event) =>
      event.sourceMachineId === machine.id || event.targetMachineId === machine.id
  );
  const knownOperationIdSet = new Set(knownOperationIds);
  const machineOperations = operations.filter((operation) =>
    knownOperationIdSet.has(operation.id)
  );

  return (
    <article className="min-w-0">
      <p className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {machine.role}
      </p>
      <div className="mx-auto mt-3 flex size-24 items-center justify-center rounded-full border-2 bg-background text-4xl font-bold shadow-sm">
        {deviceLetter}
      </div>
      <h2 className="mt-3 text-center text-lg font-semibold">{machine.label}</h2>
      <div className="mx-auto h-9 w-px bg-border" aria-hidden="true" />

      <div className="mx-auto max-w-xl overflow-hidden rounded-xl border bg-background shadow-sm">
        {viewMode === 'events' ? (
          machineEvents.length > 0 ? (
            <ol className="divide-y">
              {machineEvents.map((event) => (
                <SequenceRow
                  key={event.id}
                  identifier={identifierForSequence(event.sequence)}
                  title={eventTitle(event)}
                  description={relationshipLabel(machine.id, event, snapshots)}
                  onClick={() =>
                    onSelect({ kind: 'event', machineId: machine.id, item: event })
                  }
                />
              ))}
            </ol>
          ) : (
            <EmptySequence label="events" />
          )
        ) : machineOperations.length > 0 ? (
          <ol className="divide-y">
            {machineOperations.map((operation) => (
              <SequenceRow
                key={operation.id}
                identifier={identifierForSequence(operation.operationSequence)}
                title={operation.operation.type}
                description={relationshipLabel(
                  machine.id,
                  operation,
                  snapshots
                )}
                onClick={() =>
                  onSelect({
                    kind: 'operation',
                    machineId: machine.id,
                    item: operation,
                  })
                }
              />
            ))}
          </ol>
        ) : (
          <EmptySequence label="operations" />
        )}
      </div>
    </article>
  );
}

function SequenceRow({
  identifier,
  title,
  description,
  onClick,
}: {
  identifier: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="grid w-full grid-cols-[2.5rem_1fr_auto] items-center gap-3 p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-4"
      >
        <span className="flex size-9 items-center justify-center rounded-md bg-primary font-mono text-sm font-bold text-primary-foreground">
          {identifier}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-mono text-sm font-semibold">
            {title}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {description}
          </span>
        </span>
        <ChevronRight className="size-5 text-muted-foreground" />
      </button>
    </li>
  );
}

function EmptySequence({ label }: { label: string }) {
  return (
    <p className="p-8 text-center text-sm text-muted-foreground">
      No {label} known yet
    </p>
  );
}

function DetailsPanel({
  selectedItem,
  snapshots,
  onClose,
}: {
  selectedItem: SelectedItem;
  snapshots: readonly DebuggerMachineSnapshot[];
  onClose: () => void;
}) {
  const sequence =
    selectedItem.kind === 'event'
      ? selectedItem.item.sequence
      : selectedItem.item.operationSequence;
  const title =
    selectedItem.kind === 'event'
      ? eventTitle(selectedItem.item)
      : selectedItem.item.operation.type;
  const machine = snapshots.find(
    (snapshot) => snapshot.id === selectedItem.machineId
  );

  return (
    <>
      <button
        type="button"
        aria-label="Close details"
        className="fixed inset-0 z-[70] bg-black/35 md:hidden"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="debugger-detail-title"
        className="fixed inset-x-0 bottom-0 z-[71] max-h-[82vh] overflow-y-auto rounded-t-2xl border bg-background p-5 shadow-2xl sm:p-6 md:sticky md:inset-auto md:top-20 md:z-auto md:max-h-[calc(100vh-6rem)] md:w-auto md:rounded-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary font-mono font-bold text-primary-foreground">
              {identifierForSequence(sequence)}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {selectedItem.kind} on {machine?.label}
              </p>
              <h2 id="debugger-detail-title" className="truncate text-xl font-bold">
                {title}
              </h2>
            </div>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={onClose}>
            <X />
            <span className="sr-only">Close details</span>
          </Button>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <DetailTerm label="Source" value={machineLabel(snapshots, selectedItem.item.sourceMachineId)} />
          <DetailTerm label="Target" value={machineLabel(snapshots, selectedItem.item.targetMachineId)} />
          {selectedItem.kind === 'operation' && (
            <>
              <DetailTerm label="Key" value={selectedItem.item.key} />
              <DetailTerm label="Status" value={selectedItem.item.status.status} />
            </>
          )}
        </dl>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Raw details
        </p>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-muted p-4 text-xs">
          {JSON.stringify(selectedItem.item, null, 2)}
        </pre>
      </aside>
    </>
  );
}

function DetailTerm({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate font-medium">{value}</dd>
    </div>
  );
}

function ViewButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
        selected
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function identifierForSequence(sequence: number): string {
  const zeroBased = sequence - 1;
  const letter = String.fromCharCode(65 + (zeroBased % 26));
  return letter.repeat(Math.floor(zeroBased / 26) + 1);
}

function eventTitle(event: DebuggerMessageEvent): string {
  if (event.message.type === 'op') return event.message.operation.type;
  if (event.message.type === 'op_status') {
    return `operation ${event.message.status}`;
  }
  return event.message.type;
}

function relationshipLabel(
  machineId: string,
  item: DebuggerMessageEvent | DebuggerOperationRecord,
  snapshots: readonly DebuggerMachineSnapshot[]
): string {
  const sent = item.sourceMachineId === machineId;
  const otherId = sent ? item.targetMachineId : item.sourceMachineId;
  return `${sent ? 'Sent to' : 'Received from'} ${machineLabel(
    snapshots,
    otherId
  )}`;
}

function knowledgeStepDescription(
  step: DebuggerOperationKnowledgeStep,
  snapshots: readonly DebuggerMachineSnapshot[]
): string {
  const machine = machineLabel(snapshots, step.machineId);
  const otherMachine = machineLabel(snapshots, step.otherMachineId);
  const operationId = identifierForSequence(step.operationSequence);
  return step.kind === 'created'
    ? `${machine} created operation ${operationId}`
    : `${machine} learned operation ${operationId} from ${otherMachine}`;
}

function machineLabel(
  snapshots: readonly DebuggerMachineSnapshot[],
  machineId: string
): string {
  return snapshots.find((machine) => machine.id === machineId)?.label ?? machineId;
}

function createMessage(
  kind: MessageKind,
  key: string,
  value: string
): DebuggerInputMessage {
  if (kind === 'subscribe' || kind === 'unsubscribe') {
    return { type: kind, key };
  }
  if (kind === 'delete') {
    return { type: 'op', key, operation: { type: 'delete' } };
  }
  return {
    type: 'op',
    key,
    operation: { type: 'set_value', data: parseValue(value) },
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
  'h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40';

function supportsKnowledgeTimeline(
  messageDebugger: InMemoryMessageDebugger
): boolean {
  const runtimeDebugger = messageDebugger as unknown as Record<string, unknown>;
  return (
    Array.isArray(runtimeDebugger['operationKnowledgeSteps']) &&
    typeof runtimeDebugger['operationKnowledgeAtStep'] === 'function'
  );
}
