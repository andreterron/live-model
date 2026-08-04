# Type definitions

- Status: Initial builder and reusable array definition implemented; assigning
  a type to a Live remains intentionally deferred.
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

The next step is to define how a type is assigned to an entity or to an entity
property. That assignment is not part of the initial implementation.

Reducer behavior and per-property history details remain open. They should not
block making reducers optional in the initial API.

Also, this might be better referred to "Operation Handlers" instead of "Types".
