# Causality package split

- Date planted: 2026-08-06
- Status: First package boundary implemented
- Confidence: Directional; responsibility boundaries are being mapped

Update (2026-08-07): the empty `@live-model/protocol` package was renamed to
`@live-model/causality`. The initial behavior-preserving split moves generic
operation envelopes, operation type utilities, and operation results. Live
state, key-addressed and query messages, materialization, and WebSocket sync
remain in `live-model`. Checkpoints and configurable causal mechanisms remain
notes only.

External consumers should normally import causality contracts through
`live-model`, which re-exports them. Direct imports are reserved for lower-level
packages that intentionally depend on causality without depending on
`live-model`. The website and the other current workspace consumers use the
`live-model` entry point.

## Motivation

Split some functionality away from `live-model` into a package provisionally
called `causality`.

The main motivation is to keep individual components of the library small,
which would be more manageable for humans and AIs working on the library.
There is a fine line between better organization and adding complexity for its
own sake. The library will likely change substantially, so this refactor could
be undone by a future change.

At the same time, this library is a way of researching data sync. This split
could give the layers above more freedom to iterate while retaining a strong
base layer for causality: sync messages, operations, and events. It is important
not to spend too much time on the split.

## Proposed package scope

The package would be responsible for:

1. Messages:
   - subscribe;
   - unsubscribe;
   - operation;
   - checkpoint.
2. Operations:
   - no specific operation would be defined;
   - an operation would only have `dependencies: OperationID[]`, `type: string`,
     and, if needed, `id: string`;
   - the package would maintain the operations known by that client, either in
     memory and/or in storage, probably using the existing `StorageAdapter` or
     something similar for now.
3. Transport between clients, or between client and server. If a transport
   needs a specific dependency, it would be in a separate package.
4. Branching. This is not implemented yet and should not be implemented as part
   of this refactor.
5. Subscriptions. These would not be by key. The package should expose a hook
   through which the consumer defines what to subscribe to from a subscribe
   message.

The package would not own:

- the concept of IDs for entities or values; consumers would define how to
  interpret operation, message, and subscription objects;
- any specific or special operations;
- querying.

Hooks that are expected to be needed:

- custom message handling;
- deciding whether an operation should be processed, for example to check
  whether an entity supports the operation or to perform authorization.

For matching operations to subscriptions, the current direction is to use
consumer hooks. One hook could map a subscription message to a subscription ID:

```ts
(subscriptionMessage, ...) => string
```

Another could map an operation to the subscription IDs that should be
notified:

```ts
async (operation, ...) => string[]
```

## Responsibility inventory

The inventory describes responsibilities rather than proposed files. Existing
files are listed only to show where each responsibility is represented today;
files and classes may be split during the refactor.

### Message contracts

Defines and validates subscribe, unsubscribe, operation, checkpoint, and
other wire-message envelopes without interpreting consumer payloads.

Current files: `packages/causality/src/message.ts`,
`packages/live-model/src/protocol.ts`.

### Operation envelope

Defines the generic operation shape and its causal identity and dependencies,
without defining operation-specific data or behavior.

Current files: `packages/causality/src/operation.ts`.

### Operation knowledge

Tracks which operations a client knows and provides in-memory and persistent
storage boundaries for that knowledge.

Current files: no dedicated file; materialized state is currently stored by
`packages/live-model/src/creators/storage-live.ts` instead.

### Transport coordination

Moves messages between peers and coordinates delivery independently of a
specific network library or runtime.

Current files: `packages/live-model/src/creators/web-socket/web-socket-transport.ts`,
`packages/api/src/websocket-handler.ts`.

### Subscription routing

Creates and removes subscriptions and uses consumer-provided mappings to decide
which subscriptions should receive an operation or checkpoint.

Current files: `packages/live-model/src/creators/web-socket/web-socket-transport.ts`,
`packages/api/src/websocket-handler.ts`.

### Extension and operation policy hooks

Delegates custom messages and the decision to process an operation to the
consumer, including capability and authorization checks.

Current files: `packages/live-model/src/protocol.ts`,
`packages/api/src/websocket-handler.ts` contain the closed dispatch paths that
these hooks would replace or extend.

### Checkpoint exchange

Carries a causal boundary together with opaque upper-layer content. The content
may be a snapshot, operations, a combination of them, or something else.

Current files: `packages/live-model/src/protocol.ts`,
`packages/live-model/src/creators/web-socket/web-socket-transport.ts`.

### Branching

Will represent divergent causal histories and their relationships. It is only
a future responsibility and is not implemented.

Current files: none.

### Addressing and entity identity

Interprets keys or other consumer-defined identifiers and decides what entity,
value, or target an operation or subscription refers to.

Current files: `packages/live-model/src/live-model-client.ts`,
`packages/live-model/src/backend-live-model.ts`,
`packages/live-model/src/model/generate-id.ts`.

### Operation definitions and semantics

Defines supported operation types, validates their payloads, and applies their
reducers or handlers to domain state.

Current files: `packages/live-model/src/type-definition.ts`,
`packages/live-model/src/types/array-type.ts`,
`packages/live-model/src/live.ts`,
`packages/live-model/src/creators/storage-live.ts`.

### Materialized state and metadata

Represents loading, absent, and value states plus Live metadata, and determines
how accepted operations change that state.

Current files: `packages/live-model/src/protocol.ts`,
`packages/live-model/src/live.ts`.

### Materialized state persistence

Stores and retrieves current values and metadata independently of the causal
operation-knowledge store.

Current files: `packages/live-model/src/creators/storage-live.ts`,
`packages/live-model/src/creators/local-storage-live.ts`,
`packages/api/src/storage-adapter/sqlite-storage-adapter.ts`.

### Reactive Live API

Exposes current materialized state, mutation methods, notifications, and local
subscription lifecycle to library consumers.

Current files: `packages/live-model/src/live.ts`,
`packages/live-model/src/reactivity/subscriber.ts`,
`packages/live-model/src/reactivity/subscription.ts`.

### Client and backend registries

Caches and resolves Live instances and connects addressed frontend and backend
state to transport and storage implementations.

Current files: `packages/live-model/src/live-model-client.ts`,
`packages/live-model/src/backend-live-model.ts`.

### References

Encodes references inside values and resolves them to other Live instances.

Current files: `packages/live-model/src/references.ts`.

### Derived Lives and operation mapping

Projects one Live into another view and maps operations on that view back to
the source Live.

Current files: `packages/live-model/src/operators/map.ts`,
`packages/live-model/src/setter.ts`, `packages/live-model/src/deleter.ts`.

### Entity models

Provides collection-like entity creation, selection, update, deletion, and ID
handling over materialized Lives.

Current files: `packages/live-model/src/model/model.ts`,
`packages/live-model/src/model/generate-id.ts`.

### Querying

Defines query sources, maintains query result membership, and transports query
subscriptions and snapshots.

Current files: `packages/live-model/src/query/query-source.ts`,
`packages/live-model/src/query/entities-query-source.ts`,
`packages/live-model/src/query/web-socket-query-source.ts`.

### Framework integration

Connects Live state, subscriptions, models, and client configuration to React's
rendering and context lifecycle.

Current files: `packages/live-model/src/react/use-live-model-client.tsx`,
`packages/live-model/src/react/use-live-state.tsx`,
`packages/live-model/src/react/use-subscribe.ts`,
`packages/live-model/src/react/use-derived.tsx`,
`packages/live-model/src/react/use-model.ts`.

### Concrete transport and runtime adapters

Adapts the transport boundary to WebSocket, HTTP, Node SQLite, and a runnable
server when those implementations require environment-specific dependencies.

Current files: `packages/live-model/src/creators/web-socket/web-socket-transport.ts`,
`packages/api/src/websocket-handler.ts`,
`packages/api/src/operations-request-handler.ts`,
`packages/api/src/storage-adapter/sqlite-storage-adapter.ts`,
`packages/server/src/index.ts`.

### Operation results and reconciliation

Reports acceptance or failure and reconciles locally forwarded operations with
messages returned by another peer.

Current files: `packages/causality/src/operation-result.ts`,
`packages/live-model/src/creators/web-socket/web-socket-transport.ts`,
`packages/api/src/websocket-handler.ts`.

## Checkpoints and snapshots

A checkpoint is a causality-owned shell event that replaces the complete
history before a causal point. That point is represented by the current
operation heads:

```ts
interface Checkpoint {
  type: 'checkpoint';
  heads: OperationID[];
}
```

The checkpoint does not have a separate `basis` or `coverage`. It is
self-contained: installing it replaces the history leading to its heads, and a
recipient does not need that replaced history first.

What a checkpoint carries beyond its heads belongs to the library consumer. It
may carry a materialized snapshot, operations, a combination of them, or
something else. Causality should not prescribe a concrete `contents` field. A
future API could make the complete checkpoint type generic, or let consumers
extend the shell with their own fields.

The consumer should produce and apply the customized checkpoint. Causality
should coordinate its delivery and reconciliation as far as that is required
to sync operations. The exact hook and acknowledgement boundary remain to be
defined.

A remaining problem is reconciling an operation that depends on an old
operation ID after the preceding graph has been removed. The checkpoint heads
are the chosen protocol representation; how causality recognizes an old
dependency as part of the replaced history depends on the causal mechanism and
is deferred.

These checkpoint ideas are notes only and are not part of the initial package
split.

## Configurable causal mechanisms

Causality may eventually allow the library consumer to configure the mechanism
used to identify operations, represent known history, compare histories, and
resolve dependencies. This does not need to be presented specifically as a
clock implementation, and there is no proposed generic `CausalClock`
interface.

Capabilities explored in earlier discussion are still likely to be useful to
consumers or to a future causality integration boundary:

- creating operation identity or causal metadata;
- merging known histories;
- determining whether a dependency is known;
- comparing histories as before, after, equal, or concurrent;
- parsing, validating, serializing, and persisting the consumer's
  representation.

They do not need to become one public interface. Causality should only require
the capabilities its sync algorithm actually needs.

### Owning the mechanism

If causality owns one mechanism, it can provide one interoperable wire and
storage format, enforce stronger invariants, and keep checkpoint,
reconciliation, and branching behavior easier to understand and test. The cost
is committing early to one set of replica identity and scalability tradeoffs.

### Delegating the mechanism

Delegating allows consumers to experiment with server sequences, version
vectors, interval tree clocks, or application-specific approaches while
keeping this package focused on sync. It also means peers and persisted history
must use compatible configurations, migrations become a consumer concern, and
causality can only guarantee the invariants established by the configured
behavior.

### Impact on causality responsibilities

The decision affects operation IDs and metadata, dependency checks, known
operation persistence, deduplication, reconciliation, missing-operation
selection, checkpoints, and future branching. Transport mechanics, custom
message handling, and most subscription routing should remain independent of
the representation.

The choice is intentionally deferred. The initial package split should not add
a generic mechanism interface or choose a sync algorithm before the existing
responsibilities have been isolated.

Earlier clock research remains useful background: [Lamport clocks](https://www.microsoft.com/en-us/research/publication/time-clocks-ordering-events-distributed-system/),
[vector timestamps](https://fileadmin.cs.lth.se/cs/Personal/Amr_Ergawy/dist-algos-papers/4.pdf),
[dotted version vectors](https://gsd.di.uminho.pt/members/vff/dotted-version-vectors-2012.pdf),
and [interval tree clocks](https://gsd.di.uminho.pt/members/cbm/ps/itc2008.pdf).

## Defined in the causality package

- Message contracts
- Operation envelope
- Operation knowledge
- Transport coordination
- Subscription routing
- Extension and operation policy hooks
- Checkpoint exchange
- Branching
- Operation results and reconciliation

## Defined outside the causality package

- Addressing and entity identity
- Operation definitions and semantics
- Querying
- Concrete transport and runtime adapters
- Reactive Live API
- References
- Derived Lives and operation mapping

## Not yet defined

- Materialized state and metadata
- Materialized state persistence
- Client and backend registries
- Entity models
- Framework integration
