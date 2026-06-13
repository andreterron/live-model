/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { LiveModelType, Model, useModel } from '../../src/index.js';
import { clearData, mockData } from '../test-utils/mock-data.js';

interface NamedItem extends LiveModelType {
  name: string;
}

describe('react useModel', () => {
  const namedItemKey = 'livemodel.test.named';
  const namedItemModel = new Model<NamedItem>(namedItemKey);

  beforeEach(() => {
    mockData({ [namedItemKey]: [{ id: 'one', name: 'foo' }] });
  });

  afterEach(() => {
    clearData();
  });

  it('should accept strings', async () => {
    let { result } = renderHook(() => useModel(namedItemKey));
    expect(result.current.items).toMatchObject([
      { id: expect.any(String), name: 'foo' },
    ]);
  });

  it('should accept models', async () => {
    let { result } = renderHook(() => useModel(namedItemModel));
    expect(result.current.items).toMatchObject([
      { id: expect.any(String), name: 'foo' },
    ]);
  });

  it('should be typed when using a model', async () => {
    let { result } = renderHook(() => useModel(namedItemModel));
    expectTypeOf(result.current.items).toEqualTypeOf<NamedItem[] | undefined>();
  });
  it('should accept a type parameter when using strings', async () => {
    let { result } = renderHook(() => useModel<NamedItem>(namedItemKey));
    expectTypeOf(result.current.items).toEqualTypeOf<NamedItem[] | undefined>();
  });
});
