# Live metadata

- Status: Root operation-set assignment implemented; registry and validation
  remain open.
- Package: `live-model`
- Decision: [Live metadata and operation-set assignment](../decisions/2026-08-06-live-metadata.md)

Live metadata is durable, reactive information about a Live rather than part
of the Live's JSON value. It is carried by `LiveState`, state messages, and
query snapshots, so consumers observe the value and its metadata together.

Current shape:

```ts
{
  op_set: {
    root: 'todo@1',
  },
}
```

The value is a registered operation-set ID, not the definition itself. Zod
schemas and reducers stay in code and will eventually be resolved through a
Live Model client registry.

The core `set_metadata` operation replaces metadata while retaining the value.
It shares the Live's history with value operations and is available regardless
of the Live's application-specific operation handlers. Future authorization
and operation-set compatibility checks belong at this operation boundary.

Value states always carry metadata. Absent states may carry it. Loading states
do not, because metadata has not been loaded yet. Value changes preserve the
current metadata.

## Property operation sets

Property assignments are intentionally unsupported. Object properties are
currently JSON fields, and changing one becomes `set_value` on the root Live.
They do not have separate identities or operation histories, so an
`op_set.props` map would promise behavior the runtime does not yet implement.

The possible `props` member is retained only as commented-out source in the
`LiveMetadata` interface. It can be reconsidered after properties become
independently addressable Lives with independent histories. Until then,
protocol validation rejects it.

## Open questions

- Where operation-set definitions are registered and how IDs are versioned.
- When and where metadata updates validate value compatibility.
- How authorization controls operation-set changes.
- Whether metadata replacement remains sufficient or needs narrower operations.
- What identity and history model would make property operation sets real.
