import { buildType } from 'live-model';
import { z } from 'zod';

export const counterOperationSet = buildType('counter')
  .operation('increment', z.number(), (state: number, amount) => {
    if (typeof state !== 'number') {
      throw new Error('increment requires a numeric counter value');
    }
    return state + amount;
  })
  .operation('reset', undefined, () => 0);
