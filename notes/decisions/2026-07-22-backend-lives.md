# Backend Lives

- Date: 2026-07-22
- Commit: `492e733`
- Status: Current, revisitable

## Context

The API package previously applied operations directly to storage. Backend
application code could not use the same Live abstraction as clients.

## Decisions

### Backend data is exposed through Lives

Backend application code should use the same reactive data abstraction as
clients. This enables backend subscriptions, derived Lives, and custom Live
implementations.

The alternative was to expose the API package's operation processor. That
would let backend code mutate storage, but would keep storage as the source of
truth and bypass Live composition.

### The registry returns a canonical Live for each key

Repeated lookup of a key should return the same Live so state, subscriptions,
and mutations converge on one object.

Creating a new Live for every lookup would split subscribers and local state
across multiple instances representing the same data.

### Server components share one registry instance

HTTP handlers, WebSocket handlers, and backend application code must observe
each other's changes. Sharing a registry gives them the same canonical Lives.

Separate registries would allow each component to cache a different Live for
the same key.
Direct storage access would also bypass Live notifications.

### Storage-backed Lives own persistence

A storage-backed Live reads, writes, and publishes its own state. This keeps
mutation semantics with the data implementation and lets other Live types use
files, tables, APIs, or different storage layouts.

The alternative was to keep persistence in the API or registry layer and push
the result into a passive Live. That couples data management to transport and
duplicates mutation behavior outside the Live.

### Operations do not contain keys

An operation describes a change. The registry or message envelope identifies
the Live that receives it.

Including a key in the operation repeats information already known by
`live.op(operation)` and mixes addressing with mutation semantics.

### Operation processing remains synchronous

Current storage and mutation implementations are synchronous, and a
`Promise` return type would impose asynchronous calling and allocation
overhead on every operation.

Making all operations asynchronous now was considered and deferred. The
interface will need reevaluation when a concrete asynchronous backend is
introduced.

## Known follow-up

### Merge the registries

`BackendLiveModel` and `LiveModelClient` are separate registries today. They
should converge once transport construction is no longer intrinsic to the
client registry.

### Define registry clearing semantics

Clearing the registry only removes its references. Existing callers can retain
and continue using old Lives, while later lookups create new Lives for the same
keys. This breaks canonical identity and can split subscribers and mutations
between old and new instances.

Clearing should eventually invalidate or dispose old Lives, or be replaced by
a lifecycle API that cannot create multiple active Lives for one key.

`.clear()` is currently used by `LiveModelClient.configure`, so that new Live's
use the new settings.
