import { describe, expect, test } from 'vitest';

import { InMemoryMessageDebugger } from './in-memory-message-debugger';

function createDebugger() {
  return new InMemoryMessageDebugger([
    { id: 'client', label: 'Client A', role: 'client' },
    { id: 'server', label: 'Server B', role: 'server' },
  ]);
}

describe('InMemoryMessageDebugger', () => {
  test('exposes its runtime API version for preserved-instance compatibility', () => {
    expect(createDebugger().apiVersion).toBe(
      InMemoryMessageDebugger.apiVersion
    );
  });

  test('records an operation, status, and resulting target state', () => {
    const messageDebugger = createDebugger();

    const emitted = messageDebugger.send('client', 'server', {
      type: 'op',
      key: 'draft.title',
      operation: { type: 'set_value', data: 'Hello' },
    });

    expect(emitted.map((event) => event.message.type)).toEqual([
      'op',
      'op_status',
      'state',
    ]);
    expect(emitted[1].message).toEqual({
      type: 'op_status',
      status: 'success',
    });
    expect(messageDebugger.machines[1].values['draft.title']).toEqual({
      kind: 'value',
      value: 'Hello',
    });
    expect(messageDebugger.operations).toEqual([
      expect.objectContaining({
        id: 'operation-1',
        operationSequence: 1,
        messageSequence: 1,
        sourceMachineId: 'client',
        targetMachineId: 'server',
        key: 'draft.title',
        operation: { type: 'set_value', data: 'Hello' },
        status: { type: 'op_status', status: 'success' },
        targetStateBefore: { kind: 'absent', reason: 'not_found' },
        targetStateAfter: { kind: 'value', value: 'Hello' },
      }),
    ]);
  });

  test('makes unsupported operation rejection visible without changing state', () => {
    const messageDebugger = createDebugger();

    const emitted = messageDebugger.send('client', 'server', {
      type: 'op',
      key: 'counter',
      operation: { type: 'increment', data: 1 },
    });

    expect(emitted[1].message).toMatchObject({
      type: 'op_status',
      status: 'error',
      error: { code: 'unsupported_operation' },
    });
    expect(emitted[2].message).toEqual({
      type: 'state',
      key: 'counter',
      state: { kind: 'absent', reason: 'not_found' },
    });
  });

  test('returns current state in response to a subscription', () => {
    const messageDebugger = createDebugger();
    messageDebugger.send('client', 'server', {
      type: 'op',
      key: 'status',
      operation: { type: 'set_value', data: 'ready' },
    });
    messageDebugger.clearEvents();

    const emitted = messageDebugger.send('client', 'server', {
      type: 'subscribe',
      key: 'status',
    });

    expect(emitted.map((event) => event.message.type)).toEqual([
      'subscribe',
      'state',
    ]);
    expect(messageDebugger.events).toHaveLength(2);
  });

  test('reconstructs machine state at each operation point', () => {
    const messageDebugger = createDebugger();
    messageDebugger.send('client', 'server', {
      type: 'op',
      key: 'count',
      operation: { type: 'set_value', data: 1 },
    });
    messageDebugger.send('client', 'server', {
      type: 'op',
      key: 'count',
      operation: { type: 'set_value', data: 2 },
    });
    messageDebugger.send('server', 'client', {
      type: 'op',
      key: 'reply',
      operation: { type: 'set_value', data: 'ack' },
    });

    expect(messageDebugger.machinesAtOperationCount(0)).toEqual([
      expect.objectContaining({ id: 'client', values: {} }),
      expect.objectContaining({ id: 'server', values: {} }),
    ]);
    expect(messageDebugger.machinesAtOperationCount(1)[1].values).toEqual({
      count: { kind: 'value', value: 1 },
    });
    expect(messageDebugger.machinesAtOperationCount(3)).toEqual([
      expect.objectContaining({
        id: 'client',
        values: { reply: { kind: 'value', value: 'ack' } },
      }),
      expect.objectContaining({
        id: 'server',
        values: { count: { kind: 'value', value: 2 } },
      }),
    ]);
  });

  test('advances operation knowledge one machine at a time', () => {
    const messageDebugger = createDebugger();
    messageDebugger.send('client', 'server', {
      type: 'op',
      key: 'title',
      operation: { type: 'set_value', data: 'Hello' },
    });

    expect(messageDebugger.operationKnowledgeSteps).toEqual([
      expect.objectContaining({
        sequence: 1,
        operationId: 'operation-1',
        machineId: 'client',
        otherMachineId: 'server',
        kind: 'created',
      }),
      expect.objectContaining({
        sequence: 2,
        operationId: 'operation-1',
        machineId: 'server',
        otherMachineId: 'client',
        kind: 'received',
      }),
    ]);
    expect(messageDebugger.operationKnowledgeAtStep(0)).toEqual([
      expect.objectContaining({ id: 'client', operationIds: [] }),
      expect.objectContaining({ id: 'server', operationIds: [] }),
    ]);
    expect(messageDebugger.operationKnowledgeAtStep(1)).toEqual([
      expect.objectContaining({
        id: 'client',
        operationIds: ['operation-1'],
      }),
      expect.objectContaining({ id: 'server', operationIds: [] }),
    ]);
    expect(messageDebugger.operationKnowledgeAtStep(2)).toEqual([
      expect.objectContaining({
        id: 'client',
        operationIds: ['operation-1'],
      }),
      expect.objectContaining({
        id: 'server',
        operationIds: ['operation-1'],
      }),
    ]);
  });
});
