import { describe, test, expect } from 'vitest';
import { model } from '../src/index.js';
import { z } from 'zod';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

describe('model', () => {
  const meetings = model<{
    title: string;
    start: number;
    end: number;
  }>()
    .extend(({ calc }) => ({
      duration: calc((m) => m.end - m.start),
      arriveAt: calc((m) => m.start - 10 * MINUTE),
    }))
    .extend(({ calc }) => ({
      leaveAt: calc((m) => m.arriveAt + m.duration + 15 * MINUTE),
    }));

  const meetingsZod = model({
    title: z.string(),
    start: z.number(),
    end: z.number(),
  })
    .extend(({ calc }) => ({
      duration: calc((m) => m.end - m.start),
      arriveAt: calc((m) => m.start - 10 * MINUTE),
    }))
    .extend(({ calc }) => ({
      leaveAt: calc((m) => m.arriveAt + m.duration + 15 * MINUTE),
    }));

  test('calculated fields', async () => {
    const meeting = meetings.create({
      title: 'Test',
      start: new Date(2025, 0, 1, 12, 0, 0, 0).getTime(),
      end: new Date(2025, 0, 1, 13, 0, 0, 0).getTime(),
    });
    expect(meeting.duration).toEqual(1 * HOUR);
  });
});
