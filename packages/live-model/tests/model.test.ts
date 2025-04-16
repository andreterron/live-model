import { describe, test, expect } from 'vitest';
import { model } from '../src/index.js';
import { z } from 'zod';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const HOURLY_COST = 100;

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
      cost: calc((m) => (m.duration * HOURLY_COST) / HOUR),
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
      cost: calc((m) => (m.duration * HOURLY_COST) / HOUR),
    }));

  test('calculated fields', async () => {
    const meeting = meetings.create({
      title: 'Test',
      start: new Date(2025, 0, 1, 12, 0, 0, 0).getTime(),
      end: new Date(2025, 0, 1, 13, 0, 0, 0).getTime(),
    });

    // expect(meeting.value?.duration).toEqual(1 * HOUR);
  });
});
