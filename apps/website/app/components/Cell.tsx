'use client';

import { useData } from 'live-model';
import { useMemo } from 'react';

interface CellProps {
  row: number;
  col: string;
}

export function Cell({ row, col }: CellProps) {
  const key = useMemo(() => `${col}${row}`, [row, col]);

  // TODO: How would this behave for calculated cells?
  //       Either we know how to get the cell from the key, or
  //       we do useData(cells.get('A1'), false, { ... }).
  //       And the `cells` model itself would have to store
  //       whether that cell is calculated or not.
  //       This might not be the "easy" POC I'm looking for...
  //       Unless... I think lib/cells.tsx is becoming the easy POC
  const { value, set } = useData(key, false, { initializeWithValue: true });

  return (
    <div
      className={`w-8 h-8 rounded-full border-2 border-current mx-auto cursor-pointer
        ${value ? 'bg-current/50' : 'bg-transparent'}`}
      onClick={() => set(!value)}
    ></div>
  );
}
