import {
  LiveState,
  setter,
  useDerived,
  useDerivedValue,
  useLiveState,
} from 'live-model';
import { BooleanControl } from './controls';
import { Card } from '../ui/card';
import { CardRow } from '../card-row';

export function DerivedSample() {
  const { value, setValue, live } = useLiveState('02-derived-stateful', false);
  // TODO: `false` should be the default value of the `live` above, instead of hand-handling on the useDerived below.
  const { value: notA, setValue: setNotA } = useDerived(
    live,
    (state) => {
      if (state.kind === 'value') {
        return LiveState.value(!state.value);
      } else if (
        state.kind === 'absent' &&
        (state.reason === 'not_found' || state.reason === 'deleted')
      ) {
        // Considers the value as `false` by default
        return LiveState.value(!false);
      }
      console.log('Unexpected state:', state);
      return state;
    },
    setter.transform((v) => !v)
  );

  return (
    <Card className="max-w-md divide-y">
      <CardRow label="toggle_B">
        <BooleanControl value={value} onChange={(v) => setValue(v)} />
      </CardRow>
      <CardRow
        label={
          <>
            not(<em>toggle_B</em>)
          </>
        }
      >
        <BooleanControl value={notA ?? false} onChange={(v) => setNotA(v)} />
      </CardRow>
    </Card>
  );
}
