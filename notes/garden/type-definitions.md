# Type definitions

- Status: Initial builder, reusable array definition, and root operation-set
  assignment metadata implemented.
- Package: `live-model`

## Direction

Library consumers will be able to define a **type**. Initially, a type only
describes the operations accepted by entities of that type.

Type-definition APIs should live in a dedicated source file containing only
concepts related to defining a type.

This concept is similar to the current `Model`: both give a name and behavior
to a category of entities. The current `Model<T>` is a runtime collection API
over an array-backed Live, while a type definition is currently only a reusable
operation contract. As these APIs develop, we should consider whether Model
should consume, expose, or eventually converge with type definitions rather
than growing a parallel way to describe entities.

Each operation definition includes:

- the operation name;
- a Zod schema describing the accepted argument, when the operation has one;
- an optional reducer.

When an operation has no reducer, applying it does not change state. Reducers
are expected to be most useful for native-like types such as counters. Objects,
arrays, and entity properties are expected to remain independently addressable,
with independent operation histories; the exact model is still to be decided.

The initial fluent API is:

```ts
const tArray = buildType('array').operation('insert', zRefOrValue);
```

The fluent builder is itself the immutable type definition; there is no final
`.get()` step. A future Live Model client registry can consume this definition
and perform any additional building or indexing when the type is registered.

`buildArrayType(itemSchema)` packages that definition for reuse and `tArray`
is its unconstrained `z.unknown()` form. The initial array contract only
declares `insert`; it deliberately has no reducer, so reducing the operation
does not change state. Positioning, removal, movement, identity, and Live
assignment remain separate design questions.

## Follow-up work

Operation-set assignments will be stored in Live metadata as registered
operation-set IDs:

```ts
{
  op_set: {
    root: 'todo@1',
  },
}
```

Metadata is part of the same `LiveState` and history as the value. A core
`set_metadata` operation updates it without changing the value. Value states
always include metadata, absent states may retain it, and loading states do not
have it. Definitions remain registered in code because schemas and reducers
are not serializable.

Property operation-set assignments are not supported yet. Properties are
ordinary JSON fields whose changes become `set_value` on the root Live; they do
not have independent operation histories. The possible `props` metadata field
is left commented out in the source until property Lives have real identity and
history semantics. See [Live metadata](./live-metadata.md).

Reducer behavior and per-property history details remain open. They should not
block making reducers optional in the initial API.

Also, this might be better referred to "Operation Handlers" instead of "Types".
