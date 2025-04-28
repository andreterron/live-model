import { useLiveState } from 'live-model';
import { Bit } from './bit';

export function ToggleSample() {
  const { value, setValue } = useLiveState('01-toggle', false);
  return <Bit value={value} onChange={(v) => setValue(v)} />;
}
