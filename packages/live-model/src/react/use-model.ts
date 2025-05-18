import { useMemo } from 'react';
import { AnyLiveModelType, LiveModelType, Model } from '../model/model.js';
import { useSubscribe } from './use-subscribe.js';

function useModelDefinition<T extends LiveModelType = AnyLiveModelType>(
  key: string
) {
  return useMemo(() => {
    const model = new Model<T>(key);
    return {
      model,
      live: model.selectAll(),
      create: model.create.bind(model),
      deleteById: model.deleteById.bind(model),
      updateById: (id: string, v: T) => model.selectById(id).setValue(v),
    };
  }, [key]);
}

export function useModel<T extends LiveModelType = AnyLiveModelType>(
  key: string
) {
  const result = useModelDefinition<T>(key);

  const { value: items, setValue: setItems } = useSubscribe(result.live);

  return {
    ...result,
    items,
    setItems,
  };
}

export function useModelItem<T extends LiveModelType = AnyLiveModelType>(
  modelKey: string,
  id: string
) {
  const { model } = useModelDefinition<T>(modelKey);
  const live = useMemo(() => model.selectById(id), [model, id]);
  const { value: item, setValue: setItem } = useSubscribe(live);

  return {
    item,
    model,
    live,
    setItem,
  };
}
