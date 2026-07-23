# Explorer UI

- Move "Recents" storage from localStorage, into a backend-synced Live
- Not a fan of how the "Recent" and "All keys" sections are always visible

## JSON Editor

> Only relevant if we're keeping a JSON editor. But we should likely move to something different.

- Auto-save
- Syntax highlighting
- Dev shortcuts, like "Tab" to indent

# Operations / Messages

- Split "operations" (change data) and "messages" (includes subscriptions, reads, and operations)
- For either messages or operations, consider sending a result back. Or include metadata linking to the message/operation on the state/message returned
- Send `OperationStatusMessage` responses through WebSocket. operations need to have IDs for correlation
- Remove/refactor `suppressedNotification` in the WebSocket handler. Operations should carry origin and operation IDs, and resulting state messages should reference the operation so transports or clients can reconcile without applying stale echoed state.

# Live registry

- Merge `BackendLiveModel` and its related types with `LiveModelClient`. Refactor `LiveModelClient` so its current transport dependency is an implementation or configuration concern rather than requiring a separate backend registry.

## Request handler

- Accept JSONL for the right content-type header
