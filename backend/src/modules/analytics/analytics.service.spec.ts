import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { type AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AnalyticsService } from './analytics.service';
import { ClickHouseService } from '../../infrastructure/clickhouse.service';
import { RedisService } from '../../infrastructure/redis.service';

describe('AnalyticsService.users', () => {
  const queryRows = jest.fn() as unknown as jest.MockedFunction<(
    query: string,
    params?: Record<string, string | number | boolean | null>,
  ) => Promise<Array<{
    id: string;
    email: string;
    name: string;
    phone: string;
    isActive: number;
    createdAt: string;
    totalOrders: number;
    totalSpent: number;
    totalDiscount: number;
    promoUses: number;
  }>>>;
  const queryOne = jest.fn() as unknown as jest.MockedFunction<(
    query: string,
    params?: Record<string, string | number | boolean | null>,
  ) => Promise<{ total: string } | null>>;
  const clickHouseService = {
    queryRows,
    queryOne,
  } as unknown as ClickHouseService;

  const withCache = jest.fn(async <T>(_: string, __: number, loader: () => Promise<T>) => loader());
  const redisService = {
    withCache,
  } as unknown as RedisService;

  const service = new AnalyticsService(clickHouseService, redisService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('formats date parameters for ClickHouse and passes the expected query window', async () => {
    const query: AnalyticsQueryDto = {
      page: 2,
      pageSize: 10,
      search: 'john',
      dateFrom: '2026-04-15T15:01:29.022Z',
      dateTo: '2026-04-22T15:01:29.022Z',
      sortBy: 'email',
      sortDirection: 'desc',
    };

    queryRows.mockResolvedValue([
      {
        id: 'u1',
        email: 'john@example.com',
        name: 'John Doe',
        phone: '+1234567890',
        isActive: 1,
        createdAt: '2026-04-20 10:00:00.000',
        totalOrders: 3,
        totalSpent: 300,
        totalDiscount: 30,
        promoUses: 1,
      },
    ]);
    queryOne.mockResolvedValue({ total: '1' });

    const result = await service.users(query);

    expect(withCache).toHaveBeenCalledWith(
      `analytics:users:${JSON.stringify(query)}`,
      30,
      expect.any(Function),
    );
    expect(queryRows).toHaveBeenCalledTimes(1);
    expect(queryOne).toHaveBeenCalledTimes(1);

    const [, params] = queryRows.mock.calls[0] as [string, Record<string, string | number | boolean | null>];
    expect(params).toEqual(expect.objectContaining({
      dateFrom: '2026-04-15 15:01:29.022',
      dateTo: '2026-04-22 15:01:29.022',
      limit: 10,
      offset: 10,
      search: '%john%',
    }));

    const querySql = queryRows.mock.calls[0][0] as string;
    expect(querySql).toContain('toDateTime64({dateFrom:String}, 3, \'UTC\')');
    expect(querySql).toContain('toDateTime64({dateTo:String}, 3, \'UTC\')');
    expect(querySql).toContain('ILIKE {search:String}');
    expect(result).toEqual({
      data: [
        {
          id: 'u1',
          email: 'john@example.com',
          name: 'John Doe',
          phone: '+1234567890',
          isActive: 1,
          createdAt: '2026-04-20 10:00:00.000',
          totalOrders: 3,
          totalSpent: 300,
          totalDiscount: 30,
          promoUses: 1,
        },
      ],
      meta: { page: 2, pageSize: 10, total: 1 },
    });
  });
});

describe('AnalyticsService.promocodes', () => {
  const queryRows = jest.fn() as unknown as jest.MockedFunction<(
    query: string,
    params?: Record<string, string | number | boolean | null>,
  ) => Promise<Array<{
    id: string;
    code: string;
    discountPercent: number;
    totalUsageLimit: number | null;
    perUserLimit: number | null;
    usageCount: number;
    revenue: number;
    uniqueUsers: number;
    dateFrom: string | null;
    dateTo: string | null;
    isActive: number;
    createdAt: string;
  }>>>;
  const queryOne = jest.fn() as unknown as jest.MockedFunction<(
    query: string,
    params?: Record<string, string | number | boolean | null>,
  ) => Promise<{ total: string } | null>>;
  const clickHouseService = {
    queryRows,
    queryOne,
  } as unknown as ClickHouseService;

  const withCache = jest.fn(async <T>(_: string, __: number, loader: () => Promise<T>) => loader());
  const redisService = {
    withCache,
  } as unknown as RedisService;

  const service = new AnalyticsService(clickHouseService, redisService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deduplicates promo snapshots and uses the latest row per id', async () => {
    const query: AnalyticsQueryDto = {
      page: 1,
      pageSize: 10,
      search: '',
      dateFrom: '2026-04-15T15:01:29.022Z',
      dateTo: '2026-04-22T15:01:29.022Z',
      sortBy: 'code',
      sortDirection: 'desc',
    };

    queryRows.mockResolvedValue([
      {
        id: 'p1',
        code: 'WELCOME10',
        discountPercent: 10,
        totalUsageLimit: 100,
        perUserLimit: 1,
        usageCount: 1,
        revenue: 200,
        uniqueUsers: 1,
        dateFrom: '2026-04-20 10:00:00.000',
        dateTo: '2026-05-23 10:00:00.000',
        isActive: 1,
        createdAt: '2026-04-21 10:00:00.000',
      },
    ]);
    queryOne.mockResolvedValue({ total: '1' });

    const result = await service.promocodes(query);

    expect(withCache).toHaveBeenCalledWith(
      `analytics:promocodes:${JSON.stringify(query)}`,
      30,
      expect.any(Function),
    );
    expect(queryRows).toHaveBeenCalledTimes(1);
    expect(queryOne).toHaveBeenCalledTimes(1);

    const querySql = queryRows.mock.calls[0][0] as string;
    expect(querySql).toContain('latest_promocodes');
    expect(querySql).toContain('LIMIT 1 BY id');
    expect(querySql).toContain('ORDER BY updatedAt DESC, createdAt DESC');

    expect(result).toEqual({
      data: [
        {
          id: 'p1',
          code: 'WELCOME10',
          discountPercent: 10,
          totalUsageLimit: 100,
          perUserLimit: 1,
          usageCount: 1,
          revenue: 200,
          uniqueUsers: 1,
          dateFrom: '2026-04-20 10:00:00.000',
          dateTo: '2026-05-23 10:00:00.000',
          isActive: 1,
          createdAt: '2026-04-21 10:00:00.000',
        },
      ],
      meta: { page: 1, pageSize: 10, total: 1 },
    });
  });
});
