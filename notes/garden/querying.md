# Querying

- Date planted: 2026-07-27
- Status: Seedling
- Confidence: Directional; a minimal all-entities query is implemented and the
  first filter language and result API have been selected

## Motivation

Querying may be a better first primitive than introducing a specialized array
or collection value. A query selects existing Lives and subscribes the client
to a changing result set.

The subscription has at least two related layers:

1. The selected item Lives and their current states.
2. Query membership metadata: which items are in the result, their order when
   ordered, and the range or page currently represented.

An item can change without entering or leaving the query, while a change to an
item can also alter membership or ordering. The protocol should make those
cases distinguishable.

## Dependencies for ideal implementation

- [References](./references.md)

## Current direction

The earlier all-entities implementation was evolved rather than replaced with
a second query API. `BackendLiveModel.query()` creates an `EntitiesQueryLive`
that executes the selected filters against storage, while
`LiveModelClient.query()` creates a `WebSocketQueryLive` that adapts
`query_snapshot` messages to the same result-Live interface.

`query()` is a factory for a query-result Live, and the result type is named
`QueryResult`. A result Live begins in the
loading state, activates query execution on its first subscriber, retains the
latest snapshot for `get()`, and cancels execution after its last subscriber
unsubscribes.

Query results are derived. They use the regular `Live` interface with no
supported query-result operations. The general `Live` mutation conveniences
may be removed separately:

```ts
interface LiveQuery<T = unknown> {
  filter: LiveFilter<T>;
  /** Defaults to 100 and is capped at 10,000. */
  limit?: number;
}

interface QueryResult<T = unknown> {
  items: QueryResultItem<T>[];
  range: {
    /** True when matching items were omitted by the limit. */
    hasMore: boolean;
  };
}

query<T = unknown>(query: LiveQuery<T>): Live<QueryResult<T>, never>;
```

The first version returns one bounded snapshot. An omitted limit means 100;
limits above 10,000 are capped at 10,000. Pagination and iterator APIs remain
follow-up work.

### Field paths

Use Mango-style dot paths in the first version:

```ts
{ filter: { 'profile.name': { $startsWith: 'An' } } }
{ filter: { 'items.0.sku': { $eq: 'ABC' } } }
```

This is the native representation expected by UCAST's Mongo parser and
JavaScript interpreter, so SQLite, Postgres, IndexedDB, and localStorage can
share the query shape with the least adaptation.

Do not treat `profile/name` as an alternative spelling. If arbitrary property
names containing dots must become addressable, add an explicit path form later,
preferably standard JSON Pointer (`/profile/name`, including its `~0` and `~1`
escaping rules) or path-segment arrays. Supporting both spellings implicitly
would make literal dots and slashes ambiguous. Keys containing dots are
therefore unsupported in first-version query paths.

### First filter language

`LiveFilter<T>` is the predicate stored in `LiveQuery<T>.filter`. Use
`@ucast/mongo` to parse its common AST, `@ucast/mongo2js` for JavaScript,
IndexedDB, and localStorage evaluation, and custom `@ucast/sql` interpreters
for SQLite. Both JSON paths and comparison values must be parameterized in SQL.
Postgres translation remains planned but is not part of this implementation.

Supported initially:

- Implicit equality and `$eq`, `$ne`, `$lt`, `$lte`, `$gt`, and `$gte` for
  compatible JSON scalar types.
- `$and`, `$or`, and `$nor`.
- `$in` and `$nin` for scalar membership.
- `$contains` for testing whether a JSON array contains a scalar.
- `$startsWith`, `$containsText`, and `$endsWith` for strings.
- Nested object paths and numeric array indexes.

String operators accept either a string or an options object:

```ts
type StringMatchOperand =
  | string
  | {
      value: string;
      /** Defaults to true. */
      caseSensitive?: boolean;
    };
```

Case-insensitive matching initially uses ASCII case folding so behavior is
consistent across JavaScript, SQLite, and Postgres.

Not supported initially: `$elemMatch`, `$all`, `$size`, `$exists`, `$not`,
regex, raw LIKE patterns, whole-object or whole-array structural comparisons,
object containment, null-versus-missing distinctions, Unicode case folding,
sorting, projections, aggregation, joins, and JSON-field indexes.

## Implementation plan

- [x] Make query-result Lives use `Live<QueryResult<T>, never>`.
- [x] Add UCAST query types, parser instructions, and runtime validation.
- [x] Add the shared JavaScript evaluator and SQLite SQL interpreters.
- [x] Replace the all-keys execution path with filtered, limited execution.
- [x] Adapt WebSocket query snapshots to the returned result Live.
- [x] Add JavaScript and SQLite conformance tests for the supported operators.
- Later, separate query membership from selected Live state and send smaller
  membership changes instead of republishing every item state.

## Initial query message

The client can send:

```ts
interface QueryMessage<T = unknown> {
  type: 'query';
  queryId: string;
  data_source: 'entities';
  query: LiveQuery<T>;
}
```

`queryId` is generated by the client and identifies the resulting
subscription. It can correlate result messages and should eventually identify
which query to cancel or replace. Sending another query with the same ID
replaces the previous subscription. The protocol validates the message envelope
while the selected query source parses and validates the query language.

Query IDs are scoped to a client connection (peer), not globally. Two peers
can use the same `queryId` without interfering with each other. Replacing or
canceling a query affects only the matching query owned by that peer, and
closing a peer cleans up only that peer's query subscriptions.

`data_source` identifies what owns query execution and subscriptions. It can
only be `"entities"` for now. Later it could select another built-in source,
an adapter, or potentially a Live whose value defines or points to the source.
Using a Live could make source configuration itself reactive and addressable,
but its lifecycle, authorization, and query capabilities need design before
putting Live identity into this field.

The first filter implementation accepts the query language described above,
orders results by key, applies the bounded limit, and publishes one initial
snapshot. Automatically updating query membership is deferred.

## Current query snapshot

The server currently sends a complete bounded snapshot:

```ts
interface QuerySnapshotMessage<T = unknown> {
  type: 'query_snapshot';
  queryId: string;
  items: Array<{
    key: string;
    state: LiveState<T>;
  }>;
  range: {
    hasMore: boolean;
  };
}
```

There is deliberately no revision yet. Item array order represents result
order. `hasMore` reports whether matches were omitted by the limit, but there
is not yet a cursor with which to retrieve them.

Full snapshots duplicate data and work, but they provide a simple baseline
that does not require clients to reconstruct state from a possibly incomplete
event history.

## Query cancellation

The initial implementation adds:

```ts
interface UnqueryMessage {
  type: 'unquery';
  queryId: string;
}
```

The existing `unsubscribe` message remains available for ordinary key
subscriptions. It may eventually be generalized to accept either a key or
query ID, removing the need for `unquery`. Both messages remain separate for
now so the two lifecycles are explicit while their common abstraction is
still unclear.

## Query execution

Both model implementations expose the same transport-independent query method
shape:

```ts
query<T = unknown>(query: LiveQuery<T>): Live<QueryResult<T>, never>;
```

The returned Live publishes complete `QueryResult` values and owns execution
and cleanup. It may produce its initial value synchronously or asynchronously.
The result type belongs to each `query<T>()` call because one model can query
multiple entity types. Automatic invalidation and re-execution are deferred.

The initial implementations are:

- `EntitiesQueryLive`, which is created directly by `BackendLiveModel` and
  executes against backend storage when first subscribed.
- `WebSocketQueryLive`, which is created directly by `LiveModelClient`, adapts
  remote query snapshots to the same interface, and hides protocol query IDs
  from its consumer.

The same function shape is also intended for client-side execution. A model
backed by IndexedDB could create a query-result Live that publishes the same
result shape without using the wire protocol. Higher-level collection or React
APIs depend on the model's `query()` method, not on where execution happens.

The WebSocket handler calls `BackendLiveModel.query` directly. The protocol
only supports `"entities"` for now, so introducing a query registry or
injection seam would prematurely commit to how multiple source kinds are
selected.

## Possible query builder

The serializable object remains the canonical query representation, but a
future immutable builder could provide Mongo cursor-like composition:

```ts
const query = queryBuilder<Article>().filter({ status: 'published' }).limit(50).build();

const results = liveModel.query(query);
```

The builder should only be syntax over `LiveQuery<T>`: `build()` returns the
plain `{ filter, limit }` object used by the protocol, persistence, caching,
and equality checks. Future `.sort(...)`, `.after(...)`, and `.project(...)`
methods can follow the same pattern without making builder instances part of
the wire format.

## Possible collection API

A future collection-like object could expose a method whose query argument is
not fixed by the base Live Model API:

```ts
const results = collection.query(collectionSpecificQuery);
```

Here, `results` is a `Live<QueryResult<T>, never>`. The same return type can be
used by a direct entity-query method on `LiveModelClient`; a collection does not
need a separate subscription abstraction.

Calling `query` would create and manage the remote query subscription. The
result object could manage subscriptions to both the result-set metadata and
the item Lives currently in the result. As membership changes, it would
subscribe and unsubscribe from item Lives while preserving stable instances
for items that remain selected.

This keeps storage-specific query syntax out of `Live` itself. It also leaves
room for different collection implementations to accept different query
arguments while sharing subscription lifecycle and result semantics.

## TODO: Revisit result messages

The complete `query_snapshot` is the initial answer. Revisit whether query
results should instead deliver item, range, and ordering information through
smaller messages. Options include:

- Reuse the existing state snapshot message and add an optional `queryIds`
  field so one item state can satisfy multiple active queries.
- Add a dedicated `query_result_item` message containing `queryId`, item
  identity, item state or reference, and ordering metadata.
- Separate item state messages from query membership messages. A membership
  message would describe ordered item identities and range metadata, while
  ordinary state messages continue carrying each Live's state.

The design should avoid sending the same item state repeatedly when it belongs
to several queries, without making query reconstruction depend on messages
that may have arrived before subscription.

## TODO: Extend the query language

The first query language is defined above. Remaining dimensions include:

- Source or collection being queried.
- Filters and parameter encoding.
- Ordering and deterministic tie-breakers.
- Limit, cursor, and requested range.
- Projection versus full item Lives.
- Whether queries can traverse relationships.
- Runtime validation and authorization.

The current implementation supports the selected first-version language and
bounded result behavior described above.

## TODO: Support non-SQLite sources

Determine whether the same `query` method and messages can query entities
owned by an API, search service, file, or computed source.

The common `query()` return type provides the shared subscription lifecycle.
SQLite, IndexedDB, an HTTP API, and a derived model can each implement
execution, snapshots, and change detection differently.

Postgres support is intentionally deferred from the first implementation. Add
a Postgres storage/query adapter and custom UCAST SQL interpreters after the
SQLite semantics and cross-backend query tests have stabilized.

If a source cannot report incremental membership changes, it could recompute
and publish a replacement result snapshot. Separate methods should only be
introduced if the semantics differ, not merely because execution uses a
different backend.

## Additional open questions

- Should `unsubscribe` eventually replace the dedicated `unquery` message?
- How does the initial result snapshot become race-free with subsequent
  changes?
- Does a result update send a full ordered membership snapshot or incremental
  insert/remove/move changes?
- How are cursor or range boundaries updated when earlier items are inserted?
- What does the client retain when an item leaves one query but remains in
  another?
- Where are query authorization and per-item authorization enforced?
- How are query subscriptions restored after reconnect?
- How should deep or GraphQL-like queries compose filters, traversal, and
  projections without making the first query language recursive by default?
- How should queries update automatically when underlying entity values change,
  including membership and ordering changes?
- Can an entity's value itself be a query result, and how should that result's
  lifecycle, references, and persistence behave?

## Potential next steps

- [References](./references.md)
- Unordered set query result: Send events for each entity on the query result. Changes should result in operations to that unordered set (added, or removed). State changes shouldn't trigger a QueryResultItem message, just a regular Live State for the Live, even if the client didn't subscribe to that Live
- Ordered set: Add operations that involve ordering. If ordering is based on a property, we may or may not need these operations.
- Let different sources have different query formats (maybe)
- Try to use `unsubscribe` instead of `unquery`
