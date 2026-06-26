import { LiveRegistry } from '../src/index.js';

describe('LiveRegistry', () => {
  afterEach(() => {
    LiveRegistry.clear();
  });

  test('returns the same live for the same key', () => {
    expect(LiveRegistry.forKey('people.1')).toBe(
      LiveRegistry.forKey('people.1')
    );
  });

  test('returns different lives for different keys', () => {
    expect(LiveRegistry.forKey('people.1')).not.toBe(
      LiveRegistry.forKey('people.2')
    );
  });
});
