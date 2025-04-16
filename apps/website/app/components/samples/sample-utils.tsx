import { model } from 'live-model';

// TODO: Impossible to do model<boolean>()
export const bitModel = model<{ value: boolean }>().extend(({ action }) => ({
  // TODO: Actions should accept parameters
  toggle: action((v) => ({ value: !v.value })),
}));
