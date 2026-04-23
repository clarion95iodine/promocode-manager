export interface DateRange {
  from: Date;
  to: Date;
}

export function parseDateRange(dateFrom?: string, dateTo?: string): DateRange | undefined {
  if (!dateFrom && !dateTo) {
    return undefined;
  }

  const from = dateFrom ? new Date(dateFrom) : new Date('1970-01-01T00:00:00.000Z');
  const to = dateTo ? new Date(dateTo) : new Date();

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('Invalid date range');
  }

  return { from, to };
}

export function toIso(date: Date): string {
  return date.toISOString();
}
