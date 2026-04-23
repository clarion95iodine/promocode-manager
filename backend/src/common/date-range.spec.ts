import { describe, expect, it } from '@jest/globals';
import { parseDateRange } from './date-range';

describe('parseDateRange', () => {
  it('returns undefined when no dates provided', () => {
    expect(parseDateRange()).toBeUndefined();
  });

  it('parses start and end dates', () => {
    const range = parseDateRange('2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z');
    expect(range?.from.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    expect(range?.to.toISOString()).toBe('2024-01-31T23:59:59.999Z');
  });

  it('uses default boundaries when only one side is provided', () => {
    const range = parseDateRange(undefined, '2024-01-31T23:59:59.999Z');
    expect(range?.from.toISOString()).toBe('1970-01-01T00:00:00.000Z');
    expect(range?.to.toISOString()).toBe('2024-01-31T23:59:59.999Z');
  });

  it('throws when one of the dates is invalid', () => {
    expect(() => parseDateRange('invalid', '2024-01-31T23:59:59.999Z')).toThrow('Invalid date range');
  });
});
