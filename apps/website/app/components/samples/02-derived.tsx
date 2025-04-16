import { useLiveState } from 'live-model';
import { Bit } from './bit';
import { ArrowRight } from 'lucide-react';

export function DerivedSample() {
  const { value, setValue } = useLiveState('02-derived-stateful', false);
  return (
    <div className="flex items-center gap-1">
      <div className="flex flex-col items-center gap-1 w-11">
        <Bit value={value} onClick={() => setValue(!value)} />
        <span className="text-xs font-mono">A</span>
      </div>
      {/* TODO: Use the actual Live */}
      <div className="flex flex-col items-center gap-1">
        <ArrowRight />
        <span className="text-xs font-mono">&nbsp;</span>
      </div>
      <div className="flex flex-col items-center gap-1 w-11">
        <Bit value={!value} onClick={() => setValue(!value)} />
        <span className="text-xs font-mono">not(A)</span>
      </div>
    </div>
  );
}
