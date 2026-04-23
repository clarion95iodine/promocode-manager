import { Injectable, Logger } from '@nestjs/common';
import { createClient, ClickHouseClient } from '@clickhouse/client';

export interface ClickHouseConfig {
  url: string;
  username?: string;
  password?: string;
  database: string;
}

export type ClickHouseQueryParams = Record<string, string | number | boolean | null>;

export interface ClickHouseRow {
  [key: string]: unknown;
}

@Injectable()
export class ClickHouseService {
  private readonly logger = new Logger(ClickHouseService.name);
  private readonly client: ClickHouseClient;

  constructor() {
    const config: ClickHouseConfig = {
      url: process.env.CLICKHOUSE_URL ?? 'http://localhost:8123',
      username: process.env.CLICKHOUSE_USER,
      password: process.env.CLICKHOUSE_PASSWORD,
      database: process.env.CLICKHOUSE_DATABASE ?? 'default',
    };

    this.client = createClient(config);
  }

  async ping(): Promise<void> {
    await this.client.ping();
  }

  async queryRows<T extends object>(query: string, params: ClickHouseQueryParams = {}): Promise<T[]> {
    const result = await this.retry(() => this.client.query({
      query,
      format: 'JSONEachRow',
      query_params: params as Record<string, unknown>,
    }));

    const rows = await result.json<T>();
    return rows;
  }

  async queryOne<T extends object>(query: string, params: ClickHouseQueryParams = {}): Promise<T | null> {
    const rows = await this.queryRows<T>(query, params);
    return rows[0] ?? null;
  }

  async insertRows<T extends object>(table: string, rows: T[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    await this.retry(() => this.client.insert({
      table,
      values: rows,
      format: 'JSONEachRow',
    }));
  }

  async bootstrap(): Promise<void> {
    await this.executeStatement(`CREATE DATABASE IF NOT EXISTS ${this.database}`);
    await this.executeStatement(this.createUsersTableSql());
    await this.executeStatement(this.createPromocodesTableSql());
    await this.executeStatement(this.createOrdersTableSql());
    await this.executeStatement(this.createPromoUsagesTableSql());

    this.logger.log('ClickHouse tables are ready');
  }

  private async executeStatement(query: string): Promise<void> {
    const url = new URL('/?database=' + encodeURIComponent(this.database), process.env.CLICKHOUSE_URL ?? 'http://localhost:8123');
    const response = await fetch(url, {
      method: 'POST',
      headers: this.clickHouseHeaders(),
      body: query,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`ClickHouse bootstrap failed (${response.status}): ${text}`);
    }
  }

  private async retry<T>(operation: () => Promise<T>, attempts = 3, delayMs = 250): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await operation();
      } catch (error: unknown) {
        lastError = error;
        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error('ClickHouse operation failed');
  }

  private clickHouseHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'text/plain; charset=utf-8' };
    const username = process.env.CLICKHOUSE_USER;
    const password = process.env.CLICKHOUSE_PASSWORD;
    if (username && password) {
      headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    }
    return headers;
  }

  private get database(): string {
    return process.env.CLICKHOUSE_DATABASE ?? 'default';
  }

  private fqtn(table: string): string {
    return `${this.database}.${table}`;
  }

  private createUsersTableSql(): string {
    return `
      CREATE TABLE IF NOT EXISTS ${this.fqtn('users')} (
        id String,
        email String,
        name String,
        phone String,
        isActive UInt8,
        createdAt DateTime64(3, 'UTC'),
        updatedAt DateTime64(3, 'UTC'),
        totalOrders UInt64,
        totalSpent Float64,
        totalDiscount Float64,
        promoUses UInt64
      )
      ENGINE = ReplacingMergeTree(updatedAt)
      ORDER BY (id)
    `;
  }

  private createPromocodesTableSql(): string {
    return `
      CREATE TABLE IF NOT EXISTS ${this.fqtn('promocodes')} (
        id String,
        code String,
        discountPercent UInt8,
        totalUsageLimit Nullable(UInt32),
        perUserLimit Nullable(UInt32),
        usageCount UInt64,
        revenue Float64,
        uniqueUsers UInt64,
        dateFrom Nullable(DateTime64(3, 'UTC')),
        dateTo Nullable(DateTime64(3, 'UTC')),
        isActive UInt8,
        createdAt DateTime64(3, 'UTC'),
        updatedAt DateTime64(3, 'UTC')
      )
      ENGINE = ReplacingMergeTree(updatedAt)
      ORDER BY (id)
    `;
  }

  private createOrdersTableSql(): string {
    return `
      CREATE TABLE IF NOT EXISTS ${this.fqtn('orders')} (
        id String,
        userId String,
        userEmail String,
        userName String,
        promocodeId Nullable(String),
        promocodeCode Nullable(String),
        amount Float64,
        discountAmount Float64,
        finalAmount Float64,
        createdAt DateTime64(3, 'UTC'),
        updatedAt DateTime64(3, 'UTC')
      )
      ENGINE = ReplacingMergeTree(updatedAt)
      ORDER BY (id)
    `;
  }

  private createPromoUsagesTableSql(): string {
    return `
      CREATE TABLE IF NOT EXISTS ${this.fqtn('promo_usages')} (
        id String,
        orderId String,
        userId String,
        userEmail String,
        userName String,
        promocodeId String,
        promocodeCode String,
        discountAmount Float64,
        orderAmount Float64,
        createdAt DateTime64(3, 'UTC'),
        updatedAt DateTime64(3, 'UTC')
      )
      ENGINE = ReplacingMergeTree(updatedAt)
      ORDER BY (id)
    `;
  }
}
