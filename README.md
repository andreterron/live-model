# Live Model

Live Model is a library to sync data between client and server.

This is currently a playground to explore developer interfaces

## Installation

```bash
npm i live-model
```

## Usage

Here's how you can use Live Model with React:

```
import { useLiveState } from 'live-model';

function Counter() {
  const { value, setValue } = useLiveState('key', 0);

  return (<div>
    <p>Count: {value}</p>
    <button onClick={() => setValue(value + 1)}>Increment</button>
  </div>);
}
```

If you need to support other frameworks, please create a GitHub issue.

## Licence

[MIT](https://github.com/andreterron/live-model/blob/main/LICENSE)
