import {
  BackendLiveModel,
  LiveState,
  type LiveMetadata,
  type Operation,
  type OperationMessage,
  type OperationStatusMessage,
  type StateMessage,
  type StorageAdapter,
  type SubscribeMessage,
  type UnsubscribeMessage,
} from 'live-model';

export interface DebuggerMachine {
  id: string;
  label: string;
  role: string;
}

export type DebuggerInputMessage =
  | OperationMessage
  | SubscribeMessage
  | UnsubscribeMessage;

export type DebuggerRecordedMessage =
  | DebuggerInputMessage
  | OperationStatusMessage
  | StateMessage;

export interface DebuggerMessageEvent {
  id: string;
  sequence: number;
  sourceMachineId: string;
  targetMachineId: string;
  message: DebuggerRecordedMessage;
}

export interface DebuggerOperationRecord {
  id: string;
  operationSequence: number;
  messageSequence: number;
  sourceMachineId: string;
  targetMachineId: string;
  key: string;
  operation: Operation;
  status: OperationStatusMessage;
  targetStateBefore: LiveState<unknown>;
  targetStateAfter: LiveState<unknown>;
}

export interface DebuggerOperationKnowledgeStep {
  id: string;
  sequence: number;
  operationId: string;
  operationSequence: number;
  machineId: string;
  otherMachineId: string;
  kind: 'created' | 'received';
}

export interface DebuggerMachineOperationKnowledge extends DebuggerMachine {
  operationIds: readonly string[];
}

export interface DebuggerMachineSnapshot extends DebuggerMachine {
  values: Readonly<Record<string, LiveState<unknown>>>;
}

class DebuggerStorage implements StorageAdapter {
  private readonly values = new Map<string, LiveState<unknown>>();

  get(key: string): LiveState<unknown> {
    return this.values.get(key) ?? LiveState.absent('not_found');
  }

  listKeys(): string[] {
    return [...this.values.entries()]
      .filter(([, state]) => state.kind === 'value')
      .map(([key]) => key);
  }

  set(key: string, data: unknown): boolean {
    const state = this.values.get(key);
    const metadata =
      state?.kind === 'loading' || !state ? undefined : state.metadata;
    this.values.set(key, LiveState.value(data, metadata));
    return true;
  }

  setMetadata(key: string, metadata: LiveMetadata): boolean {
    const state = this.values.get(key);
    if (!state || state.kind === 'loading') {
      return false;
    }

    this.values.set(
      key,
      state.kind === 'value'
        ? LiveState.value(state.value, metadata)
        : LiveState.absent(state.reason, state.error, metadata)
    );
    return true;
  }

  delete(key: string): boolean {
    this.values.set(key, LiveState.absent('deleted'));
    return true;
  }

  snapshot(): Readonly<Record<string, LiveState<unknown>>> {
    return Object.fromEntries(this.values);
  }
}

interface MachineRuntime {
  machine: DebuggerMachine;
  storage: DebuggerStorage;
  liveModel: BackendLiveModel;
}

/**
 * A synchronous, local-only protocol simulator intended for visual tooling.
 * It does not open sockets or mutate the production Live Model client.
 */
export class InMemoryMessageDebugger {
  static readonly apiVersion = 2;
  readonly apiVersion = InMemoryMessageDebugger.apiVersion;

  private readonly runtimes = new Map<string, MachineRuntime>();
  private readonly eventLog: DebuggerMessageEvent[] = [];
  private readonly operationLog: DebuggerOperationRecord[] = [];
  private readonly operationKnowledgeLog: DebuggerOperationKnowledgeStep[] = [];
  private nextSequence = 1;

  constructor(machines: readonly DebuggerMachine[]) {
    if (machines.length < 2) {
      throw new Error('InMemoryMessageDebugger requires at least two machines');
    }

    for (const machine of machines) {
      if (this.runtimes.has(machine.id)) {
        throw new Error(`Duplicate debugger machine id "${machine.id}"`);
      }

      const storage = new DebuggerStorage();
      this.runtimes.set(machine.id, {
        machine: { ...machine },
        storage,
        liveModel: new BackendLiveModel(storage),
      });
    }
  }

  get events(): readonly DebuggerMessageEvent[] {
    return this.eventLog;
  }

  get operations(): readonly DebuggerOperationRecord[] {
    return this.operationLog;
  }

  get operationKnowledgeSteps(): readonly DebuggerOperationKnowledgeStep[] {
    return this.operationKnowledgeLog;
  }

  get machines(): readonly DebuggerMachineSnapshot[] {
    return [...this.runtimes.values()].map(({ machine, storage }) => ({
      ...machine,
      values: storage.snapshot(),
    }));
  }

  machinesAtOperationCount(
    operationCount: number
  ): readonly DebuggerMachineSnapshot[] {
    if (
      !Number.isInteger(operationCount) ||
      operationCount < 0 ||
      operationCount > this.operationLog.length
    ) {
      throw new Error(
        `Operation count must be between 0 and ${this.operationLog.length}`
      );
    }

    const valuesByMachine = new Map<string, Record<string, LiveState<unknown>>>(
      [...this.runtimes.keys()].map((id) => [id, {}])
    );

    for (const operation of this.operationLog.slice(0, operationCount)) {
      valuesByMachine.get(operation.targetMachineId)![operation.key] =
        operation.targetStateAfter;
    }

    return [...this.runtimes.values()].map(({ machine }) => ({
      ...machine,
      values: valuesByMachine.get(machine.id)!,
    }));
  }

  operationKnowledgeAtStep(
    stepCount: number
  ): readonly DebuggerMachineOperationKnowledge[] {
    if (
      !Number.isInteger(stepCount) ||
      stepCount < 0 ||
      stepCount > this.operationKnowledgeLog.length
    ) {
      throw new Error(
        `Operation knowledge step must be between 0 and ${this.operationKnowledgeLog.length}`
      );
    }

    const operationIdsByMachine = new Map<string, string[]>(
      [...this.runtimes.keys()].map((id) => [id, []])
    );

    for (const step of this.operationKnowledgeLog.slice(0, stepCount)) {
      operationIdsByMachine.get(step.machineId)!.push(step.operationId);
    }

    return [...this.runtimes.values()].map(({ machine }) => ({
      ...machine,
      operationIds: operationIdsByMachine.get(machine.id)!,
    }));
  }

  send(
    sourceMachineId: string,
    targetMachineId: string,
    message: DebuggerInputMessage
  ): readonly DebuggerMessageEvent[] {
    this.requireMachine(sourceMachineId);
    const target = this.requireMachine(targetMachineId);
    const emitted = [this.record(sourceMachineId, targetMachineId, message)];

    if (message.type === 'op') {
      const targetStateBefore = target.liveModel.forKey(message.key).get();
      const status = target.liveModel.processOperation(
        message.key,
        message.operation
      );
      const targetStateAfter = target.liveModel.forKey(message.key).get();
      const operationRecord: DebuggerOperationRecord = {
        id: `operation-${this.operationLog.length + 1}`,
        operationSequence: this.operationLog.length + 1,
        messageSequence: emitted[0].sequence,
        sourceMachineId,
        targetMachineId,
        key: message.key,
        operation: message.operation,
        status,
        targetStateBefore,
        targetStateAfter,
      };
      this.operationLog.push(operationRecord);
      this.recordOperationKnowledge(
        operationRecord,
        sourceMachineId,
        targetMachineId,
        'created'
      );
      this.recordOperationKnowledge(
        operationRecord,
        targetMachineId,
        sourceMachineId,
        'received'
      );
      emitted.push(this.record(targetMachineId, sourceMachineId, status));
      emitted.push(
        this.record(targetMachineId, sourceMachineId, {
          type: 'state',
          key: message.key,
          state: targetStateAfter,
        })
      );
    } else if (message.type === 'subscribe') {
      emitted.push(
        this.record(targetMachineId, sourceMachineId, {
          type: 'state',
          key: message.key,
          state: target.liveModel.forKey(message.key).get(),
        })
      );
    }

    return emitted;
  }

  clearEvents(): void {
    this.eventLog.length = 0;
  }

  clearHistory(): void {
    this.eventLog.length = 0;
    this.operationLog.length = 0;
    this.operationKnowledgeLog.length = 0;
  }

  private recordOperationKnowledge(
    operation: DebuggerOperationRecord,
    machineId: string,
    otherMachineId: string,
    kind: DebuggerOperationKnowledgeStep['kind']
  ): void {
    const sequence = this.operationKnowledgeLog.length + 1;
    this.operationKnowledgeLog.push({
      id: `operation-knowledge-${sequence}`,
      sequence,
      operationId: operation.id,
      operationSequence: operation.operationSequence,
      machineId,
      otherMachineId,
      kind,
    });
  }

  private requireMachine(id: string): MachineRuntime {
    const runtime = this.runtimes.get(id);
    if (!runtime) {
      throw new Error(`Unknown debugger machine "${id}"`);
    }
    return runtime;
  }

  private record(
    sourceMachineId: string,
    targetMachineId: string,
    message: DebuggerRecordedMessage
  ): DebuggerMessageEvent {
    const sequence = this.nextSequence++;
    const event = {
      id: `message-${sequence}`,
      sequence,
      sourceMachineId,
      targetMachineId,
      message,
    };
    this.eventLog.push(event);
    return event;
  }
}
