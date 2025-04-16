import { useLive } from 'live-model';
import { bitModel } from './sample-utils';
import { useMemo } from 'react';
import { Bit } from './bit';

export function ToggleSample() {
  // TODO: .create not working for booleans
  const bit = useMemo(
    () => bitModel.getOrCreate('01-toggle', { value: false }),
    []
  );

  const { value, set } = useLive(bit);
  return (
    <Bit
      value={value?.value ?? false}
      onClick={() => set({ value: !value?.value })}
    />
  );
}
