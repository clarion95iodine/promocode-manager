export function formatClickHouseDateTime64(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }

  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`;
}
