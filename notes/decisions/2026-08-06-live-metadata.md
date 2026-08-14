# Live metadata and operation-set assignment

- Date: 2026-08-06
- Status: Current, revisitable

## Context

An operation-set definition contains runtime behavior such as Zod schemas and
optional reducers, so the definition itself cannot be serialized with a Live.
Lives still need a durable way to identify which registered operation set
governs their operations.

We considered deriving the assignment from entity IDs, storing metadata in a
separate Live such as `id/$meta`, and addressing value and metadata through
different operation facets. ID rules make assignment implicit. A separate Live
makes value and metadata independent reactive states and histories. A facet on
every operation is easy for a consumer to overlook while reducing an operation
stream. In particular, an operation performed after changing an operation set
must causally follow that change.

## Decisions

### Metadata is part of `LiveState`

Value and metadata form one reactive state and travel in the same state and
snapshot protocol messages. This keeps their ordering and history together and
lets a later operation depend on the latest operation in that history.

The state variants intentionally differ:

```ts
type LiveState<T> =
  | { kind: 'loading' }
  | {
      kind: 'absent';
      reason?: AbsentReason;
      error?: unknown;
      metadata?: LiveMetadata;
    }
  | {
      kind: 'value';
      value: T;
      metadata: LiveMetadata;
      error?: unknown;
    };
```

A value always has metadata, with `{}` as the default. An absent Live may keep
metadata because deleting a value does not necessarily erase its operation-set
assignment. Loading has no metadata: it means the state has not been loaded,
not that empty metadata was loaded. For compatibility, legacy value messages
without metadata parse as `metadata: {}`.

### Metadata stores registered IDs, not definitions

The initial serializable shape is:

```ts
interface LiveMetadata {
  readonly op_set?: Readonly<{
    readonly root?: string;
  }>;
}
```

`root` is an identifier such as `counter`. A shared registry resolves it to the
operation-set definition containing schemas and reducers. Registry IDs are not
versioned yet; versioning can be added when compatibility requirements are
better understood. Assignment validation is not implemented yet.

### Property assignments are deferred

`op_set.props` is deliberately not part of the runtime type or Zod schema.
Properties are currently ordinary JSON fields: changing one is translated into
`set_value` on the root object, and the property has no independently
addressable Live or operation history. Advertising a property operation set
would therefore imply isolation that the runtime cannot provide.

The prospective `props` field remains commented out in `LiveMetadata`, with an
explanation, so the design question remains visible without becoming supported
API. Protocol input containing `op_set.props` is rejected rather than silently
ignored. We can restore the field after property Lives and their independent
histories have concrete semantics.

### Metadata changes use a core operation

`set_metadata` replaces the complete metadata object without changing the
value. It is always recognized independently of application operation handlers
and is exposed as `live.setMetadata(metadata)`. Treating this as a core
operation avoids an operation facet that reducers could accidentally ignore,
while retaining one history for value and metadata changes.

`set_value` preserves the current metadata. A metadata update produces a normal
Live notification, and WebSocket transports forward it to other local
subscribers without changing their materialized value.

Authorization and compatibility checks for metadata changes are deferred. The
operation boundary is where those checks can be added later.

### Persistence follows each storage model

- SQLite stores serialized metadata in a non-null `metadata` column beside
  `data`; existing databases receive the column through an additive migration.
- Local storage keeps metadata under the related `key/$metadata` key, while the
  value remains in its existing raw key for compatibility.
- In-memory adapters keep metadata in their `LiveState`.
- State and query snapshot messages carry metadata through `LiveState`; there
  is no separate metadata message or subscription.

## Consequences

Consumers can observe a coherent value and operation-set assignment without
joining two Lives or checking an operation facet. Operation-set definitions
remain executable, code-registered objects while assignments remain durable
strings. The current model assigns only the root operation set. Independent
property operation sets remain blocked on a future property identity and
history design.
