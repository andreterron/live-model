import { useLive } from 'live-model';
import { bitModel } from './sample-utils';
import { useMemo } from 'react';
import { Bit } from './bit';
import { ArrowRight } from 'lucide-react';

export function DerivedSample() {
  // TODO: .create not working for booleans
  const statefulBit = useMemo(
    () => bitModel.getOrCreate('02-derived-stateful', { value: false }),
    []
  );
  // TODO: Define this
  // const derivedBit = useMemo(
  //   () => bitModel.getOrCreate('02-derived-base', { value: true }),
  //   []
  // );

  const { value, set } = useLive(statefulBit);
  return (
    <div className="flex items-center gap-1">
      <div className="flex flex-col items-center gap-1 w-11">
        <Bit
          value={value?.value ?? false}
          onClick={() => set({ value: !value?.value })}
        />
        <span className="text-xs font-mono">A</span>
      </div>
      {/* TODO: Use the actual Live */}
      <div className="flex flex-col items-center gap-1">
        <ArrowRight />
        <span className="text-xs font-mono">&nbsp;</span>
      </div>
      <div className="flex flex-col items-center gap-1 w-11">
        <Bit
          value={!value?.value}
          onClick={() => set({ value: !value?.value })}
        />
        <span className="text-xs font-mono">not(A)</span>
      </div>
    </div>
  );
}
