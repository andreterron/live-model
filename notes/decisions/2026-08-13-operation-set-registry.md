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
operation, { key })`. The registry resolves `state.metadata.op_set.root`; it
does not accept an operation-set ID from the incoming operation. `StorageLive`
does not cache a selected handler on construction. Consequently, a successful
`set_metadata` affects the very next operation without rebuilding the Live,
and frontend code can invoke the identical metadata-driven processing entry
point.

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

The registry validates the operation and returns a list of keyed, declarative
effects. The initial effect vocabulary is:

- `set`: create or replace the materialized value at a key;
- `set_metadata`: replace the materialized metadata at a key;
- `delete`: remove the materialized value at a key.

A definition reducer automatically produces a `set` effect targeting the key
whose operation is being processed. An operation with neither a reducer nor an
explicit handler produces an empty effect list, preserving the existing
optional-reducer semantics. Reducers currently require a value state.

Registrations may provide explicit handlers for effects that cannot be
expressed as a value-to-value reducer. Handlers are declared only for
operations present in the definition and receive the current `LiveState`, the
schema-parsed operation, and a context containing the current key. They return
effects rather than calling storage, so one collection operation can create or
change other keyed rows without coupling its operation set to SQLite or another
adapter.

`StorageLive` currently applies the returned effects through `StorageAdapter`.
It refreshes affected cached backend Lives and key-membership queries. The
WebSocket frontend applies effects targeting its own key optimistically;
effects targeting other keys are left to canonical backend state messages.

### Metadata assignment is schema-validated, not registry-validated

`set_metadata` does not currently reject an unknown registry ID. This keeps
metadata storage independent from any one registry instance and permits
definitions to be registered later. Processing an operation against that
assignment fails explicitly until the ID is registered. Authorization and
assignment compatibility validation remain future work.

## Consequences and follow-up

- Backend operations now select definitions dynamically from persisted
  metadata.
- `LiveModelClient` exposes the shared registry, and `WebSocketLive` uses it for
  registry-based optimistic processing of effects targeting its key.
- Explicit handlers provide deletion today without making `delete` core.
- The automatically registered `default` operation set preserves conventional
  creation, replacement, and deletion behavior for unassigned Lives.
- Effect lists are currently applied sequentially. A later `StorageAdapter`
  transaction boundary must make multi-effect operations atomic and prevent a
  failed later effect from leaving earlier effects persisted.
- Concurrent or asynchronous processors will eventually need atomic or
  per-key-serialized metadata reads and state writes.

### Declarative effects are a transitional materialization model

`OperationSetProcessingResult` can now describe an array `insert` that creates
a different keyed row instead of replacing the collection's current value.
This is deliberately a small extension of the current synchronous processing
architecture, not the intended final persistence model.

The long-term direction is an operation-history projection model: accepted
operations are durably appended to their entity's history, and a
projector/materializer translates that history into storage-specific views such
as SQLite collection rows. That model should support replay, rebuilding
materialized state, and storage-specific projection logic without putting SQL
inside operation-set handlers. The keyed effect list is a stepping stone toward
that separation and should not prevent replacing direct execution with durable
history plus projections later.

### The Explorer multiset prototype stores an array of references

The website registers a provisional `multiset` operation set with `insert` and
`remove`. Both accept a reference to a root Live entity, not an entity ID plus
inline JSON. Creating or updating the referenced entity remains a separate
operation on that entity, preserving separate value and membership histories.
Removing a member changes only the multiset and does not delete the entity.

The current materialized value is a JSON array of references. `insert` appends
the reference even when it is already present, while `remove` removes one
matching occurrence. Array order is an implementation detail and is not part
of the exposed operation contract. This deliberately avoids committing to
uniqueness or conflict semantics while the collection model is still being
explored.
