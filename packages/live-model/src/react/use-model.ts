import { useMemo } from 'react';
import { AnyLiveModelType, LiveModelType, Model } from '../model/model.js';
import { useSubscribe } from './use-subscribe.js';

function useModelDefinition<T extends LiveModelType = AnyLiveModelType>(
  modelOrKey: string | Model<T>
) {
  return useMemo(() => {
    const model =
      typeof modelOrKey === 'string' ? new Model<T>(modelOrKey) : modelOrKey;
    return {
      model,
      live: model.selectAll(),
      create: model.create.bind(model),
      deleteById: model.deleteById.bind(model),
      updateById: (id: string, v: T) => model.selectById(id).setValue(v),
    };
  }, [modelOrKey]);
}

export function useModel<T extends LiveModelType = AnyLiveModelType>(
  modelOrKey: string | Model<T>
) {
  const result = useModelDefinition<T>(modelOrKey);

  const { value: items, setValue: setItems } = useSubscribe(result.live);

  return {
    ...result,
    items,
    setItems,
  };
}

export function useModelItem<T extends LiveModelType = AnyLiveModelType>(
  modelOrKey: string | Model<T>,
  id: string
) {
  const { model } = useModelDefinition<T>(modelOrKey);
  const live = useMemo(() => model.selectById(id), [model, id]);
  const { value: item, setValue: setItem } = useSubscribe(live);

  return {
    item,
    model,
    live,
    setItem,
  };
}
