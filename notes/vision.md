# Vision

Live Model aims to make high-quality responsive software easy to build.

## Motivation: Flatten the Memory Hierarchy

Assembly developers manually wrote their programs to manage the data between
memory and CPU registers. Compilers and higher-level languages made that
movement an implementation detail for most developers.

Application developers still spend significant effort moving data between
cloud services, local disk, and memory. Live Model should provide a similar
abstraction: developers describe their data and how it behaves, while the
library manages where that data lives and how it moves between storage levels.

## Capabilities

Live Model aims to provide Applications with these capabilities:

- Local-first reads and immediate local interactions.
- Offline-capable applications that synchronize when connectivity returns.
- Derived state as a first-class part of the data model.
- Branching state for drafts, previews, optimistic work, and alternative paths.
- Authorization that works across local state, synchronization, and backend
  persistence.
- Graph relationships between data entities.
- Data interoperability between independently developed applications.

The API should make these capabilities composable without requiring every
application to build its own synchronization framework.

## Existing Databases

Live Model needs to work for companies with established data systems. It
should be possible to connect Live Model to an existing database such as
PostgreSQL and add reactivity, synchronization, offline behavior, and related
capabilities on top of that database. Adopting Live Model should not require a
company to replace its system of record or move all of its data into a
Live-Model-specific database.
