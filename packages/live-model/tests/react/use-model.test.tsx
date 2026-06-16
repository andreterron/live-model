/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { LiveModelType, Model, useModel } from '../../src/index.js';
import {
  clearWebSocketData,
  mockWebSocketData,
} from '../test-utils/mock-web-socket-transport.js';

interface NamedItem extends LiveModelType {
  name: string;
}

describe('react useModel', () => {
  const namedItemKey = 'livemodel.test.named';
  let namedItemModel: Model<NamedItem>;

  beforeEach(() => {
    mockWebSocketData({ [namedItemKey]: [{ id: 'one', name: 'foo' }] });
    namedItemModel = new Model<NamedItem>(namedItemKey);
  });

  afterEach(() => {
    clearWebSocketData();
  });

  it('should accept strings', async () => {
    let { result } = renderHook(() => useModel(namedItemKey));
    await waitFor(() =>
      expect(result.current.items).toMatchObject([
        { id: expect.any(String), name: 'foo' },
      ])
    );
  });

  it('should accept models', async () => {
    let { result } = renderHook(() => useModel(namedItemModel));
    await waitFor(() =>
      expect(result.current.items).toMatchObject([
        { id: expect.any(String), name: 'foo' },
      ])
    );
  });

  it('should be typed when using a model', async () => {
    let { result } = renderHook(() => useModel(namedItemModel));
    expectTypeOf(result.current.items).toEqualTypeOf<NamedItem[]>();
  });
  it('should accept a type parameter when using strings', async () => {
    let { result } = renderHook(() => useModel<NamedItem>(namedItemKey));
    expectTypeOf(result.current.items).toEqualTypeOf<NamedItem[]>();
  });
});
