import { useLiveState } from 'live-model';
import { ArrowLeft } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router';

type StringifyResult =
  | { status: 'stringified'; value: string }
  | {
      status: 'failed';
      error: string;
      objectKeys: string[] | null;
      stringified: string;
      type: string;
    };

function stringifyValue(value: unknown) {
  try {
    return `${value}`;
  } catch {
    return '[Unable to stringify value]';
  }
}

function stringifyError(error: unknown) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return stringifyValue(error);
}

export default function ExploreEntryPage() {
  const { id } = useParams();
  const storageKey = useMemo(() => (id ? decodeURIComponent(id) : ''), [id]);
  const { value } = useLiveState(storageKey);
  const jsonValue = useMemo<StringifyResult>(() => {
    try {
      return {
        status: 'stringified',
        value: JSON.stringify(value, null, 2),
      };
    } catch (e) {
      console.error('Failed to JSON.stringify value', e);
      return {
        status: 'failed',
        error: stringifyError(e),
        objectKeys:
          typeof value === 'object' && value !== null
            ? Object.keys(value)
            : null,
        stringified: stringifyValue(value),
        type: typeof value,
      };
    }
  }, [value]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        to=".."
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Keys
      </Link>

      <header>
        <h1 className="break-all font-mono text-2xl font-bold">{storageKey}</h1>
      </header>

      {value === undefined ? (
        <p className="text-muted-foreground">
          No localStorage value found for this key.
        </p>
      ) : (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Stored value
          </h2>
          {jsonValue.status === 'stringified' ? (
            <pre className="overflow-auto rounded-md border bg-muted p-4 text-sm">
              {jsonValue.value}
            </pre>
          ) : (
            <div className="grid gap-3 rounded-md border bg-muted p-4 text-sm">
              <div>
                <div className="font-semibold">Error</div>
                <pre className="mt-1 overflow-auto font-mono">
                  {jsonValue.error}
                </pre>
              </div>
              <div>
                <div className="font-semibold">typeof value</div>
                <pre className="mt-1 overflow-auto font-mono">
                  {jsonValue.type}
                </pre>
              </div>
              {jsonValue.objectKeys ? (
                <div>
                  <div className="font-semibold">Object.keys(value)</div>
                  <pre className="mt-1 overflow-auto font-mono">
                    {JSON.stringify(jsonValue.objectKeys, null, 2)}
                  </pre>
                </div>
              ) : null}
              <div>
                <div className="font-semibold">Stringified</div>
                <pre className="mt-1 overflow-auto font-mono">
                  {jsonValue.stringified}
                </pre>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
