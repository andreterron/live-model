import { setter, useDerived, useLiveState } from 'live-model';
import { BooleanControl } from './controls';
import { Card } from '../ui/card';
import { CardRow } from '../card-row';

export function DerivedSample() {
  const { value, setValue, live } = useLiveState('02-derived-stateful', false);
  const { value: notA, setValue: setNotA } = useDerived(
    live,
    (v) => !v,
    setter.transform((v) => !v)
  );

  return (
    <Card className="max-w-md divide-y">
      <CardRow label={<em>toggle_B</em>}>
        <BooleanControl value={value} onChange={(v) => setValue(v)} />
      </CardRow>
      <CardRow
        label={
          <>
            not(<em>toggle_B</em>)
          </>
        }
      >
        <BooleanControl value={notA} onChange={(v) => setNotA(v)} />
      </CardRow>
    </Card>
  );
}
