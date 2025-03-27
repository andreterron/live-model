'use client';

import { useData } from 'live-model';
import { useMemo } from 'react';

interface CellProps {
  row: number;
  col: string;
}

export function Cell({ row, col }: CellProps) {
  const key = useMemo(() => `${col}${row}`, [row, col]);

  const { value, set } = useData(key, false, { initializeWithValue: true });

  return (
    <div
      className={`w-8 h-8 rounded-full border-2 border-current mx-auto cursor-pointer
        ${value ? 'bg-current/50' : 'bg-transparent'}`}
      onClick={() => set(!value)}
    ></div>
  );
}
