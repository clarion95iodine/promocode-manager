import { Injectable } from '@nestjs/common';
import { ClickHouseService } from '../../infrastructure/clickhouse.service';
import { RedisService } from '../../infrastructure/redis.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AnalyticsTableResponse, PromocodeAnalyticsRow, PromoUsageAnalyticsRow, UsersAnalyticsRow } from './analytics.types';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly clickHouseService: ClickHouseService,
    private readonly redisService: RedisService,
  ) {}

  async users(query: AnalyticsQueryDto): Promise<AnalyticsTableResponse<UsersAnalyticsRow>> {
    const cacheKey = `analytics:users:${JSON.stringify(query)}`;
    return this.redisService.withCache(cacheKey, 30, async () => {
      const { rows, total } = await this.usersQuery(query);
      return { data: rows, meta: { page: query.page, pageSize: query.pageSize, total } };
    });
  }

  async promocodes(query: AnalyticsQueryDto): Promise<AnalyticsTableResponse<PromocodeAnalyticsRow>> {
    const cacheKey = `analytics:promocodes:${JSON.stringify(query)}`;
    return this.redisService.withCache(cacheKey, 30, async () => {
      const { rows, total } = await this.promocodesQuery(query);
      return { data: rows, meta: { page: query.page, pageSize: query.pageSize, total } };
    });
  }

  async promoUsages(query: AnalyticsQueryDto): Promise<AnalyticsTableResponse<PromoUsageAnalyticsRow>> {
    const cacheKey = `analytics:promo-usages:${JSON.stringify(query)}`;
    return this.redisService.withCache(cacheKey, 30, async () => {
      const { rows, total } = await this.promoUsagesQuery(query);
      return { data: rows, meta: { page: query.page, pageSize: query.pageSize, total } };
    });
  }

  private async usersQuery(query: AnalyticsQueryDto): Promise<{ rows: UsersAnalyticsRow[]; total: number }> {
    const orderBy = this.orderBy(query.sortBy, query.sortDirection, {
      createdAt: 'u.createdAt',
      email: 'u.email',
      name: 'u.name',
      totalOrders: 'totalOrders',
      totalSpent: 'totalSpent',
      promoUses: 'promoUses',
    });

    const params = this.queryParams(query);
    const rows = await this.clickHouseService.queryRows<UsersAnalyticsRow>(`
      WITH order_stats AS (
        SELECT userId, count() AS totalOrders, sum(amount) AS totalSpent
        FROM default.orders
        WHERE toDateTime64(createdAt, 3, 'UTC') >= toDateTime64({dateFrom:String}, 3, 'UTC')
          AND toDateTime64(createdAt, 3, 'UTC') <= toDateTime64({dateTo:String}, 3, 'UTC')
        GROUP BY userId
      ), usage_stats AS (
        SELECT userId, count() AS promoUses, sum(discountAmount) AS totalDiscount
        FROM default.promo_usages
        WHERE toDateTime64(createdAt, 3, 'UTC') >= toDateTime64({dateFrom:String}, 3, 'UTC')
          AND toDateTime64(createdAt, 3, 'UTC') <= toDateTime64({dateTo:String}, 3, 'UTC')
        GROUP BY userId
      )
      SELECT
        u.id,
        u.email,
        u.name,
        u.phone,
        u.isActive,
        toString(u.createdAt) AS createdAt,
        ifNull(o.totalOrders, 0) AS totalOrders,
        ifNull(o.totalSpent, 0) AS totalSpent,
        ifNull(us.totalDiscount, 0) AS totalDiscount,
        ifNull(us.promoUses, 0) AS promoUses
      FROM default.users AS u
      LEFT JOIN order_stats AS o ON o.userId = u.id
      LEFT JOIN usage_stats AS us ON us.userId = u.id
      WHERE toDateTime64(u.createdAt, 3, 'UTC') >= toDateTime64({dateFrom:String}, 3, 'UTC')
        AND toDateTime64(u.createdAt, 3, 'UTC') <= toDateTime64({dateTo:String}, 3, 'UTC')
        AND (${this.filterClause(['u.email', 'u.name', 'u.phone'], 'search')})
      ORDER BY ${orderBy}
      LIMIT {limit:UInt64}
      OFFSET {offset:UInt64}
    `, params);

    const totalRow = await this.clickHouseService.queryOne<{ total: string }>(`
      SELECT count() AS total
      FROM default.users AS u
      WHERE toDateTime64(u.createdAt, 3, 'UTC') >= toDateTime64({dateFrom:String}, 3, 'UTC')
        AND toDateTime64(u.createdAt, 3, 'UTC') <= toDateTime64({dateTo:String}, 3, 'UTC')
        AND (${this.filterClause(['u.email', 'u.name', 'u.phone'], 'search')})
    `, params);

    return { rows, total: Number(totalRow?.total ?? rows.length) };
  }

  private async promocodesQuery(query: AnalyticsQueryDto): Promise<{ rows: PromocodeAnalyticsRow[]; total: number }> {
    const orderBy = this.orderBy(query.sortBy, query.sortDirection, {
      createdAt: 'p.createdAt',
      code: 'p.code',
      discountPercent: 'p.discountPercent',
      usageCount: 'p.usageCount',
      revenue: 'revenue',
      uniqueUsers: 'uniqueUsers',
    });

    const params = this.queryParams(query);
    const rows = await this.clickHouseService.queryRows<PromocodeAnalyticsRow>(`
      WITH latest_promocodes AS (
        SELECT *
        FROM default.promocodes
        ORDER BY updatedAt DESC, createdAt DESC
        LIMIT 1 BY id
      ),
      promo_stats AS (
        SELECT promocodeId, sum(orderAmount) AS revenue, uniqExact(userId) AS uniqueUsers
        FROM default.promo_usages
        WHERE createdAt >= toDateTime64({dateFrom:String}, 3, 'UTC')
          AND createdAt <= toDateTime64({dateTo:String}, 3, 'UTC')
        GROUP BY promocodeId
      )
      SELECT
        p.id,
        p.code,
        p.discountPercent,
        p.totalUsageLimit,
        p.perUserLimit,
        p.usageCount,
        ifNull(ps.revenue, 0) AS revenue,
        ifNull(ps.uniqueUsers, 0) AS uniqueUsers,
        if(isNull(p.dateFrom), NULL, toString(p.dateFrom)) AS dateFrom,
        if(isNull(p.dateTo), NULL, toString(p.dateTo)) AS dateTo,
        p.isActive,
        toString(p.createdAt) AS createdAt
      FROM latest_promocodes AS p
      LEFT JOIN promo_stats AS ps ON ps.promocodeId = p.id
      WHERE toDateTime64(p.createdAt, 3, 'UTC') >= toDateTime64({dateFrom:String}, 3, 'UTC')
        AND toDateTime64(p.createdAt, 3, 'UTC') <= toDateTime64({dateTo:String}, 3, 'UTC')
        AND (${this.filterClause(['p.code'], 'search')})
      ORDER BY ${orderBy}
      LIMIT {limit:UInt64}
      OFFSET {offset:UInt64}
    `, params);

    const totalRow = await this.clickHouseService.queryOne<{ total: string }>(`
      WITH latest_promocodes AS (
        SELECT *
        FROM default.promocodes
        ORDER BY updatedAt DESC, createdAt DESC
        LIMIT 1 BY id
      )
      SELECT count() AS total
      FROM latest_promocodes AS p
      WHERE toDateTime64(p.createdAt, 3, 'UTC') >= toDateTime64({dateFrom:String}, 3, 'UTC')
        AND toDateTime64(p.createdAt, 3, 'UTC') <= toDateTime64({dateTo:String}, 3, 'UTC')
        AND (${this.filterClause(['p.code'], 'search')})
    `, params);

    return { rows, total: Number(totalRow?.total ?? rows.length) };
  }

  private async promoUsagesQuery(query: AnalyticsQueryDto): Promise<{ rows: PromoUsageAnalyticsRow[]; total: number }> {
    const orderBy = this.orderBy(query.sortBy, query.sortDirection, {
      createdAt: 'createdAt',
      discountAmount: 'discountAmount',
      orderAmount: 'orderAmount',
      userEmail: 'userEmail',
      promocodeCode: 'promocodeCode',
    });

    const params = this.queryParams(query);
    const rows = await this.clickHouseService.queryRows<PromoUsageAnalyticsRow>(`
      SELECT
        id,
        orderId,
        userId,
        userEmail,
        userName,
        promocodeId,
        promocodeCode,
        discountAmount,
        orderAmount,
        toString(createdAt) AS createdAt
      FROM default.promo_usages
      WHERE toDateTime64(createdAt, 3, 'UTC') >= toDateTime64({dateFrom:String}, 3, 'UTC')
        AND toDateTime64(createdAt, 3, 'UTC') <= toDateTime64({dateTo:String}, 3, 'UTC')
        AND (${this.filterClause(['userEmail', 'userName', 'promocodeCode'], 'search')})
      ORDER BY ${orderBy}
      LIMIT {limit:UInt64}
      OFFSET {offset:UInt64}
    `, params);

    const totalRow = await this.clickHouseService.queryOne<{ total: string }>(`
      SELECT count() AS total
      FROM default.promo_usages
      WHERE toDateTime64(createdAt, 3, 'UTC') >= toDateTime64({dateFrom:String}, 3, 'UTC')
        AND toDateTime64(createdAt, 3, 'UTC') <= toDateTime64({dateTo:String}, 3, 'UTC')
        AND (${this.filterClause(['userEmail', 'userName', 'promocodeCode'], 'search')})
    `, params);

    return { rows, total: Number(totalRow?.total ?? rows.length) };
  }

  private queryParams(query: AnalyticsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const dateFrom = this.formatClickHouseDateTime64(query.dateFrom ? new Date(query.dateFrom) : new Date('1970-01-01T00:00:00.000Z'));
    const dateTo = this.formatClickHouseDateTime64(query.dateTo ? new Date(query.dateTo) : new Date());

    return {
      dateFrom,
      dateTo,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      search: query.search ? `%${query.search}%` : '',
    };
  }

  private formatClickHouseDateTime64(date: Date): string {
    if (Number.isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }

    const pad = (value: number, size = 2) => String(value).padStart(size, '0');
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`;
  }

  private filterClause(fields: string[], paramName: string): string {
    const matches = fields.map((field) => `${field} ILIKE {${paramName}:String}`).join(' OR ');
    return `{${paramName}:String} = '' OR (${matches})`;
  }

  private orderBy(sortBy: string | undefined, sortDirection: 'asc' | 'desc' | undefined, allowlist: Record<string, string>): string {
    const column = sortBy && allowlist[sortBy] ? allowlist[sortBy] : Object.values(allowlist)[0];
    const direction = sortDirection === 'asc' ? 'ASC' : 'DESC';
    return `${column} ${direction}`;
  }
}
