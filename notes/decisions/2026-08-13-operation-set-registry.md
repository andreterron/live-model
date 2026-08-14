# Shared operation-set registry and processing

- Date: 2026-08-13
- Status: Initial implementation

## Context

Live metadata can assign an operation set through `metadata.op_set.root`, but
operation processing previously used a handler map fixed when `StorageLive` was
constructed. That map could not react when `set_metadata` changed the
assignment, and it did not connect runtime type definitions to processing.

Operation-set definitions and processing are also useful outside the backend.
A frontend may eventually validate or optimistically reduce an operation before
the canonical backend result arrives.

## Decisions

### The registry is shared infrastructure

`OperationSetRegistry` lives in the `live-model` package and has no storage,
transport, or backend dependency. Both backend and frontend code can register
the same executable definitions. `BackendLiveModel` and `LiveModelClient` each
expose a registry and accept an injected registry, but it remains independently
constructible and usable.

The operation-set definition's `name` is its registry ID and the value stored
in `metadata.op_set.root`. IDs are intentionally not versioned yet.

### Dispatch uses canonical metadata for every operation

For each non-metadata operation, `StorageLive` reads the current state from its
storage adapter and passes it to `OperationSetRegistry.process(state,
operation)`. The registry resolves `state.metadata.op_set.root`; it does not
accept an operation-set ID from the incoming operation. `StorageLive` does not
cache a selected handler on construction. Consequently, a successful
`set_metadata` affects the very next operation without rebuilding the Live, and
frontend code can invoke the identical metadata-driven processing entry point.

An assigned but unregistered ID returns `unknown_operation_set`. An operation
that is absent from the selected definition returns `unsupported_operation`.
Schema failures return `invalid_operation`.

### Only `set_metadata` bypasses operation-set dispatch

`set_metadata` remains the sole core operation because it changes the metadata
used to select all other operations. `set_value` and `delete` do not bypass an
assigned operation set. If an assigned Live should accept either operation,
its operation-set definition must declare it.

Every registry automatically registers the `default` operation set. A Live
with no root assignment resolves to `default`, which declares `set_value` and
`delete` and implements them through normal registry handlers. They are
therefore defaults, not core operations: assigning any other operation set
removes them unless that definition explicitly declares them.

### Processing produces storage-independent effects

The registry validates the operation and produces one of three effects:

- `unchanged`: the operation was accepted but does not change materialized
  state;
- `set`: replace the materialized value;
- `delete`: remove the materialized value.

A definition reducer automatically produces a `set` effect. An operation with
neither a reducer nor an explicit handler produces `unchanged`, preserving the
existing optional-reducer semantics. Reducers currently require a value state.

Registrations may provide explicit handlers for effects that cannot be
expressed as a value-to-value reducer, particularly deletion. Handlers are
declared only for operations present in the definition and receive the current
`LiveState` plus the schema-parsed operation. They return effects rather than
calling storage, so the same processing abstraction can be used in different
environments.

### Metadata assignment is schema-validated, not registry-validated

`set_metadata` does not currently reject an unknown registry ID. This keeps
metadata storage independent from any one registry instance and permits
definitions to be registered later. Processing an operation against that
assignment fails explicitly until the ID is registered. Authorization and
assignment compatibility validation remain future work.

## Consequences and follow-up

- Backend operations now select definitions dynamically from persisted
  metadata.
- `LiveModelClient` exposes the shared registry, but `WebSocketLive` is not yet
  wired for registry-based optimistic processing.
- Explicit handlers provide deletion today without making `delete` core.
- The automatically registered `default` operation set preserves conventional
  creation, replacement, and deletion behavior for unassigned Lives.
- Concurrent or asynchronous processors will eventually need atomic or
  per-key-serialized metadata reads and state writes.

### Current effect model does not cover collection writes

`OperationSetProcessingResult` currently describes only what happens to the
Live key being processed: leave it unchanged, replace its value, or delete it.
That is insufficient for collection operations whose materialization is stored
elsewhere. For example, an array `insert` may need to issue a SQL insert that
creates a new row rather than replacing the array value at the current key.

We are intentionally deferring that effect design until after the website can
exercise metadata-selected operation sets. A follow-up should decide whether
processing returns commands, transaction-scoped effects, or delegates to a
storage-aware handler while preserving shared validation and dispatch.
