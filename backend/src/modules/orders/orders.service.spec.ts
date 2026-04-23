import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { Types, type Model } from 'mongoose';
import { OrdersService } from './orders.service';
import { Order } from './order.schema';
import { PromoUsage } from './promo-usage.schema';
import { User } from '../users/user.schema';
import { PromocodesService } from '../promocodes/promocodes.service';
import { ClickHouseService } from '../../infrastructure/clickhouse.service';
import { RedisService } from '../../infrastructure/redis.service';

type OrderDoc = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  amount: number;
  promocodeId: Types.ObjectId | null;
  promocodeCode: string | null;
  discountAmount: number;
  finalAmount: number;
  createdAt?: Date;
  updatedAt?: Date;
  save: () => Promise<void>;
  toObject: () => {
    _id: string;
    userId: string;
    amount: number;
    promocodeId: string | null;
    promocodeCode: string | null;
    discountAmount: number;
    finalAmount: number;
  };
};

type UserDoc = {
  _id: Types.ObjectId;
  email: string;
  name: string;
};

type PromocodeDoc = {
  _id: Types.ObjectId;
  code: string;
  discountPercent: number;
  totalUsageLimit: number | null;
  perUserLimit: number | null;
  usageCount: number;
  isActive: boolean;
  dateFrom: Date | null;
  dateTo: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

type PromoUsageDoc = {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  userId: Types.ObjectId;
  promocodeId: Types.ObjectId;
  discountAmount: number;
  orderAmount: number;
  createdAt?: Date;
  updatedAt?: Date;
  toObject: () => {
    _id: string;
    orderId: string;
    userId: string;
    promocodeCode: string;
    discountAmount: number;
    orderAmount: number;
  };
};

describe('OrdersService.applyPromocode', () => {
  const userId = new Types.ObjectId();
  const orderId = new Types.ObjectId();
  const promocodeId = new Types.ObjectId();
  const usageId = new Types.ObjectId();

  const findById = jest.fn(async (_id: string): Promise<OrderDoc | null> => null);
  const countDocuments = jest.fn(async (_filter?: Record<string, unknown>): Promise<number> => 0);
  const find = jest.fn();
  const createOrder = jest.fn();
  const orderModel = {
    findById,
    countDocuments,
    find,
    create: createOrder,
  } as unknown as Model<Order>;

  const countPromoUsageDocuments = jest.fn(async (_filter?: Record<string, unknown>): Promise<number> => 0);
  const createPromoUsage = jest.fn(async (_doc: Record<string, unknown>): Promise<PromoUsageDoc> => {
    throw new Error('not initialized');
  });
  const promoUsageModel = {
    countDocuments: countPromoUsageDocuments,
    create: createPromoUsage,
  } as unknown as Model<PromoUsage>;

  const findUserById = jest.fn(async (_id: string): Promise<UserDoc | null> => null);
  const userModel = { findById: findUserById } as unknown as Model<User>;

  const findActiveByCode = jest.fn(async (_code: string): Promise<PromocodeDoc> => {
    throw new Error('not initialized');
  });
  const incrementUsageCount = jest.fn(async (_id: string): Promise<void> => undefined);
  const promocodesService = {
    findActiveByCode,
    incrementUsageCount,
  } as unknown as PromocodesService;

  const insertRows = jest.fn(async (_table: string, _rows: Record<string, unknown>[]): Promise<void> => undefined);
  const clickHouseService = {
    insertRows,
  } as unknown as ClickHouseService;

  const acquireLock = jest.fn(async (_key: string, _ttlMs: number): Promise<string | null> => null);
  const releaseLock = jest.fn(async (_key: string, _token: string): Promise<boolean> => true);
  const redisService = {
    acquireLock,
    releaseLock,
  } as unknown as RedisService;

  const service = new OrdersService(
    orderModel,
    promoUsageModel,
    userModel,
    promocodesService,
    clickHouseService,
    redisService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies a valid promocode, persists the usage, and syncs analytics rows', async () => {
    const order: OrderDoc = {
      _id: orderId,
      userId,
      amount: 100,
      promocodeId: null,
      promocodeCode: null,
      discountAmount: 0,
      finalAmount: 100,
      createdAt: new Date('2026-04-22T00:00:00.000Z'),
      updatedAt: new Date('2026-04-22T00:00:00.000Z'),
      save: jest.fn(async (): Promise<void> => undefined),
      toObject: () => ({
        _id: orderId.toString(),
        userId: userId.toString(),
        amount: order.amount,
        promocodeId: order.promocodeId ? order.promocodeId.toString() : null,
        promocodeCode: order.promocodeCode,
        discountAmount: order.discountAmount,
        finalAmount: order.finalAmount,
      }),
    };

    const user: UserDoc = {
      _id: userId,
      email: 'john@example.com',
      name: 'John Doe',
    };

    const promocode: PromocodeDoc = {
      _id: promocodeId,
      code: 'SAVE10',
      discountPercent: 10,
      totalUsageLimit: 100,
      perUserLimit: 5,
      usageCount: 1,
      isActive: true,
      dateFrom: null,
      dateTo: null,
      createdAt: new Date('2026-04-21T00:00:00.000Z'),
      updatedAt: new Date('2026-04-22T00:00:00.000Z'),
    };

    const usage: PromoUsageDoc = {
      _id: usageId,
      orderId,
      userId,
      promocodeId,
      discountAmount: 10,
      orderAmount: 100,
      createdAt: new Date('2026-04-22T00:00:01.000Z'),
      updatedAt: new Date('2026-04-22T00:00:01.000Z'),
      toObject: () => ({
        _id: usageId.toString(),
        orderId: orderId.toString(),
        userId: userId.toString(),
        promocodeCode: 'SAVE10',
        discountAmount: 10,
        orderAmount: 100,
      }),
    };

    (createPromoUsage as jest.MockedFunction<typeof createPromoUsage>).mockImplementation(async () => usage);
    (findById as jest.MockedFunction<typeof findById>).mockResolvedValue(order);
    (findUserById as jest.MockedFunction<typeof findUserById>).mockResolvedValue(user);
    (findActiveByCode as jest.MockedFunction<typeof findActiveByCode>).mockResolvedValue(promocode);
    (countPromoUsageDocuments as jest.MockedFunction<typeof countPromoUsageDocuments>).mockResolvedValue(0);
    (acquireLock as jest.MockedFunction<typeof acquireLock>).mockResolvedValue('lock-token');

    const result = await service.applyPromocode(userId.toString(), orderId.toString(), ' save10 ');

    expect(acquireLock).toHaveBeenCalledWith('lock:apply-promocode:SAVE10', 10000);
    expect(order.save).toHaveBeenCalledTimes(1);
    expect(order.promocodeId?.toString()).toBe(promocodeId.toString());
    expect(order.promocodeCode).toBe('SAVE10');
    expect(order.discountAmount).toBe(10);
    expect(order.finalAmount).toBe(90);
    expect(createPromoUsage).toHaveBeenCalledWith(expect.objectContaining({
      orderId,
      userId,
      promocodeId,
      discountAmount: 10,
      orderAmount: 100,
    }));
    expect(incrementUsageCount).toHaveBeenCalledWith(promocodeId.toString());
    expect(releaseLock).toHaveBeenCalledWith('lock:apply-promocode:SAVE10', 'lock-token');

    expect(result).toEqual(expect.objectContaining({
      discountAmount: 10,
      finalAmount: 90,
    }));
    expect(result.order).toEqual(expect.objectContaining({
      promocodeCode: 'SAVE10',
      discountAmount: 10,
      finalAmount: 90,
    }));
    expect(result.usage).toEqual(expect.objectContaining({
      discountAmount: 10,
      orderAmount: 100,
    }));

    expect(insertRows).toHaveBeenNthCalledWith(1, 'orders', expect.any(Array));
    expect(insertRows).toHaveBeenNthCalledWith(2, 'promo_usages', expect.any(Array));
    expect(insertRows).toHaveBeenNthCalledWith(3, 'promocodes', expect.any(Array));
  });

  it('rejects an expired promocode and still releases the lock', async () => {
    const order: OrderDoc = {
      _id: orderId,
      userId,
      amount: 100,
      promocodeId: null,
      promocodeCode: null,
      discountAmount: 0,
      finalAmount: 100,
      save: jest.fn(async (): Promise<void> => undefined),
      toObject: () => ({
        _id: orderId.toString(),
        userId: userId.toString(),
        amount: order.amount,
        promocodeId: null,
        promocodeCode: null,
        discountAmount: 0,
        finalAmount: 100,
      }),
    };

    const user: UserDoc = {
      _id: userId,
      email: 'john@example.com',
      name: 'John Doe',
    };

    const expiredPromocode: PromocodeDoc = {
      _id: promocodeId,
      code: 'OLD10',
      discountPercent: 10,
      totalUsageLimit: 100,
      perUserLimit: 5,
      usageCount: 1,
      isActive: true,
      dateFrom: null,
      dateTo: new Date('2026-04-21T00:00:00.000Z'),
      createdAt: new Date('2026-04-20T00:00:00.000Z'),
      updatedAt: new Date('2026-04-21T00:00:00.000Z'),
    };

    (findById as jest.MockedFunction<typeof findById>).mockResolvedValue(order);
    (findUserById as jest.MockedFunction<typeof findUserById>).mockResolvedValue(user);
    (findActiveByCode as jest.MockedFunction<typeof findActiveByCode>).mockResolvedValue(expiredPromocode);
    (acquireLock as jest.MockedFunction<typeof acquireLock>).mockResolvedValue('lock-token');

    await expect(service.applyPromocode(userId.toString(), orderId.toString(), 'old10'))
      .rejects
      .toBeInstanceOf(BadRequestException);

    expect(order.save).not.toHaveBeenCalled();
    expect(createPromoUsage).not.toHaveBeenCalled();
    expect(incrementUsageCount).not.toHaveBeenCalled();
    expect(insertRows).not.toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalledWith('lock:apply-promocode:OLD10', 'lock-token');
  });

  it('rejects duplicate promocode application on the same order', async () => {
    const existingPromocodeId = new Types.ObjectId();
    const order: OrderDoc = {
      _id: orderId,
      userId,
      amount: 100,
      promocodeId: existingPromocodeId,
      promocodeCode: 'USED10',
      discountAmount: 10,
      finalAmount: 90,
      save: jest.fn(async (): Promise<void> => undefined),
      toObject: () => ({
        _id: orderId.toString(),
        userId: userId.toString(),
        amount: order.amount,
        promocodeId: order.promocodeId ? order.promocodeId.toString() : null,
        promocodeCode: order.promocodeCode,
        discountAmount: order.discountAmount,
        finalAmount: order.finalAmount,
      }),
    };

    const user: UserDoc = {
      _id: userId,
      email: 'john@example.com',
      name: 'John Doe',
    };

    (findById as jest.MockedFunction<typeof findById>).mockResolvedValue(order);
    (findUserById as jest.MockedFunction<typeof findUserById>).mockResolvedValue(user);
    (acquireLock as jest.MockedFunction<typeof acquireLock>).mockResolvedValue('lock-token');

    await expect(service.applyPromocode(userId.toString(), orderId.toString(), 'USED10'))
      .rejects
      .toBeInstanceOf(BadRequestException);

    expect(findActiveByCode).not.toHaveBeenCalled();
    expect(order.save).not.toHaveBeenCalled();
    expect(createPromoUsage).not.toHaveBeenCalled();
    expect(incrementUsageCount).not.toHaveBeenCalled();
    expect(insertRows).not.toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalledWith('lock:apply-promocode:USED10', 'lock-token');
  });
});
