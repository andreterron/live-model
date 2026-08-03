# References

- Date planted: 2026-07-27
- Status: Growing; whole-entity references are implemented
- Confidence: Directional; the minimal representation and resolution boundary
  are clear, while fragment mutation semantics remain open

## Minimal first implementation

The implemented first slice supports whole-entity references. JSON Pointer
fragments are parsed and reserved, but resolution and fragment Lives remain
deferred.

Represent a reference in stored and transported JSON as an exact, one-property
object:

```json
{ "$ref": "live:id_123" }
{ "$ref": "live:id_123#/propertyA" }
```

The first form references the Live addressed by `id_123`. The optional fragment
is an RFC 6901 JSON Pointer into that Live's value. A fragment is a pointer, not
a dotted property path, so an array entry would look like `#/items/0`, and `/`
and `~` in property names use JSON Pointer escaping.

The portion after `live:` and before `#` is the registry key. It must use URI
component encoding when the key contains reserved characters. The fragment must
use JSON Pointer's URI-fragment representation. A small protocol-level
constructor and parser should own this encoding rather than having callers
concatenate strings:

```ts
interface LiveReference {
  readonly $ref: string;
}

liveReference(key: string, pointer?: string): LiveReference;
// Returns undefined for ordinary data; throws for a reserved but malformed ref.
parseLiveReference(value: unknown):
  | { key: string; pointer?: string }
  | undefined;
```

`parseLiveReference` should only recognize a plain object whose sole own
property is a string `$ref`. Reserving the exact shape reduces accidental
collisions with existing application objects and leaves objects with ordinary
`$ref` metadata plus other properties untouched. A malformed exact reference
should produce a clear decoding error rather than silently remain application
data.

No new SQLite column or entity `id` field is required. The existing entity
`key` is already the address used by both `BackendLiveModel.forKey(key)` and
`LiveModelClient.forKey(key)`, and SQLite already stores arbitrary JSON blobs.
An application may still keep an `id` in the entity value for domain use, but
Live Model should not require or synchronize that duplicate identity.

This first implementation only makes independently keyed entities
referenceable. An object embedded in another entity is not independently
addressable merely because it has an `id` property.

## Resolution boundary

Storage and the wire protocol retain `LiveReference` JSON. Library consumers
see a `Live<T>` in its place.

Resolution should be a recursive, symmetric codec at the Live/registry
boundary:

```text
stored or wire JSON
    -> decode references
consumer value containing canonical Lives
    -> encode recognized Lives
stored or wire JSON
```

It should walk arrays and plain JSON objects. Decoding a reference obtains its
target from the same registry as the containing Live:

- A root reference resolves with `registry.forKey(key)`.
- A fragment reference resolves to a derived Live over that root Live.
- Repeated resolution of the same canonical reference string returns the same
  Live instance within one registry.

The codec belongs above storage adapters and concrete transports because it
needs a Live registry to resolve identities. A small reference-aware wrapper
around a raw Live is one way to keep WebSocket, SQLite, and future persistence
implementations operating on plain JSON. Both the frontend and backend
registries should use the same wrapper if backend library consumers are also
expected to receive Lives.

Creating a Live handle must remain lazy: encountering a reference should not
subscribe to or load its target. The target activates only when a consumer
subscribes, as ordinary Lives do now. Dangling, deleted, unauthorized, and
offline targets are consequently expressed by the referenced Live's normal
`LiveState`; they do not make the containing entity absent.

The reverse conversion is required even if references are initially authored
with `liveReference()`. A consumer can read an object containing resolved Lives,
change an unrelated property, and pass the whole object to `setValue`. Sending
that object directly to `JSON.stringify` would serialize Live implementation
details, fail on cycles, or store meaningless objects. Before any operation is
persisted or transported, its data must therefore recursively replace Lives
created or recognized by this registry with their canonical reference JSON.
A `WeakMap<Live<unknown>, LiveReference>` can retain this metadata without
adding enumerable fields to Live objects. An unrecognized arbitrary Live in
operation data should fail with a useful error instead of being serialized.

The codec must also run on optimistic local state and on locally forwarded
operations, not only on server state messages. Otherwise the same value would
temporarily alternate between raw reference objects and resolved Lives
depending on where the update originated.

## Fragment references

Fragment reads can be implemented as derived Lives:

```ts
{
  $ref: 'live:id_123#/propertyA';
}
// becomes a Live for propertyA of the Live keyed by id_123
```

A missing pointer should give the fragment Live an
`absent/not_found` state. Loading, absence, and errors from the root Live pass
through.

Fragment writes should be read-only in the first version. Mapping
`fragment.setValue(value)` to a read-modify-write of the entire root object can
overwrite concurrent changes and cannot be made atomic by the current
`set_value` operation. Supporting writes requires a path-targeted operation
with defined missing-path, array, authorization, and concurrency behavior.
The fragment Live should reject unsupported operations explicitly; silently
returning success or swallowing an operation error would be misleading.

If even read-only fragments add too much implementation surface, ship root
references first while reserving and parsing the fragment syntax. Do not treat
`#/propertyA` as a separate registry key.

## Type and validation shape

There are now two representations of a value:

- The materialized representation contains `LiveReference` JSON and is used by
  protocol and storage code.
- The consumer representation recursively substitutes referenced positions
  with `Live<...>`.

The public types should name this distinction rather than claiming the same
generic `T` describes both. A recursive `Resolved<T>` helper may be useful, but
it should initially be conservative around arrays, objects, and already-live
values rather than attempting a perfect TypeScript JSON transformation.

The existing `WebSocketLive` validator currently sees the wire value.
Preserving validation before reference decoding is the least surprising first
step and lets schemas validate the `$ref` representation. If resolved-value
validation is later needed, it should be a separate hook; changing the current
validator to receive Live instances would break schemas that describe stored
JSON.

## Compatibility and failure cases

This is mostly additive to SQLite and the protocol because both currently
accept arbitrary JSON, but it changes consumer behavior:

- An existing exact object such as `{ "$ref": "live:..." }` becomes reserved
  and will no longer be returned as ordinary data.
- Consumers, validators, the explorer, and JSON-formatting utilities that
  assume every value is directly JSON-serializable need to operate on the
  materialized form or use the reference encoder.
- `setValue` and custom operation payloads need encoding. Handling only
  `set_value` would leave reference-bearing custom operations broken.
- Client-side optimistic updates and transport fan-out need the same decoding
  path as remote state messages.
- Registry caching is required for useful referential identity. Different
  registries must still produce different Live instances, as they do today.
- Cycles in the entity graph are safe only because refs resolve to lazy Live
  handles. The codec must not recursively dereference target values.
- Deleting a target does not delete or rewrite references to it. References are
  intentionally allowed to dangle in the minimal version.
- There is no referential-integrity check, cascade behavior, garbage
  collection, cross-registry reference, or atomic multi-entity write in this
  version.
- The current `Model<T>` stores records inline in one array Live. Its record
  `id` fields are not registry keys, so those records cannot be targets until
  the model stores them as separate keyed entities.

Useful minimum tests are:

- Root and pointer reference parsing, escaping, and rejection of malformed
  reserved shapes.
- Recursive decoding in objects and arrays, including repeated references and
  cycles between entities.
- Stable Live identity per registry and isolation across registries.
- Lazy target subscription.
- Read/subscribe behavior for existing, missing, and absent fragment paths.
- Read-modify-`setValue` round trips back to identical reference JSON.
- Encoding of references inside generic operation data.
- Clear rejection of an arbitrary unregistered Live.
- SQLite persistence and WebSocket round trips retain the exact JSON marker.

## Explicitly deferred

- Queries return references instead of embedding each entity's state.
- Queries traverse or filter through deep references.
- Inline objects are promoted to independently keyed entities and replaced
  with references.
- Writable fragment Lives and atomic path-targeted operations.
- Referential integrity, cascading deletes, ownership, and garbage collection.
- Cross-registry or external URL references.

The query-result change is the natural next consumer of root references:
queries should own membership, ordering, and range, while each returned
reference identifies the separately subscribed Live. See
[Querying](querying.md) and [Collections](collections.md).
