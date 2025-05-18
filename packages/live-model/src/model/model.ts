import { LocalStorageLive } from '../creators/local-storage-live.js';
import { Live } from '../live.js';
import { map } from '../operators/map.js';
import { LiveSetter } from '../setter.js';
import { generateId } from './generate-id.js';

export type LiveModelType = {
  id: string;
};
export interface AnyLiveModelType extends LiveModelType {
  [key: string]: any;
}

export class Model<T extends LiveModelType = AnyLiveModelType> {
  protected liveList: Live<T[]>;

  constructor(readonly key: string) {
    this.liveList = new LocalStorageLive<T[]>(key, []);
  }

  selectAll(): Live<T[]> {
    return this.liveList;
  }

  selectById(id: string): Live<T | undefined> {
    return this.find(
      (v) => v.id === id,
      (newValue, source) => {
        const list = source.get();
        if (newValue === undefined) {
          source.setValue(list.filter((v) => v.id !== id));
          return;
        }
        let isSet = false;
        const newList = list.map((item) => {
          if (item.id === id) {
            isSet = true;
            return newValue;
          }
          return item;
        });
        if (!isSet) {
          newList.push(newValue);
        }
        source.setValue(newList);
      }
    );
  }

  find(
    predicate: (v: T) => boolean,
    setter?: LiveSetter<T[], T | undefined>
  ): Live<T | undefined> {
    return map(
      this.liveList,
      (list) => list.find((v) => predicate(v)),
      setter ??
        ((newValue, source) => {
          const list = source.get();
          if (newValue === undefined) {
            console.error(
              'Trying to set the value of a `.find()` to undefined'
            );
            return;
          }
          let isSet = false;
          const newList = list.map((item) => {
            if (predicate(item)) {
              isSet = true;
              return newValue;
            }
            return item;
          });
          if (!isSet) {
            newList.push(newValue);
          }
          source.setValue(newList);
        })
    );
  }

  // Value will be undefined if the record is deleted later on
  create(data: Omit<T, 'id'>): Live<T | undefined> {
    const id = generateId();
    const item: T = Object.assign(data as T, {
      id,
    });
    const list = this.liveList.get();
    this.liveList.setValue(list.concat(item));
    return this.selectById(id);
  }

  deleteById(id: string) {
    const list = this.liveList.get();
    this.liveList.setValue(list.filter((v) => v.id !== id));
  }
}
