import { liveReference, parseLiveReference } from '../src/index.js';

describe('Live references', () => {
  test('constructs and parses a reference to a registry key', () => {
    const reference = liveReference('people/ada#profile');

    expect(reference).toEqual({
      $ref: 'live:people%2Fada%23profile',
    });
    expect(parseLiveReference(reference)).toEqual({
      key: 'people/ada#profile',
    });
  });

  test('constructs and parses a JSON Pointer fragment', () => {
    const reference = liveReference('people.1', '/profile/display name');

    expect(reference).toEqual({
      $ref: 'live:people.1#/profile/display%20name',
    });
    expect(parseLiveReference(reference)).toEqual({
      key: 'people.1',
      pointer: '/profile/display name',
    });
  });

  test('does not reserve objects with other properties', () => {
    expect(
      parseLiveReference({
        $ref: 'ordinary metadata',
        description: 'not a Live reference',
      })
    ).toBeUndefined();
  });

  test.each([
    [{ $ref: 1 }, 'string "$ref"'],
    [{ $ref: 'https://example.test/entity' }, '"live:" scheme'],
    [{ $ref: 'live:people.1#profile' }, 'must be empty or start with "/"'],
    [{ $ref: 'live:%zz' }, 'invalid URI encoding'],
  ])('rejects malformed reserved references', (reference, message) => {
    expect(() => parseLiveReference(reference)).toThrow(message);
  });
});
