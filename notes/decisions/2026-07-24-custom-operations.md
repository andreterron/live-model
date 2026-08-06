# Custom Operations

- Date: 2026-07-24
- Status: Current, revisitable

## Amendment: Live metadata is part of state

On 2026-08-05, Live metadata became part of the same reactive state and
history as its value. Value states require metadata, absent states may retain
metadata, and loading states do not contain metadata:

```ts
type LiveState<T> = { kind: 'loading' } | { kind: 'absent'; reason?: AbsentReason; metadata?: LiveMetadata } | { kind: 'value'; value: T; metadata: LiveMetadata };
```

The core `set_metadata` operation replaces metadata without changing the
value. It is recognized independently of custom operation handlers and is
available through `live.setMetadata(metadata)`. `set_value` preserves existing
metadata. Metadata stores registered operation-set IDs because runtime schemas
and reducers are not serializable.

Storage and wire snapshots carry value and metadata together so subscribers
observe one atomic Live state. Authorization, compatibility validation,
operation-set registration, and history dependencies remain deferred.

Only root operation-set assignment is currently supported. Property fields are
ordinary JSON fields updated through the root `set_value`, so `op_set.props` is
deferred until properties have independent Live identities and histories. The
complete rationale and persistence decisions are recorded in
[Live metadata and operation-set assignment](./2026-08-06-live-metadata.md).

## Amendment: reusable runtime type definitions

On 2026-08-04, `buildType(name)` introduced reusable runtime operation
definitions. Each operation now has its name, a Zod argument schema (an
internal `z.undefined()` schema for argumentless operations), and an optional
reducer. `OperationOfType<T>` derives the serialized operation union from the
runtime definition.

The fluent builder is itself the immutable definition. It has no terminal
`.get()` step; future client registration can perform any additional build or
indexing work.

This is additive to the operation union used by `Live`; type definitions are
not assigned to Lives yet. A missing reducer means reducing that operation
returns the current state unchanged. The initial definition-only array type
uses that behavior. See [Type definitions](../garden/type-definitions.md).

## Amendment: operation unions on `Live`

On 2026-07-28, the second `Live<T, OPS>` parameter changed from an
operation-definition map to a discriminated union of serialized operations:

```ts
type CounterOperations = { type: 'set_value'; data: number } | { type: 'increment'; data: number } | { type: 'delete' };
```

`Live<T>` now defaults `OPS` to the generic `Operation` envelope. This lets
backend routing pass wire operations directly to `live.op(operation)` without
casting. A specialized Live can still supply a narrower union to type both
operation objects and ergonomic `op(name, data)` calls.

Handler maps remain the convenient declaration form for derived Lives, but
`OperationsFromHandlers` now converts them to an operation union. The
definition-map and `OperationOf` utilities remain available as construction
helpers; they are no longer the representation used by `Live` itself.

## Context

Lives originally supported only `set_value` and `delete`. Their types,
developer API, protocol representations, and implementations were fixed to
those two operations.

Collections, counters, and application-specific data need operations such as
`insert` and `increment`. The API should type those operations without
prematurely requiring a reducer registry, event-sourcing implementation, or
CRDT history model.

## Decisions

### A Live declares an operation-definition map

`Live` has an operation-definition type parameter:

```ts
Live<T, OPS>;
```

An operation family is represented as a map whose values are definition
objects:

```ts
type CounterOperations = {
  set_value: { data: number };
  increment: { data: number };
  delete: object;
};
```

Definition values are objects rather than only argument types. This is
slightly more verbose, but leaves room for future definition metadata without
changing the overall shape.

A required `data` property means the operation takes an argument. A definition
without `data` describes an argumentless operation.

### Operation definitions produce serializable operation unions

`OperationOf<OPS>` converts a definition map into a discriminated union:

```ts
type CounterOperation = { type: 'set_value'; data: number } | { type: 'increment'; data: number } | { type: 'delete' };
```

The definition map is convenient for selecting an operation by name, while the
union is convenient for storage, forwarding, and protocol messages.

### The existing operations use the custom-operation types first

`set_value` and `delete` were migrated before adding new operation families:

```ts
type DefaultOperations<T> = {
  set_value: { data: T };
  delete: object;
};
```

`DefaultOperations<T>` remains the default `OPS` argument for compatibility
with existing Lives. This exercises the generic design through the current
memory, storage, local-storage, WebSocket, backend, derived, model, and React
paths before introducing a new mutation.

### `op` accepts ergonomic calls and operation objects

Callers can invoke an operation by name:

```ts
live.op('set_value', value);
live.op('delete');
```

They can also pass its serializable object:

```ts
live.op({ type: 'set_value', data: value });
live.op({ type: 'delete' });
```

The name form is the primary developer interface. The object form allows
transports, backend registries, storage, and other forwarding boundaries to
pass an operation through without unpacking and reconstructing it.

### `setValue` and `deleteValue` delegate to `op`

The existing convenience methods remain available for now, but they enter the
same operation path:

```ts
setValue(value) -> op('set_value', value)
deleteValue()   -> op('delete')
```

The operation type parameter does not require every Live to support these
operations. The methods use a temporary type escape internally because their
long-term relationship to capability-specific Lives is not yet settled.

### Operation application remains owned by Lives

This change introduces the shared operation interface but does not introduce
reducers or a runtime operation registry. Existing Live implementations
continue to own mutation, persistence, and notification behavior.

`BaseLive` handles the two default operations through protected application
hooks. Lives with specialized persistence or custom operations can override
`op`.

### Derived Lives expose only mapped operations

`mapState`, `mapValue`, `useDerived`, and `useDerivedValue` accept an operation
handler map:

```ts
const derived = mapValue(source, transform, {
  increment: (source, amount: number) => {
    // Map the derived operation to the source Live.
  },
  reset: (source) => {
    // Argumentless operation.
  },
});
```

Handler keys define the derived Live's operation names. A handler's first
parameter is always the source Live. Its optional second parameter is the
operation data and determines the operation argument type.

A derivation without handlers has an empty operation set. Omitting an
operation is preferred to defining a no-op handler, so the unsupported
operation is absent from both the type and runtime handler list.

The previous positional setter and deleter parameters were removed.
`LiveSetter` and `LiveDeleter` were also removed. The remaining `setter` and
`deleter` helpers produce source-first operation handlers for handler maps.

### Operation processing remains synchronous

`op` continues returning the current synchronous `OperationResult`. Custom
operations do not change the earlier decision to defer asynchronous operation
processing until operation propagation and acknowledgment behavior are
designed.

## Deferred questions

### Runtime operation definitions

TypeScript operation definitions disappear at runtime. Validation schemas,
reducers, authorization, codecs, versions, and typed results may eventually
extend operation definitions or use a separate runtime definition.

The protocol now forwards a generic operation envelope. Runtime definitions
can validate custom operation arguments once operation-set registration and
assignment are connected to addressed Lives.

### Operations as durable source of truth

Operations are expected to become candidates for durable source-of-truth data,
but persistence, snapshots, replay, compaction, and schema evolution are not
part of this change.

### Causality, batching, and CRDT data

This design does not introduce Automerge-style Changes or Transactions.
Each operation remains its own unit for now. Dependencies, causal heads,
branching, conflict behavior, stable collection positions, and grouping
multiple operations into one committed change remain future work.

If batching becomes necessary, existing operations can later be placed inside
a Change-like envelope without changing the `live.op(name, data)` developer
interface.

### Derived and non-CRDT data

Derived Lives currently map supported operations back to a source Live.
How operations propagate through materialized derived Lives, span several
Lives, or coexist with state-only and non-CRDT sources remains unsettled.

### Variance and source operation types

`Live<T, OPS>` is invariant because `OPS` controls `op` parameters. The current
derived APIs accept source Lives with the default operation family. Supporting
arbitrary source operation families may require a separate readable Live
interface or deliberate source-operation type extraction.
