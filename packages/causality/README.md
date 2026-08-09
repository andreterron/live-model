# `@live-model/causality`

`@live-model/causality` contains the data-structure-agnostic contracts used to
sync operations between clients.

Most library and application consumers should import these contracts from
`live-model`, which re-exports them. Direct imports from this package are for
lower-level packages that intentionally depend on causality without depending
on the rest of `live-model`.

The initial split contains generic operation envelopes, operation type
utilities, and operation results. Live-specific state, addressing, querying,
materialization, and transport integration remain in `live-model` while their
longer-term boundaries are still being explored.
