import { useLiveState } from 'live-model';
import { BooleanControl } from './controls';
import { CardRow } from '../card-row';
import { Card } from '../ui/card';
import { ArrowUpDownIcon, ChevronsUpDownIcon } from 'lucide-react';

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
    <div className="flex flex-col gap-3">
      <Card className="max-w-md divide-y">
        <CardRow label={<em>toggle_C</em>}>
          <BooleanControl value={v1} onChange={(v) => setV1(v)} />
        </CardRow>
      </Card>
      <div className="flex items-center gap-2 text-sm pl-3">
        <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
        <span>
          Different Live States using the same key{' '}
          <span className="text-muted-foreground text-xs">
            (they also sync accross tabs!)
          </span>
        </span>
      </div>
      <Card className="max-w-md divide-y">
        <CardRow label={<em>toggle_C</em>}>
          <BooleanControl value={v2} onChange={(v) => setV2(v)} />
        </CardRow>
      </Card>
    </div>
  );
}
