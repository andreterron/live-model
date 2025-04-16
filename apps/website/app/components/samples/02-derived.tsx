import { setter, useDerived, useLiveState } from 'live-model';
import { Bit } from './bit';
import { ArrowRight } from 'lucide-react';

export function DerivedSample() {
  const { value, setValue, live } = useLiveState('02-derived-stateful', false);
  const { value: notA, setValue: setNotA } = useDerived(
    live,
    (v) => !v,
    setter.transform((v) => !v)
  );
  return (
    <div className="flex items-center gap-1">
      <div className="flex flex-col items-center gap-1 w-11">
        <Bit value={value} onClick={() => setValue(!value)} />
        <span className="text-xs font-mono">A</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <ArrowRight />
        <span className="text-xs font-mono">&nbsp;</span>
      </div>
      <div className="flex flex-col items-center gap-1 w-11">
        <Bit value={notA} onClick={() => setNotA(!notA)} />
        <span className="text-xs font-mono">not(A)</span>
      </div>
    </div>
  );
}
