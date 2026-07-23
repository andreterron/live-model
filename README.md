# Live Model

Live Model is a library to sync data between client and server.

This is currently a playground to explore developer interfaces

## Installation

```bash
npm i live-model
```

## Usage

Here's how you can use Live Model with React:

```tsx
import { configureLiveModel, useLiveState } from 'live-model';

configureLiveModel({
  websocketUrl: 'ws://localhost:3000/live',
});

function Counter() {
  const { value, setValue } = useLiveState('key', 0);

  return (
    <div>
      <p>Count: {value}</p>
      <button onClick={() => setValue(value + 1)}>Increment</button>
    </div>
  );
}
```

If you need to support other frameworks, please create a GitHub issue.

## Packages

The current package separation is exploratory and may change:

- `live-model` contains Lives, client and backend registries, storage-backed
  Lives, operators, and framework integrations.
- `@live-model/protocol` contains shared state, operation, and message types
  plus their runtime schemas and constructors.
- `@live-model/api` adapts Lives to HTTP and WebSocket transports and contains
  Node-specific infrastructure.
- `@live-model/server` composes the packages into a runnable server.

See the project [vision](notes/vision.md), [glossary](notes/glossary.md), and
[decision records](notes/decisions/README.md).

## Licence

[MIT](https://github.com/andreterron/live-model/blob/main/LICENSE)
