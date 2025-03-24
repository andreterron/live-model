export type CalcBase<T> = Record<string, (obj: T) => any>;

export type CalculatedFieldsOf<T extends CalcBase<any>> = {
  [K in keyof T]: ReturnType<T[K]>;
};

export function model<T = {}>() {
  return {
    withCalculated<CALC extends Record<string, (obj: T) => any>>(calc: CALC) {
      return {
        create(values: T): CalculatedFieldsOf<CALC> & T {
          return {
            ...values,
            ...(Object.fromEntries(
              Object.entries(calc).map(([k, fn]) => {
                return [k, fn(values)] as const;
              })
            ) as CalculatedFieldsOf<CALC>),
          };
        },
      };
    },
  };
}
