import { createLiveFilterGuard, type LiveFilter } from '../src/index.js';

interface Article {
  title: string;
  score: number;
  published: boolean;
  tags: string[];
  author: { name: string };
  revisions: Array<{ label: string }>;
}

const article: Article = {
  title: 'Introduction to Live Model',
  score: 12,
  published: true,
  tags: ['typescript', 'data'],
  author: { name: 'Ada' },
  revisions: [{ label: 'draft' }, { label: 'final' }],
};

const invalidTypedFilter: LiveFilter<Article> = {
  score: {
    // @ts-expect-error String operators are unavailable on numeric fields.
    $startsWith: '1',
  },
};
void invalidTypedFilter;

describe('LiveFilter', () => {
  test.each<[LiveFilter<Article>, boolean]>([
    [{ 'author.name': 'Ada' }, true],
    [{ 'revisions.1.label': { $eq: 'final' } }, true],
    [{ score: { $gte: 10, $lt: 20 } }, true],
    [{ published: { $in: [true] } }, true],
    [{ published: { $ne: false } }, true],
    [{ published: { $nin: [] } }, true],
    [{ tags: { $contains: 'typescript' } }, true],
    [{ title: { $startsWith: 'Introduction' } }, true],
    [
      { title: { $containsText: { value: 'LIVE', caseSensitive: false } } },
      true,
    ],
    [{ title: { $endsWith: { value: 'model', caseSensitive: false } } }, true],
    [{ $and: [{ score: { $gt: 10 } }, { published: true }] }, true],
    [{ $or: [{ score: { $lt: 0 } }, { published: true }] }, true],
    [{ $nor: [{ score: { $lt: 0 } }, { published: false }] }, true],
    [{ score: { $eq: '12' } } as unknown as LiveFilter<Article>, false],
  ])('evaluates %j', (filter, expected) => {
    expect(createLiveFilterGuard(filter)(article)).toBe(expected);
  });

  test.each([
    { title: { $regex: '^Intro' } },
    { title: { $eq: null } },
    { tags: { $elemMatch: { $eq: 'typescript' } } },
  ])('rejects unsupported operators and values', (filter) => {
    expect(() => createLiveFilterGuard(filter)).toThrow();
  });

  test('does not traverse inherited properties', () => {
    expect(
      createLiveFilterGuard({ 'constructor.name': 'Object' })(article)
    ).toBe(false);
  });
});
