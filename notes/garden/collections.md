# Collections

- Date planted: 2026-07-26
- Status: Dormant; superseded by the querying exploration
- Confidence: Directional; storage and protocol details remain open

> This note preserves the earlier collection and array exploration. The active
> first step has moved to [Querying](querying.md), and the array-specific
> runtime types and operations have been removed from the package.

Update (2026-08-04): `live-model` now exports a definition-only `tArray` with
an `insert` operation and a `buildArrayType(itemSchema)` factory. It has no
reducer and is not assigned to a Live, so it does not yet reactivate the
identity, ordering, or materialization design explored below.

## Current direction

The first implementation will use ordinary `Live` values containing arrays
small enough to load into memory.

The eventual goal is for array entries to be references with materialized
ordering:

```ts
interface ArrayItem<T = unknown> {
  item: { $ref: string };
  sortKey: string;
}

type ArrayValue<T> = ArrayItem<T>[];
```

Each entry references an independently addressable item Live. The array owns
membership and ordering, but not the referenced item's value.

Live Model does not support references yet. Requiring this representation now
would pull reference resolution and lifecycle into the array work. Until
references exist, an ordinary `T[]` is also a valid Live value. Arbitrary
arrays use `set_value` for initialization and replacement, so inline objects,
primitives, and duplicate values remain supported without inventing temporary
identity semantics.

The identity-based `insert`, `remove`, and `move` definitions describe the
future reference-array behavior. Their reducers should not use array indices,
deep equality, or JSON hashes as substitute IDs: those would be unstable in
the presence of edits, duplicates, and concurrent changes. Fine-grained
operations for arbitrary inline arrays are therefore deferred rather than
given a throwaway protocol.

This deliberately postpones partial loading, server-side querying, and
collections too large to fit in memory.

## Array operations

The initial structural operations are:

- `insert`: insert `item_id` at the start, end, before an item, or after an
  item.
- `remove`: remove one or more `item_ids`.
- `move`: move `item_id` to the start, end, before an item, or after an item.

Locations are represented as:

```ts
type ArrayLocation =
  | { location: 'start' | 'end' }
  | {
      location: 'before_item' | 'after_item';
      relative_to_item_id: string;
    };
```

`item_id` is required for insert as well as move. Before/after locations also
require `relative_to_item_id`; a location name alone does not identify the
anchor.

`sortKey` is materialized state rather than caller-provided operation data.
Applying insert or move must assign a key that places the entry between its
new neighbors. The initial sort-key algorithm is still open.

The default `set_value` and `delete` operations remain available. `set_value`
provides snapshot replacement and initialization, so a separate array
`replace` operation is unnecessary in the first version.

An item-update operation is also unnecessary: changing an item's contents
targets the referenced item Live, not the array. A future batch `splice`
operation could atomically remove and insert several references. Automerge and
native JavaScript arrays expose splice-like behavior, but insert, remove, and
move are clearer for this reference-and-identity model.

Open behavioral details include:

- Whether inserting an existing `item_id` fails or behaves like move.
- Whether removing an unknown ID is an idempotent success.
- Whether a missing relative item causes rejection or a deterministic
  fallback.
- Whether duplicate references are allowed. The singular move operation
  assumes item IDs uniquely identify array entries.
- How concurrent insert and move operations choose stable, unique sort keys.

## Using the existing operation path

The array operation definitions extend `DefaultOperations<ArrayItem<T>[]>`, so
the existing typed `Live.op()` interface can express `insert`, `remove`, and
`move` alongside `set_value` and `delete`.

The wire operation envelope accepts any string operation type with optional
`data`. Payload validation belongs to the addressed operation handler because
the generic protocol cannot know every operation family.

`BackendLiveModel` carries generic operations to its Lives. Its default
`StorageLive` supports registered operation handlers that receive the current
`LiveState` and operation data, then either return an error or a replacement
materialized value. Unregistered custom operations are rejected rather than
having their payload mistaken for a complete replacement value.

An array reducer can be registered through this path once its identity and
sort-key behavior are settled. `set_value` and `delete` continue through their
built-in paths.

Such a handler can dynamically check `Array.isArray(currentValue)` before
applying an array operation. For this reference-array design, it should
preferably also validate the existing entries as `ArrayItem` values; checking
only `Array.isArray` would allow reference-specific operations to create mixed
arrays from unrelated application data. An empty array is inherently
ambiguous and can be treated as a valid reference array once these reducers
are enabled.

## Deferred `LiveCollection`

An earlier design introduced `LiveCollection<T>`, nested as
`Live<LiveCollection<T>>`, when the wire value was a
`{ "$kind": "live.collection" }` marker. It also explored:

- `LiveCollection.query()` returning a `LiveIterator<T>`.
- Array-like `map`, `reduce`, and `forEach` methods.
- A standalone `paginate(iterator, ...)` helper. Putting `paginate` directly
  on `LiveCollection` was considered and rejected because query results, not
  the entire collection, are what should be paginated.

These runtime types have been removed from the package for now. They solve
partial loading and query composition that the first in-memory array version
does not need, while introducing unresolved loading, iteration, and pagination
semantics. The intent is to bring `LiveCollection` back when larger-than-memory
collections or server-side queries become an active requirement.

## Possible future normalized storage

Collection membership may eventually be stored separately from Live values:

```text
collection_id  references the Live that holds the collection
item_id        references the Live for an item
ordering       optional ordering information
```

No database or storage-adapter changes are part of the first array version.
