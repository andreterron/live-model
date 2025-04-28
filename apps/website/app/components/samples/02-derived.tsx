import { setter, useDerived, useLiveState } from 'live-model';
import { Bit, LabeledBit } from './bit';
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
      <LabeledBit label="A" value={value} onChange={(v) => setValue(v)} />
      <div className="flex flex-col items-center gap-1">
        <ArrowRight />
        <span className="text-xs font-mono">&nbsp;</span>
      </div>
      <LabeledBit label="not(A)" value={notA} onChange={(v) => setNotA(v)} />
    </div>
  );
}
