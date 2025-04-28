import { setter, useDerived, useLiveState } from 'live-model';
import { Bit, LabeledBit } from './bit';
import { ArrowRight } from 'lucide-react';

export function ReactivitySample() {
  const { value: v1, setValue: setV1 } = useLiveState(
    '03-reactivity-local-storage',
    false
  );
  const { value: v2, setValue: setV2 } = useLiveState(
    '03-reactivity-local-storage',
    false
  );
  return (
    <div className="flex items-center gap-1">
      <LabeledBit label="A" value={v1} onChange={(v) => setV1(v)} />
      <LabeledBit label="A" value={v2} onChange={(v) => setV2(v)} />
    </div>
  );
}
