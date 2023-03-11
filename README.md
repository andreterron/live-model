# Live Model

Live Model provides a local cache to your API or remote database, so that your app responds immediately, whether your user has gigabit internet, an unstable connection, or is offline!

## Installation

```bash
npm install live-model@alpha
```

## Usage

> ⚠️&nbsp;&nbsp;Under development!

```tsx
import { liveTable } from "live-model";
import { useQuery } from "live-model/react";

interface ToDo {
    id: string;
    title: string;
}

const todosTable = liveTable<ToDo>("todos");

export function App() {
    const todos = useQuery(todosTable);
    return (
        <div>
            <ul>
                {todos.map((todo) => (
                    <li key={todo.id}>{todo.title}</li>
                ))}
            </ul>
            <button onClick={() => todosTable.add({ title: "New" })}>
                Create To-Do
            </button>
        </div>
    );
}
```

## Licence

[MIT](./LICENSE)
