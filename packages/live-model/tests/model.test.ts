import { describe, test, expect } from 'vitest';
import { model_proto1, model_proto2 } from '../src/index.js';
import { z } from 'zod';
import { calc } from '../src/model/model_proto2.js';
import { BaseModel } from '../src/model/model_proto3.js';

type Meeting = {
  title: string;
  start: number;
  end: number;
};

const HOUR = 60 * 60 * 1000;

describe('model - prototype 1', () => {
  const meetings = model_proto1.model<Meeting>().withCalculated({
    duration: (m) => m.end - m.start,
  });

  test('calculated fields', async () => {
    const meeting = meetings.create({
      title: 'Test',
      start: new Date(2025, 0, 1, 12, 0, 0, 0).getTime(),
      end: new Date(2025, 0, 1, 13, 0, 0, 0).getTime(),
    });
    expect(meeting.duration).toEqual(1 * HOUR);
  });
});

// Fail
describe('model - prototype 2', () => {
  const meetings = model_proto2.model({
    title: z.string(),
    start: z.number(),
    end: z.number(),
    // Is there a way for a calculated field to see the type of its sibling properties?
    duration: calc((input) => {
      // NOTE: No types
      input.end - input.start;
    }),
  });

  test('calculated fields', async () => {
    const meeting = meetings.create({
      title: 'Test',
      start: new Date(2025, 0, 1, 12, 0, 0, 0).getTime(),
      end: new Date(2025, 0, 1, 13, 0, 0, 0).getTime(),
    });
    expect(meeting.duration).toEqual(1 * HOUR);
  });
});

// Also fail
describe('model - prototype 3', () => {
  class Meeting3 extends BaseModel<Meeting3> {
    title = z.string();
    start = z.number();
    end = z.number();

    // Failed: circular types
    // duration = this._calc(input => {
    //   return input.end - input.start
    // })

    // Works if the return type is specified
    duration = this._calc((input): number => {
      return input.end - input.start;
    });
  }
});
