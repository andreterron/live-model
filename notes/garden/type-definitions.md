# Type definitions

- Status: Planned; implementation is intentionally deferred until the protocol
  package move is reviewed and committed.
- Package: `live-model`

## Direction

Library consumers will be able to define a **type**. Initially, a type only
describes the operations accepted by entities of that type.

Type-definition APIs should live in a dedicated source file containing only
concepts related to defining a type.

Each operation definition includes:

- the operation name;
- a Zod schema describing the accepted argument, when the operation has one;
- an optional reducer.

When an operation has no reducer, applying it does not change state. Reducers
are expected to be most useful for native-like types such as counters. Objects,
arrays, and entity properties are expected to remain independently addressable,
with independent operation histories; the exact model is still to be decided.

A possible fluent API is:

```ts
const tArray = buildType('array')
  .operation('insert', zRefOrValue, optionalReducer)
  .get();
```

## Follow-up work

After the type-definition API is designed:

1. Define an array/collection type with it.
2. Define how a type is assigned to an entity or to an entity property.

Reducer behavior and per-property history details remain open. They should not
block making reducers optional in the initial API.
