import { useLiveState } from 'live-model';
import { BooleanControl } from './controls';
import { Card } from '../ui/card';
import { CardRow } from '../card-row';

export function ToggleSample() {
  const { value, setValue } = useLiveState('01-toggle', false);
  return (
    <Card className="max-w-md divide-x">
      <CardRow label={<em>toggle_A</em>}>
        <BooleanControl value={value} onChange={(v) => setValue(v)} />
      </CardRow>
    </Card>
  );
}
