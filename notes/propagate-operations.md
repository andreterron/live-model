# Propagating Operations Instead of State

## Status

This document explores an operation-first replication model for Live Model. It
is not yet an implementation plan or a settled protocol. Its purpose is to
capture the benefits, architectural implications, and areas that need thorough
validation before committing to the approach.

## Context

The current backend WebSocket handler subscribes to backend Lives. When a
client operation changes a Live, the Live publishes its resulting state to all
subscribers. The handler currently uses `suppressedNotification` to prevent the
state from being sent back to the peer that originated the operation.

The suppression exists because the originating client already applies its
operation optimistically:

1. Client A applies `set_value` locally.
2. Client A sends the operation to the server.
3. The backend Live persists the operation and publishes the resulting state.
4. Client B needs the new state.
5. Client A seemingly does not need the same state again.

The current suppression mechanism is mutable state scoped to the WebSocket
handler rather than to an operation. It assumes operation processing and Live
notification are synchronous. If operations become asynchronous, concurrent
operations could overwrite one another's suppression context. It also becomes
unclear what to suppress when a source operation updates derived Lives or
multiple keys.

This exposes a larger design question: should the server normally propagate
the final state, or should it propagate the accepted operation and let each
client reduce that operation into its own state?

## Proposed direction

Under an operation-first model, the server normally sends committed operations
to subscribed clients rather than sending the complete state after every
mutation.

The conceptual model is:

```text
initial snapshot + ordered committed operations = current state
```

For example, after accepting an append, the server might publish:

```json
{
  "type": "operation_applied",
  "key": "android_usage",
  "revision": 43,
  "operationId": "client-a:17",
  "originClientId": "client-a",
  "operation": {
    "type": "append",
    "data": {}
  }
}
```

The server and each client would use the same operation semantics:

```ts
state = reduce(state, operation);
```

This does not require the server to persist a permanent event log. The server
could continue storing materialized state while using committed operations as
the replication format. Durable operation history, replay, and event sourcing
would remain separate choices.

## Commands and committed operations

A client submission and a replicated operation may initially have the same
shape, but they represent different things:

- A command describes what a client requested.
- A mutation is what a backend Live attempts to perform.
- A committed operation or event describes what the server says actually
  happened.

For example, a client could submit:

```ts
{ type: 'append', data: { duration: 30 } }
```

The server could commit:

```ts
{
  type: 'append',
  data: {
    id: 'usage_123',
    duration: 30,
    createdAt: '2026-07-21T12:00:00Z',
  },
}
```

The distinction matters when the server assigns IDs or timestamps, normalizes
values, enforces permissions, resolves conflicts, or partially applies a
request. Origin-based suppression is safe only when the committed operation is
semantically identical to the optimistic operation.

The protocol should leave room for commands and committed operations to
diverge, even if the first implementation uses the same operation type for
both.

## Snapshots and new subscriptions

A new subscriber has not observed the previous operation history, so it needs
an authoritative starting point. Snapshots should remain conceptually distinct
from normal domain operations:

```ts
type ReplicationEvent<T, TOperation> =
  | {
      type: 'snapshot';
      key: string;
      revision: number;
      state: LiveState<T>;
    }
  | {
      type: 'operation_applied';
      key: string;
      revision: number;
      operationId: string;
      originClientId?: string;
      operation: TOperation;
    };
```

Internally, a reducer could treat a snapshot as a `set_state` event. It is
still useful to name it `snapshot` in the protocol because it has different
semantics:

- It does not require a previous state.
- It can compact thousands of previous operations.
- It can bypass normal domain mutation validation.
- It establishes an authoritative revision.
- It may be generated without appearing in an operation history.

A subscription must guarantee a continuous sequence such as:

```text
snapshot at revision 42
operation at revision 43
operation at revision 44
```

There is a race if revision 43 commits after the server reads the snapshot but
before it installs the subscription. Possible solutions include:

- Install the subscription first, buffer events, read the snapshot, then
  discard buffered events at or before the snapshot revision.
- Read the snapshot and establish the subscription in one transaction.
- Retain enough recent operations to replay everything after the snapshot
  revision.

Subscription consistency is a foundational requirement rather than a later
optimization.

## Operation identity, origin, and revisions

Every client submission should have a client-generated operation ID:

```json
{
  "type": "op",
  "key": "android_usage",
  "operationId": "client-a:17",
  "basedOnRevision": 42,
  "operation": {
    "type": "append",
    "data": {}
  }
}
```

Every committed operation should also receive a monotonically ordered server
revision or sequence number. The two identifiers answer different questions:

- The operation ID answers, "Which submitted command caused this?"
- The revision answers, "Where does this committed change belong in the
  authoritative order?"

Origin metadata is useful for routing and diagnostics, but it should not be
the primary correlation mechanism. A WebSocket peer is ephemeral; reconnecting
creates a new peer even though it may still be the same logical client. An
`originClientId` is more durable, while `operationId` precisely identifies the
optimistic operation being acknowledged.

Revisions allow clients to detect:

- Duplicate delivery.
- Missing operations.
- Out-of-order delivery.
- Reconnection gaps.
- Whether an optimistic operation has been committed.

An initial implementation does not need server-side replay. If a client sees a
revision gap, it can request a fresh snapshot. Replay can be added later if the
cost of snapshots becomes significant.

## Options for the originating client

### Broadcast the committed operation to everyone

The simplest correctness-first behavior is to send the committed operation to
all subscribers, including its origin. Client A recognizes the operation ID as
one of its pending optimistic operations and reconciles it instead of blindly
applying it twice.

This ensures Client A always receives the authoritative revision and any
server transformation. It uses a little more bandwidth, but it avoids special
server fan-out behavior.

### Acknowledge an unchanged operation

An optimized server could send the full committed operation to other clients
and send a lightweight acknowledgment to the origin when the operation was
accepted unchanged:

```ts
type OperationResult =
  | {
      status: 'success';
      operationId: string;
      revision: number;
      unchanged: true;
    }
  | {
      status: 'success';
      operationId: string;
      revision: number;
      operation: CanonicalOperation;
    }
  | {
      status: 'error';
      operationId: string;
      error: OperationError;
    };
```

If the server changes the submitted operation, the origin receives the
canonical operation or a corrective snapshot. This eliminates unnecessary
echo while keeping the behavior explicit and safe for asynchronous processing.

### Carry mutation context through Live events

Another option is to attach an opaque cause to the operation and resulting
Live notification:

```ts
live.op(operation, {
  operationId: 'client-a:17',
  origin: peerToken,
});
```

Subscriptions would receive an event rather than only a state:

```ts
interface LiveEvent<T> {
  state: LiveState<T>;
  cause?: {
    operationId?: string;
    origin?: unknown;
  };
}
```

The transport could filter an origin without relying on shared mutable state.
The origin token should remain opaque to the Live so transport-specific peer
objects do not leak into storage implementations.

The main cost is that derived Lives must preserve or intentionally transform
causality metadata. That may be useful, but it changes the meaning of
`subscribe()` throughout the library.

### Subscription exclusion or transaction capture

An operation could explicitly exclude a subscription, but this couples
mutation semantics to observer management and becomes awkward for derived
Lives.

A more powerful alternative is a mutation transaction that captures all
changes before publishing them:

```ts
const transaction = liveModel.beginMutation({ operationId, origin });
transaction.op(key, operation);
transaction.commit();
```

This could support atomic multi-key changes, derived events, controlled fan-out,
and consistent ordering. It is also a large architectural commitment and
should not be introduced solely to avoid one echoed message.

## Exposing operations to UI consumers

Operations can be valuable beyond replication. An append-aware consumer can
incrementally update an index, chart, virtualized list, or other expensive
derived structure.

However, operation history should not be the only UI contract. A UI component
may mount after earlier operations, remount after a reconnect, or need to
recover from a snapshot. An operation-only component cannot necessarily
reconstruct current state.

A Live notification could provide both current state and change metadata:

```ts
interface LiveChange<T, TOperation> {
  state: LiveState<T>;
  operation?: TOperation;
  revision: number;
}
```

Simple consumers render `state`. Incremental consumers may also inspect
`operation`.

For React specifically, appending to an immutable array does not normally
recreate the entire DOM list when elements have stable keys. React can mount
only the new element. Operation-aware UI still has value for large caches,
indexes, visualizations, and non-React consumers, but direct operation-to-DOM
handling should be treated as an optimization rather than the sole source of
truth.

## Benefits

### Efficient incremental replication

An append can transmit one new item rather than an entire collection. Remove,
patch, and reorder operations can have similar savings.

### Shared mutation semantics

Backend and client Lives can use the same deterministic reducer. Backend
originated mutations and client commands follow the same publication path.

### Better optimistic and offline foundations

Operation IDs, revisions, and deterministic reducers provide the pieces needed
for pending local operations, acknowledgment, rollback, reconnection, and
eventual offline operation queues.

### Incremental derived work

Consumers can update indexes or derived data based on a specific operation
rather than recomputing from a full state replacement.

### Clear causality

Committed events can identify the command that caused them, their origin, and
their authoritative order. This is more explicit than inferring causality from
synchronous callback timing.

### Potential observability and audit history

An operation stream can make behavior reproducible and inspectable. A durable
audit or replay log becomes possible, although replication should not require
one initially.

### Removes implicit notification suppression

The protocol explicitly represents acknowledgment, origin, and commitment.
There is no need for a handler-global `suppressedNotification` variable.

## Costs and validation areas

### Client and server reducers must agree

Every replica must interpret an operation exactly as the server does. Even a
simple append raises questions:

- What happens when an item ID already exists?
- Is order based on insertion, timestamp, or normalized server order?
- Does deleting a missing item succeed?
- Does `set_value` replace the value or merge fields?
- How are malformed or obsolete operations handled?

Reducer divergence can silently create incorrect client state. State
broadcasting avoids this class of problem by directly communicating the
result.

Validation should cover deterministic behavior across runtimes, reducer test
vectors shared by client and server, and a recovery path when a client cannot
apply an operation.

### Operation schemas become long-lived contracts

Clients must understand both the current state schema and every operation the
server may emit. Rolling upgrades introduce compatibility questions:

- Can an old client understand operations emitted by a new server?
- Can a new client submit operations to an old server?
- Can a snapshot from one reducer version be followed by operations from
  another?
- If operations are retained, can new code replay old operation versions?

Potential mitigations include protocol versions, capability negotiation,
snapshot boundaries during upgrades, and fallback to state messages.

### Ordering becomes correctness-critical

Operations generally cannot be reordered. `append A` followed by `delete A`
has a different result from `delete A` followed by `append A`.

The implementation must validate duplicate handling, missing revisions,
out-of-order delivery, reconnects, concurrent connections, server restarts,
and transaction boundaries. This becomes core infrastructure rather than an
optional optimization.

### Snapshot/subscription races

The server must not lose operations committed between snapshot creation and
subscription establishment. The chosen handshake needs tests under concurrent
writes, slow snapshot reads, reconnects, and failures during setup.

### Optimistic reconciliation is complex

When the server rejects or transforms an optimistic operation, a client may
need to restore an earlier authoritative state, apply committed remote changes,
and reapply later optimistic operations.

For example:

```text
authoritative state S
apply optimistic A
apply optimistic B
server rejects A
restore S
apply committed server changes
reapply optimistic B
```

Operation identity is necessary, but not sufficient. Reconciliation behavior
must be defined for server-assigned IDs, normalized values, reordered items,
conflicts, partial application, and dependent pending operations.

### Derived Lives require an explicit strategy

If `android_usage` feeds `daily_totals`, which feeds `usage_alerts`, the system
must decide whether clients derive those values or the server publishes changes
for every derived Live.

Client-side derivation saves bandwidth and server work but duplicates domain
logic and may expose source data a client should not receive. Server-side
derivation preserves authority but can turn one source operation into many
ordered, possibly atomic changes across keys.

### Not every backend can produce meaningful operations

A SQLite collection naturally knows that an append occurred. An external API,
file watcher, or opaque data source may only know that its value changed. A
derived Live may need to recompute its entire result.

Forcing every backend to manufacture semantic operations can lead to a
`set_state` operation carrying the entire value, which is state replication in
disguise. The design likely needs a state-based fallback.

### Operations are not always smaller

Operation replication is beneficial for large values with small incremental
changes. It can be worse when state is small, operations are frequent, many
intermediate operations are superseded, or one logical action produces many
fine-grained events.

Five hundred counter increments may cost more than sending the final counter
once. Batching, coalescing, compaction, and backpressure may eventually be
required.

### Operation granularity is difficult

Fine-grained operations such as `set_field` are efficient but expose storage
structure and grow the protocol surface. Coarse domain commands such as
`complete_workout` preserve intent but may require clients to duplicate
substantial server logic to calculate the final state.

Each operation family needs a deliberate boundary between client intent and a
deterministic committed state transition.

### Multi-Live transactions

One operation may atomically update several Lives. If clients observe those
changes separately, they can temporarily render an impossible combination of
states.

The protocol may eventually require transaction IDs, grouped changes, or an
explicit commit boundary. Tests should cover ordering and atomic visibility
across keys.

### Security and authorization

The server must continue validating all client commands. A shared reducer is
not an authorization mechanism.

Committed operations can reveal more than final state. A subscriber might be
allowed to see the resulting collection but not a removed entity, deletion
reason, actor, or unredacted input. Operations may need subscriber-specific
filtering or replacement with an authorized snapshot.

Origin metadata can also reveal client or user identity. Internal routing
identity should be kept separate from metadata safe to publish to subscribers.

### UI coupling

Direct operation-to-DOM handling couples rendering to observed mutation
history. It must still account for initial snapshots, remounts, sorting,
filtering, immediate follow-up mutations, rollback, and resynchronization.

Current state should remain available as the primary UI truth, with operations
exposed as useful metadata or an incremental optimization.

### Debugging complexity

State broadcasting often reduces debugging to, "What state did the server
send?"

Operation replication adds questions about the initial snapshot, reducer
version, revision sequence, missing events, optimistic operations, canonical
operations, duplication, and rollback. Operation logs can improve
observability, but only if tooling exposes this context clearly.

### Log retention and compaction

Durable replay naturally leads to an indefinitely growing operation log. If
that feature is added, the system needs snapshot creation, retention policies,
compaction, handling for clients older than retained history, and possibly a
separate distinction between audit history and replication history.

These concerns can be deferred if revision gaps initially trigger a fresh
snapshot.

## Operation-first versus state-first

| Area                   | State broadcasting                       | Operation replication                                  |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------ |
| Client logic           | Replace with authoritative state         | Run and version reducers                               |
| Bandwidth              | Can resend large values                  | Usually sends small changes                            |
| Ordering               | Latest state can supersede earlier state | Strict order is essential                              |
| Reconnection           | Fetch current state                      | Detect gaps, replay, or snapshot                       |
| Schema evolution       | Primarily state migration                | State and operation compatibility                      |
| Server transformations | Naturally included in state              | Requires canonical operations or correction            |
| Optimistic updates     | Optional                                 | Powerful but needs reconciliation                      |
| Derived data           | Server can send the final value          | Must choose derivation location                        |
| Debugging              | Inspect current state                    | Inspect snapshots, revisions, operations, and reducers |
| Consistency model      | Server is plainly authoritative          | Clients run replicated state machines                  |

## Hybrid operation-first recommendation

A hybrid model appears to capture most of the value without requiring every
Live to become a fully event-sourced replicated state machine:

1. Every Live can provide an authoritative snapshot.
2. A Live may publish deterministic committed operations when supported.
3. State messages remain a fallback for opaque or non-deterministic sources.
4. Every submitted operation receives a client-generated operation ID.
5. Every committed change receives a server revision.
6. The origin receives either the canonical committed operation or an explicit
   acknowledgment when its optimistic operation was accepted unchanged.
7. Clients detect revision gaps and request a snapshot initially; replay can
   be added later.
8. UI consumers receive current state, with the operation available as
   metadata for incremental work.
9. Durable operation history, transaction grouping, and offline queues remain
   later capabilities rather than prerequisites for the first implementation.

This direction treats operation propagation as a replication capability rather
than a universal requirement. It removes implicit synchronous suppression,
supports efficient collection operations, and preserves a reliable state-based
recovery path.

## Suggested staged exploration

Before committing to the complete design, it may be useful to validate it in
small steps:

1. Remove handler-global notification suppression and establish explicit
   operation IDs and acknowledgments.
2. Add server revisions to snapshots and committed changes.
3. Implement operation propagation for one deterministic collection operation,
   such as append.
4. Test duplicate, missing, reordered, rejected, and server-transformed
   operations.
5. Design and test the race-free snapshot/subscription handshake.
6. Exercise reconnect recovery using a fresh snapshot before adding replay.
7. Prototype how derived Lives propagate or replace operations.
8. Validate protocol evolution with mismatched client and server versions.
9. Measure actual bandwidth and rendering improvements against state
   broadcasting.

The staged approach should reveal whether the additional machinery is central
to Live Model's goals or whether state propagation with selective incremental
metadata provides a better complexity boundary.
