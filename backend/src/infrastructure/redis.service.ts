import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async get<T = string>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (value === null) {
      return null;
    }

    return JSON.parse(value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async withCache<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await loader();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async acquireLock(key: string, ttlMs = 5000): Promise<string | null> {
    const token = randomUUID();
    const locked = await this.client.set(key, token, 'PX', ttlMs, 'NX');
    return locked === 'OK' ? token : null;
  }

  async releaseLock(key: string, token: string): Promise<boolean> {
    const current = await this.client.get(key);
    if (current !== token) {
      return false;
    }

    await this.client.del(key);
    return true;
  }

  async rateLimit(key: string, limit: number, ttlSeconds: number): Promise<boolean> {
    const current = await this.client.incr(key);
    if (current === 1) {
      await this.client.expire(key, ttlSeconds);
    }

    return current <= limit;
  }

  async invalidateByPrefix(prefix: string): Promise<number> {
    const keys = await this.client.keys(`${prefix}*`);
    if (keys.length === 0) {
      return 0;
    }

    return this.client.del(keys);
  }
}
