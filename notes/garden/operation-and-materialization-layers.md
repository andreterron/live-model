# Operation and materialization layers

- Date planted: 2026-07-25
- Status: Growing
- Confidence: Directional, with foundational decisions still open

Update (2026-08-07): the empty `@live-model/protocol` package was renamed to
`@live-model/causality`. Its first boundary contains generic operation
contracts and results; Live-specific state and messages remain in `live-model`.
Package ownership references below describe the architecture at the time this
note was planted; the conceptual questions remain open.

## Why this is in `garden`

Possible names for notes that may range from early ideas to mature concepts:

- `garden` — ideas can be planted, tended, connected, and eventually promoted
- `concepts` — clear and neutral, but does not communicate maturity
- `design-notes` — descriptive, but sounds more settled
- `workbench` — emphasizes active construction and experimentation
- `incubator` — emphasizes early work more than mature concepts

This note uses `notes/garden`. “Garden” best represents documents with mixed
maturity without confusing them with the decision records in
`notes/decisions`. The folder can be renamed later.

## Summary

The promising direction is to separate:

1. A data-structure-agnostic operation kernel that accepts, identifies,
   orders, stores, and exposes operations.
2. Materializers above it that understand arrays, objects, entities, fields,
   and domain-specific operation semantics.
3. A sync protocol and transport adapters beside the materializers. They use
   the operation kernel and may use a snapshot provider, but a transport does
   not need to understand materialized state during normal operation delivery.
4. Command handling and dependency propagation above both. Commands express
   intent and may produce an atomic batch of operations.

This is a direction, not yet enough of a specification to create a new package
or database schema. In particular, authority, causality, compaction, and
command atomicity affect almost every public interface.

## Current motivation

The main logic was mixed between `live-model` and `@live-model/protocol` when
this note was planted:

- `@live-model/protocol` contains operation definition types, current
  operation schemas, `LiveState`, operation results, and wire messages.
- `live-model` owns operation application, materialized `Live` state,
  subscriptions, registries, and the WebSocket client transport.
- `@live-model/api` owns HTTP and WebSocket request handling, remote peer
  subscriptions, and the SQLite adapter for materialized values.

The result does not yet have a boundary where operations can be durable and
useful without instantiating a `Live`, or where a different materializer can
interpret the same operation history.

## Proposed conceptual boundaries

```text
                    application/domain
                 commands and propagation
                           |
             +-------------+-------------+
             |                           |
      materializers / Lives       sync protocol
      reducers, validation,       messages, subscriptions,
      snapshots, live queries     acknowledgements, auth context
             |                           |
             +-------------+-------------+
                           |
                    operation kernel
             identity, causality, acceptance,
              deduplication, batches, history
                           |
                  SQLite persistence
             operation tables + projection tables
```

The materialization and sync branches are not strictly ordered relative to
each other. A transport can relay operation records without knowing their
meaning. Snapshot and query messages need a materialization-facing provider,
so the sync protocol should allow optional state-bearing messages without
putting state semantics into the operation kernel.

### Operation kernel

The operation kernel should eventually be responsible for:

- Defining the generic operation envelope, identifiers, causal basis, and
  acceptance result.
- Validating envelope invariants, such as identity, required dependencies,
  duplicate submission, and replica sequence rules.
- Atomically accepting one operation or a batch.
- Exposing operations by opaque subject/scope and causal range.
- Recording enough causal metadata to compare versions without replaying the
  entire graph.
- Publishing an accepted-operation feed with resumable checkpoints.
- Recording compaction baselines and the causal range each baseline covers.
- Providing transactional extension points for policy implemented by an upper
  layer.
- Providing explicit, privileged history-maintenance operations.

It should not know:

- That a target is an array, object, field, or JSON path.
- What `append`, `increment`, or an application operation means.
- How concurrent domain operations merge.
- Which user may edit a domain object.
- How a `Live` renders loading, absence, or errors.
- Which WebSocket happens to be connected.

The kernel may index an opaque subject or scope for routing and lookup. Treating
an address as opaque is different from omitting addressing entirely: the
kernel can efficiently select records for `subject = ?` without understanding
the subject’s structure.

### Materialization layer

A materializer should be responsible for:

- Defining operation payload schemas and operation semantics.
- Domain authorization and validation.
- Reconstructing state at a requested causal version.
- Applying accepted operations to current materialized state.
- Producing and loading snapshots.
- Choosing merge, rebase, or branching behavior for concurrent domain
  operations.
- Versioning reducers, state schemas, and snapshots.
- Exposing current state, live queries, and `Live` subscriptions.

“Materializer” need not imply one materialized table per operation stream. A
layer may project operations into normalized SQLite tables and run arbitrary
SQL queries over them.

### Sync protocol and transports

Separate protocol semantics from transport mechanics:

- Protocol semantics: submission, acknowledgement, rejection, accepted
  operation delivery, snapshot/resync, subscribe/unsubscribe, checkpoint,
  capability/version negotiation, and auth context.
- Transport mechanics: WebSocket, HTTP, in-process calls, encoding, framing,
  reconnect timing, and backpressure.

The operation kernel should expose a resumable change feed. Subscription
messages and subscriber filtering belong to the sync layer. A materializer may
add query or state subscriptions above the raw operation feed.

Non-operation messages make sense in the protocol, but not in the operation
kernel. Snapshots, auth, operation results, capability negotiation, and
subscriptions have different lifecycle and security rules from durable domain
operations.

## Extension points, not unrestricted hooks

Hooks are useful, but an unrestricted “before/after anything” system would
make transactionality and invariants difficult to reason about. Prefer a small
acceptance policy interface and explicit maintenance APIs.

A possible conceptual pipeline is:

```text
parse envelope
  -> validate kernel invariants
  -> load dependencies / causal basis
  -> authorize and validate through materializer policy
  -> resolve or reject concurrency through materializer policy
  -> atomically append operation or batch
  -> update projections in the same transaction when colocated
  -> publish after-commit notification
```

The policy needs a transaction-scoped, read-only causal view. It should not be
given raw authority to mutate kernel tables.

History consolidation, compaction, and hard deletion should be explicit
maintenance operations rather than ordinary acceptance hooks. They change the
meaning of historical references and may invalidate replicas.

After-commit hooks cannot participate in rollback. Durable side effects should
use an outbox or a later command rather than relying on a callback completing.

## Causality and the `append` example

An `append` materializer must validate against the state represented by the
new operation’s dependencies, not necessarily current head state:

1. The kernel verifies that the declared causal basis is known or returns
   “dependencies missing.”
2. The materializer asks for its subject at that causal basis.
3. It loads a suitable baseline and applies only operations included by that
   basis.
4. It verifies that the result is an array and validates the append payload.
5. Its concurrency policy decides how to handle operations after or concurrent
   with that basis.
6. The kernel commits the accepted canonical operation or rejects it.

The kernel knows only that an opaque operation kind and payload are being
validated for an opaque subject. The materializer owns the array check.

### Avoid defining `is_before` as repeated graph traversal

Walking recursive dependency edges for every validation query is likely to
become a hot-path problem. Operation identity and causal position should be
separate concepts:

- `operation_id`: stable identity for deduplication and correlation.
- `dot`: a pair such as `(replica_id, replica_sequence)` identifying one
  causal event.
- `context`: a version vector recording the greatest contiguous sequence from
  each replica included in the operation’s basis.
- `frontier`: optional compact heads used to name a version.
- `commit_sequence`: optional server-assigned total order for delivery and
  checkpoints; it does not replace causal order.

Given a version vector, asking whether dot `(r, n)` is included is essentially
`n <= context[r]`. This is much cheaper than rediscovering graph ancestry.
It requires enforcing contiguous per-replica sequences or explicitly tracking
gaps and pending operations.

There is a foundational fork here:

- If one server is the only authority and branching exists only among pending
  client work, a scalar server revision plus per-client mutation sequence may
  be sufficient and considerably simpler.
- If accepted history itself is multi-writer and branching, use causal dots
  plus version vectors/frontiers. A scalar timestamp cannot represent
  incomparable branches.

This decision should precede an operation table schema. A globally sortable ID
such as a ULID is useful for locality and diagnostics, but does not by itself
encode causality.

### Querying only relevant operations

The equivalent of the proposed pseudo-query should be expressed through the
materializer’s opaque subject/scope:

```sql
-- Concept only, not a proposed schema.
SELECT operation
FROM operations
WHERE subject = :subject
  AND operation_is_in_context(replica_id, replica_sequence, :context)
ORDER BY /* deterministic causal materialization order */;
```

SQLite can store operation and projection tables together, while each
materializer is still free to use raw SQL and its own indexes. The exact
encoding of version vectors and the deterministic ordering of concurrent
operations remain open design work.

## History compaction and returning old clients

Compaction should create a baseline, not pretend that a snapshot is an ordinary
domain operation:

```text
baseline
  materialized snapshot or snapshot reference
  reducer/schema version
  causal coverage vector/frontier
  history epoch
  integrity hash
```

Operations causally after the coverage frontier remain replayable on top of
the baseline. The coverage is a vector/frontier, not necessarily “everything
before time X.”

An old client submission should include its history epoch and causal basis.
If its basis predates the retained boundary, return a structured result such
as:

```text
history_unavailable
  current epoch
  current frontier/checkpoint
  authoritative snapshot or snapshot token
  whether pending intent may be resubmitted
```

The client then discards the unusable base, loads the snapshot, and either:

- Re-runs a still-valid command against current state.
- Asks the user to resolve it.
- Drops the obsolete change.

Silently attaching the old operation to the new baseline is unsafe because
validation and merge behavior may change.

If an operation payload directly refers to a compacted operation ID, the
system must retain a tombstone/redirect, rewrite the reference with
materializer-owned logic, or reject it. Causal summaries solve dependency
references; they do not solve arbitrary domain references.

Hard deletion/redaction is distinct from compaction. A redacted client must
not be allowed to reintroduce deleted history, so it should be forced across a
new epoch and clean snapshot boundary.

## Who owns remote clients?

“Client” currently combines three different identities:

| Identity        | Owner                      | Lifetime and purpose                                                                                 |
| --------------- | -------------------------- | ---------------------------------------------------------------------------------------------------- |
| Connection/peer | Transport adapter          | One socket or request stream; fan-out, backpressure, disconnect cleanup                              |
| Logical replica | Operation/sync persistence | Stable device or replica ID; deduplication, causal sequence, acknowledgements, retention eligibility |
| Actor/user      | Auth and application layer | Authorization, tenancy, audit attribution                                                            |

The kernel only needs logical replica metadata that affects operation
correctness: replica ID, accepted sequence/high-water mark, possibly an
acknowledged frontier and a retention lease. It should not retain WebSocket
objects or consider “currently connected” part of durable causality.

The sync layer maps a connection to an authenticated actor and logical
replica. Authentication can reject a submission before the kernel accepts it,
while durable operation audit metadata can record a safe actor identifier when
required.

Do not make compaction depend forever on every replica ever seen. Use an
explicit retention policy, lease, epoch, or server-authoritative resync rule.

## Storage

Use one SQLite database by default, with separate logical tables for the
operation log, baselines, replica metadata, commands, projections, and outbox.
The main benefit is atomicity:

```text
accept operation + update materialization + enqueue effects = one transaction
```

SQLite is also a good match for upper layers that need complex, projection-
specific queries. Do not add a general query abstraction or Drizzle until a
concrete portability requirement appears. Small repository interfaces around
kernel-owned tables are still useful; materializers can use raw SQL.

Supporting separate operation and materialization databases can be an
extension. It gives up the single transaction, so projections must become
idempotent, checkpointed, replayable consumers. A durable outbox/inbox or
change-feed checkpoint becomes mandatory. That is useful for scale or
isolation, but should not be the default complexity.

## Commands, propagation, and transactions

A useful distinction is:

- Command: requested intent, which may be rejected and may produce several
  operations.
- Operation: an accepted fact in a history.
- Batch/transaction: a group of operations accepted atomically.
- Projection effect: a materialized consequence of accepted operations.

Commands belong above the operation kernel. The kernel should support
idempotent atomic batches so a command handler can emit several operations
without exposing partial success. Store a command ID or idempotency key and a
result so entities/handlers can know whether they already responded.

Dependency propagation also belongs above the kernel. The kernel provides the
accepted-operation feed, causation IDs, atomic batches, and handler receipts
needed to implement it without duplicate reactions.

If operation A causes operation B, failure semantics depend on the boundary:

- If A and B are decided synchronously by one command and must preserve one
  invariant, put them in one SQLite transaction. Rejection of B rolls back A.
- If B is an asynchronous reaction after A commits, B cannot retroactively
  reject A. Record the failure, retry idempotently, or emit a compensating
  operation/command.
- If partial success is meaningful, the command result should say exactly
  which operations committed.

This should be selected per command or propagation handler, but not left as an
implicit hook behavior. Calling both cases “configurable transactions” would
hide a significant semantic difference.

Commands should carry correlation/causation metadata. Propagated handlers
should record `(handler_id, command_or_operation_id)` receipts to prevent
cycles and duplicate responses.

## Libraries and systems to study

No library found is exactly a generic, hookable operation kernel with
application-defined materializers, a SQLite-first server, arbitrary SQL
projections, and pluggable transport semantics. Several cover substantial
parts.

### Loro — closest architectural match

[Loro](https://loro.dev/docs/concepts/oplog_docstate) explicitly separates an
OpLog with causal metadata from DocState materialization. It supports version
vectors, frontiers, history DAG operations, operation-only relay servers, and
different snapshot/export modes. Its
[shallow snapshots](https://loro.dev/docs/concepts/shallow_snapshots) retain
current state while trimming history, and explicitly state that peers older
than the shallow boundary cannot continue normal synchronization.

It is the first library to prototype against. It may already solve operation
identity, causal sync, branching, merging, time travel, and compaction.
However, its materialization model is its family of JSON-compatible CRDT
containers. Live Model’s desired boundary appears more general: arbitrary
domain operations, authorization/validation hooks, raw SQL projections, and
configurable command propagation. Adopting Loro might mean accepting its data
model as the materialization layer rather than using it only as a generic
kernel.

### Replicache — commands, replica tracking, and rebase

[Replicache’s architecture](https://doc.replicache.dev/concepts/how-it-works)
is highly relevant even if it is not adopted. It separates named mutation
invocations from canonical server state, gives each client sequential mutation
IDs, records a server high-water mark per client, pulls patches using an
opaque cookie, rewinds to canonical state, then replays pending mutations.
That is a concrete answer to optimistic commands, remote client tracking, and
application-defined conflict behavior.

Its canonical history is essentially server-ordered rather than a retained
multi-writer DAG, and its client view is a key-value store. Replicache also
[became closed-source and license-key based at v10](https://github.com/rocicorp/replicache/releases),
so it is best treated as design inspiration unless that product model fits.

### Yjs — network-independent causal updates

[Yjs document updates](https://docs.yjs.dev/api/document-updates) are
commutative, associative, and idempotent. State vectors allow peers to request
only missing updates, and updates can be merged without loading a materialized
document. Its provider ecosystem also demonstrates a clean separation between
CRDT data, network transports, and persistence.

Yjs is strongest for its built-in shared types, especially collaborative text
and collections. Like Automerge and Loro, it brings its own data structure
semantics rather than acting as a generic domain-operation store. Its update
merging also does not by itself garbage-collect deleted content.

### RxDB — replication contract and conflict hook

[RxDB’s replication protocol](https://rxdb.info/replication.html) is worth
studying for a deliberately backend-neutral contract: checkpointed pull,
pushes containing assumed master state and new fork state, a live pull stream,
resync markers, retry behavior, and a custom conflict handler. It also stores
replication metadata separately from documents.

It is document-state replication rather than a durable causal operation DAG,
but its checkpoint/resync and duplicate-delivery behavior map closely to the
sync layer proposed here.

### PowerSync — SQLite upload queue and checkpoints

[PowerSync’s client architecture](https://docs.powersync.com/architecture/client-architecture)
keeps materialized SQLite data, an operation log, an upload queue, and sync
metadata together. Application integration supplies the backend upload
function, leaving business validation and authorization on the application
backend. Its
[consistency model](https://docs.powersync.com/architecture/consistency)
documents checkpoint behavior and the consequences of rejecting queued
operations.

It is an end-to-end database synchronization product with prescribed
`PUT`/`PATCH`/`DELETE` row operations, not a generic operation/materializer
framework. It is especially useful as a reference for local SQLite layout,
offline queues, retries, and checkpoint atomicity.

### SQLite Session extension — useful primitive

The official [SQLite Session extension](https://www.sqlite.org/sessionintro.html)
records table changes into changesets/patchsets, applies or inverts them, and
invokes a configurable conflict handler. It could help capture projection
changes or implement SQLite-to-SQLite synchronization.

It does not supply causal history, replica identity, subscriptions, auth,
commands, or domain operations. It is disabled in default SQLite builds unless
compiled in, and it requires declared primary keys. Treat it as an optional
storage primitive, not the architecture.

### CouchDB — old replicas after compaction

[CouchDB revision trees and compaction](https://docs.couchdb.org/en/stable/replication/conflicts.html)
provide a useful precedent: compaction discards bodies of non-leaf revisions
but retains revision identity metadata so old replicas can still participate,
with revision pruning bounding growth. This illustrates the trade-off between
supporting arbitrarily old replicas and truly deleting history.

### Jazz — broad product alternative

[Jazz](https://jazz.tools/docs/reference/internals) is worth evaluating if the
goal shifts from building these layers to adopting a broader local-first
database. It combines local persistence, server sync, relational data,
permissions, and offline writes. That covers more product surface than the
operation kernel alone, but it is correspondingly more opinionated and would
replace rather than merely inspire substantial parts of Live Model.

## What can change now

Only behavior-neutral work is justified before the foundational decisions:

1. Keep this exploration separate from decision records.
2. Add characterization tests around current operation routing, optimistic
   local application, synchronous result behavior, subscription fan-out, and
   SQLite persistence before moving ownership.
3. Keep state, operation payload types, and wire messages organized inside
   `live-model` while preserving their public exports. This reveals boundaries
   without choosing new packages.
4. Introduce a transport interface that `WebSocketTransport` implements, then
   make transport construction a configuration concern rather than part of
   the `LiveModelClient` registry. This follows the existing decision to
   eventually merge the client and backend registries.
5. Replace ambiguous new uses of “operation” in documentation with
   “operation payload,” “submitted command,” “accepted operation record,” or
   “projection effect” as appropriate.
6. Keep the existing materialized-value SQLite adapter and synchronous
   operation behavior until the new acceptance lifecycle is decided. Add TODOs
   at the boundary rather than making it partially asynchronous.

Do not yet:

- Create `@live-model/operations`.
- Add dependency fields, clocks, revisions, or operation-log tables.
- Make snapshots ordinary operations.
- Add generic hook APIs.
- Move all protocol messages into the future kernel.
- Add Drizzle or a database portability abstraction.
- Implement command propagation or transaction configuration.
- Generalize remote peer tracking into a durable client registry.

Those changes would encode unsettled answers and be expensive to reverse.

## Decisions needed before the first operation-log spike

Settle these in roughly this order:

1. **Authority model:** one canonical server with speculative branches, or
   accepted multi-writer history?
2. **Source of truth:** are durable operations authoritative, or only a
   replication format beside authoritative state?
3. **Addressing and granularity:** what opaque subject does one history belong
   to, and may one operation address several subjects?
4. **Causal representation:** scalar revision plus client sequence, or
   dots/version vectors/frontiers?
5. **Retention promise:** how old may a returning replica be, and when must it
   resync?
6. **Validation contract:** what read-only historical view does a materializer
   receive, and can it canonicalize an operation?
7. **Batch semantics:** what is atomically accepted and observed?
8. **Command semantics:** are commands durable, how are results stored, and
   which propagation is synchronous?
9. **Reducer and snapshot evolution:** how are old operations materialized by
   new code?
10. **Asynchrony:** which current synchronous APIs become promises or streams?

After these decisions, build one narrow vertical spike:

```text
one subject
  + one custom append command
  + accepted operation records in SQLite
  + materialized array in the same transaction
  + duplicate submission
  + one concurrent submission case
  + snapshot/resync across a compaction boundary
```

That spike should test the kernel/materializer boundary without first
generalizing all current Lives, transports, or storage adapters.

## Tentative answers to the original responsibility questions

| Question                                | Tentative answer                                                                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Define operation schema/protocol?       | Kernel defines the generic record; materializer defines payload; sync layer defines wire messages.                                 |
| Propagation between dependent entities? | Above the kernel, using its accepted-operation feed, atomic batches, causation IDs, and handler receipts.                          |
| Transport semantics?                    | Sync layer defines delivery and recovery semantics; adapters choose WebSocket/HTTP/encoding.                                       |
| Non-operation messages?                 | Yes in the sync protocol, no in the operation kernel.                                                                              |
| Subscriptions?                          | Kernel exposes a raw resumable feed; sync and materialization layers expose user-facing subscriptions.                             |
| Commands?                               | Above the kernel; a command may atomically emit an operation batch.                                                                |
| Remote clients?                         | Logical replicas in operation/sync metadata; socket peers in transport; users in auth/application.                                 |
| Same database?                          | Yes by default for atomicity; separate databases only through checkpointed projection.                                             |
| Append type validation?                 | Materializer reconstructs state at the submitted causal basis and validates it there.                                              |
| Old client after compaction?            | Reject with `history_unavailable` and require snapshot/rebase across an epoch boundary.                                            |
| A causes B and B fails?                 | Roll back both only when they share one synchronous command transaction; otherwise compensate/retry B without undoing committed A. |

## Related local notes

- [Custom Operations](../decisions/2026-07-24-custom-operations.md)
- [Backend Lives](../decisions/2026-07-22-backend-lives.md)
- [Propagating Operations Instead of State](../propagate-operations.md)
- [Glossary](../glossary.md)
