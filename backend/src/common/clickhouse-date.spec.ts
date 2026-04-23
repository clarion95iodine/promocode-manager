import { describe, expect, it } from '@jest/globals';
import { formatClickHouseDateTime64 } from './clickhouse-date';

describe('formatClickHouseDateTime64', () => {
  it('formats UTC dates in ClickHouse DateTime64 style', () => {
    const value = formatClickHouseDateTime64(new Date('2024-01-02T03:04:05.006Z'));
    expect(value).toBe('2024-01-02 03:04:05.006');
  });

  it('pads single-digit date parts', () => {
    const value = formatClickHouseDateTime64(new Date('2024-11-03T04:05:06.007Z'));
    expect(value).toBe('2024-11-03 04:05:06.007');
  });

  it('throws on invalid dates', () => {
    expect(() => formatClickHouseDateTime64(new Date('invalid'))).toThrow('Invalid date');
  });
});
