import type { Route } from './+types/home';
import { Cell } from '~/components/Cell';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Live Model' },
    { name: 'description', content: 'Welcome to Live Model!' },
  ];
}

export function clientLoader({}: Route.ClientLoaderArgs) {
  return {};
}

export default function Home() {
  // Generate column headers (A-Z)
  const columns = Array.from({ length: 10 }, (_, i) =>
    String.fromCharCode(65 + i)
  );

  return (
    <div className="min-h-screen p-8">
      <div className="overflow-auto">
        <table className="w-fit">
          <thead>
            <tr>
              <th className="w-12 h-12"></th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="w-12 h-12 p-2 text-current text-center"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }, (_, i) => (
              <tr key={i}>
                <td className="w-12 h-12 text-current text-center p-2">
                  {i + 1}
                </td>
                {columns.map((col) => (
                  <td key={`${i}-${col}`} className="w-12 h-12 p-2">
                    <Cell row={i + 1} col={col} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
