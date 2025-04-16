// Unnecessary. Will probably slow TS down
// type Cols = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J'
// type Rows = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
// type Cells = `${Cols}${Rows}`
// import { interval, map, Observable } from 'rxjs';

// type CalculatedCell = (cells: Record<string, Cell>) => Cell;

// // TODO: Make this into a Live<T>, so I can emit changes, and call useLive on it.
// type Cell = Observable<boolean>;

// function defaultStorage(def: Record<string, CalculatedCell>) {
//   const all = new Proxy<Record<string, Observable<boolean>>>(
//     {},
//     {
//       get(target, p: keyof typeof target, receiver) {
//         // cached
//         if (target[p]) {
//           return target[p];
//         }
//         // calculated
//         if (def[p]) {
//           const newCell = def[p](all);
//           target[p] = newCell;
//           return newCell;
//         }
//         // storage
//         if (typeof p === 'string' && p.match(/^[A-Z]+[0-9]+$/)) {
//           const newCell = interval(100).pipe(
//             map(() => localStorage.getItem(p) === 'true')
//           );
//           target[p] = newCell;
//           return newCell;
//         }
//       },
//     }
//   );
//   return all;
// }

// export const cells: Record<string, Cell> = defaultStorage({
//   // TODO: This is not really what I want. I think A1 should be
//   // an Observable I can use.
//   // TODO: Get dependencies.
//   // NOTE: This will pretty much define the interface for live-model
//   B1: (cells) => cells.A1.pipe(map((v) => !v)),
// });
export {};
