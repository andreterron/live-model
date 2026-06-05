import { subscribe } from 'diagnostics_channel';
import { Subscriber } from './reactivity/subscriber.js';
import { Subscription } from './reactivity/subscription.js';
import {
  DispatchType,
  Operation,
  OperationDefinition,
  OperationHandler,
  OperationsFromHandler,
} from './operations/operation.js';

export interface Live<T, OP extends OperationDefinition<T> = any> {
  get(): T;
  subscribe(subscriber: Subscriber<T>): Subscription;

  // --- Actions

  dispatch?: DispatchType<T, OP>;

  // What's the underlying layer that actions are built on?
  // 1. "operation" (== dispatch)
  //     - Do operations have an interface { type: string, ... } or are anything?
  //       constraint might help devs
  //     - Something similar to Rust's traits?? settable, refreshable, paginated, iterator, list, table, async, optional, deletable

  setValue(value: T): void; // Could be a dispatch of a "set" event
  // dispatch(operation: OPS)
  // reduce(transform: (prev: T) => T) // A function could be an event, but it's not serializable
}

export abstract class BaseLive<T, OP extends OperationDefinition<T> = any>
  implements Live<T, OP>
{
  protected subscribers = new Set<Subscriber<T>>();

  subscribe(subscriber: Subscriber<T>): Subscription {
    this.subscribers.add(subscriber);

    return {
      unsubscribe: () => {
        this.subscribers.delete(subscriber);
      },
    };
  }

  protected notifySubscribers(v: T) {
    this.subscribers.forEach((s) => s.next(v));
  }

  abstract get(): T;
  abstract setValue(value: T): void;
  // abstract dispatch(op: OP): void;
}

export type Flatten<T> = {
  [K in keyof T]: T[K];

  // Intentional: This is a utility type
  // eslint-disable-next-line @typescript-eslint/ban-types
} & {};

interface Subscribable<T> {
  subscribe(subscriber: Subscriber<T>): Subscription;
}

export abstract class Reducer<T> implements Subscribable<T> {
  // todo
  abstract subscribe(subscriber: Subscriber<T>): Subscription;
}

type OpMethod = any;

type Live2<T, OPS extends Record<string, OpMethod> = {}> = Flatten<
  {
    get(): T;
    subscribe(subscriber: Subscriber<T>): Subscription;
    as(trait: any): any; // Converts to a supported trait???? sketchy. Maybe model.from(...)
  } & { [K in keyof OPS]: OPS[K] }
>;

type ReadonlyLive<T> = Live2<T, {}>;
type Settable<T> = { set(v: T): void };
type SettableLive<T> = Live2<T, Settable<T>>;

let foo: Live2<number, SettableLive<number>>;

class SkipValueError extends Error {}

export function live2<T, OP extends OperationDefinition<T> = {}>(
  initialValue: T,
  handlers: OP
): Live<T, OP> {
  let v = initialValue;
  return {
    get() {
      return v;
    },
    subscribe(s) {
      // TODO
      return { unsubscribe() {} };
    },
    dispatch(event, arg) {
      const skip = () => {
        throw new SkipValueError();
      };
      try {
        const newValue = handlers[event](v, arg, { skip });
        v = newValue;
      } catch (e) {
        if (!(e instanceof SkipValueError)) {
          throw e;
        }
      }
    },
    setValue(value) {
      // TODO: Remove from interface
      // no
    },
  } satisfies Live<T, OP>;
  // return null as any as Live2<T, OP>;
}

// const bar = live2(
//   {
//     get: () => 1,
//     subscribe: (s) => {
//       s.next(1);
//       return { unsubscribe: () => {} };
//     },
//   },
//   {
//     set(v: number) {},
//     refresh() {},
//   }
// );

// How would the types work?
// What if .get doesn't exist? What if you may not be able to read it synchronously. Don't make a `null` mistake.
// Benefit of Rust trait: implement one function, get 50 for free.
// Benefit of Live trait: ...? events can be translated into other events for free.

// defineOpTranslation("list::move", "set", ())

// or...

// List.fromSettable(bar)
// listFromSettable(bar)

// Is this a model???

// one thing is certain: I need operations/events
// and I need to sleep...
// TODO: Implement operations: dispatch(op: OPS): void | Promise<Action> | Action
// TODO: Use it, see how it feels

// Remember, it needs to work within TS and JS

// The perfect interface may not exist, it may not be possible within js/ts.

// const baz = live3(settable, refreshable)

// let app: any;
// app.visitorCounter = live(0);
// app.magic = constant(42);
// const user = model({
//   joinIndex: live(() => app.visitorCounter.snapshot(), {
//     permissions: [writer(app), reader(user)],
//   }), // idk
//   homepage: prosemirrorLive<SCHEMA>(),
// }).extend((u: { joinIndex: any }) => ({
//   commas: u.joinIndex.map((i: number) => Math.log10(i) / 3), // .map ????? map back????
// }));

// How would task.page have a prosemirror document with transactions? Do we need native entity graph support?
// No, we can achieve it with {type: prosemirror, key: 'foo', transaction: {...} }
