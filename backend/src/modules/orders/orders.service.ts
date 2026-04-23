import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order } from './order.schema';
import { PromoUsage } from './promo-usage.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { ClickHouseService } from '../../infrastructure/clickhouse.service';
import { RedisService } from '../../infrastructure/redis.service';
import { PromocodesService } from '../promocodes/promocodes.service';
import { User } from '../users/user.schema';
import { formatClickHouseDateTime64 } from '../../common/clickhouse-date';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(PromoUsage.name) private readonly promoUsageModel: Model<PromoUsage>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly promocodesService: PromocodesService,
    private readonly clickHouseService: ClickHouseService,
    private readonly redisService: RedisService,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    const user = await this.userModel.findById(userId);
    if (!user || !user.isActive) {
      throw new NotFoundException('User not found');
    }

    const order = await this.orderModel.create({
      userId: new Types.ObjectId(userId),
      amount: dto.amount,
      promocodeId: null,
      promocodeCode: null,
      discountAmount: 0,
      finalAmount: dto.amount,
    });

    await this.syncOrder(order as OrderSyncPayload, user as UserLean);
    return order.toObject();
  }

  async findMyOrders(userId: string, limit = 20, skip = 0) {
    const userObjectId = new Types.ObjectId(userId);
    const [items, total] = await Promise.all([
      this.orderModel.find({ userId: userObjectId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.orderModel.countDocuments({ userId: userObjectId }),
    ]);

    return { items: items.map((item) => item.toObject()), total };
  }

  async applyPromocode(userId: string, orderId: string, promocodeCode: string) {
    const normalizedPromocodeCode = promocodeCode.trim().toUpperCase();
    if (!normalizedPromocodeCode) {
      throw new BadRequestException('Promocode code is required');
    }

    const lockKey = `lock:apply-promocode:${normalizedPromocodeCode}`;
    const token = await this.redisService.acquireLock(lockKey, 10_000);
    if (!token) {
      throw new BadRequestException('Promocode is currently being used. Please retry.');
    }

    try {
      const order = await this.orderModel.findById(orderId);
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      if (order.userId.toString() !== userId) {
        throw new ForbiddenException('Order does not belong to current user');
      }
      if (order.promocodeId) {
        throw new BadRequestException('Promocode already applied to this order');
      }

      const promocode = await this.promocodesService.findActiveByCode(normalizedPromocodeCode);
      if (!promocode.isActive) {
        throw new BadRequestException('Promocode is inactive');
      }

      const now = new Date();
      if (promocode.dateFrom && promocode.dateFrom > now) {
        throw new BadRequestException('Promocode is not active yet');
      }
      if (promocode.dateTo && promocode.dateTo < now) {
        throw new BadRequestException('Promocode has expired');
      }
      if (promocode.totalUsageLimit !== null && promocode.usageCount >= promocode.totalUsageLimit) {
        throw new BadRequestException('Promocode usage limit exceeded');
      }

      const userUsageCount = await this.promoUsageModel.countDocuments({
        userId: new Types.ObjectId(userId),
        promocodeId: new Types.ObjectId(promocode._id),
      });
      if (promocode.perUserLimit !== null && userUsageCount >= promocode.perUserLimit) {
        throw new BadRequestException('Promocode per-user limit exceeded');
      }

      const discountAmount = Number(((order.amount * promocode.discountPercent) / 100).toFixed(2));
      const finalAmount = Number((order.amount - discountAmount).toFixed(2));

      order.promocodeId = new Types.ObjectId(promocode._id);
      order.promocodeCode = promocode.code;
      order.discountAmount = discountAmount;
      order.finalAmount = finalAmount;
      await order.save();

      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const usage = await this.promoUsageModel.create({
        orderId: order._id,
        userId: user._id,
        promocodeId: promocode._id,
        discountAmount,
        orderAmount: order.amount,
      });

      await this.promocodesService.incrementUsageCount(promocode._id.toString());
      await this.syncOrder(order as OrderSyncPayload, user as UserLean);
      await this.syncPromoUsage(usage as PromoUsageSyncPayload, user as UserLean, promocode.code, order.amount);
      await this.syncPromocodeSnapshot(promocode as PromocodeSyncPayload);

      return { order: order.toObject(), usage: usage.toObject(), discountAmount, finalAmount };
    } finally {
      await this.redisService.releaseLock(lockKey, token);
    }
  }

  private async syncOrder(order: OrderSyncPayload, user: UserLean): Promise<void> {
    await this.clickHouseService.insertRows('orders', [
      {
        id: order._id.toString(),
        userId: user._id.toString(),
        userEmail: user.email,
        userName: user.name,
        promocodeId: order.promocodeId ? order.promocodeId.toString() : null,
        promocodeCode: order.promocodeCode,
        amount: order.amount,
        discountAmount: order.discountAmount,
        finalAmount: order.finalAmount,
        createdAt: formatClickHouseDateTime64(order.createdAt ?? new Date()),
        updatedAt: formatClickHouseDateTime64(order.updatedAt ?? new Date()),
      },
    ]);
  }

  private async syncPromoUsage(usage: PromoUsageSyncPayload, user: UserLean, promocodeCode: string, orderAmount: number): Promise<void> {
    await this.clickHouseService.insertRows('promo_usages', [
      {
        id: usage._id.toString(),
        orderId: usage.orderId.toString(),
        userId: usage.userId.toString(),
        userEmail: user.email,
        userName: user.name,
        promocodeId: usage.promocodeId.toString(),
        promocodeCode,
        discountAmount: usage.discountAmount,
        orderAmount,
        createdAt: formatClickHouseDateTime64(usage.createdAt ?? new Date()),
        updatedAt: formatClickHouseDateTime64(usage.updatedAt ?? new Date()),
      },
    ]);
  }

  private async syncPromocodeSnapshot(promocode: PromocodeSyncPayload): Promise<void> {
    await this.clickHouseService.insertRows('promocodes', [
      {
        id: promocode._id.toString(),
        code: promocode.code,
        discountPercent: promocode.discountPercent,
        totalUsageLimit: promocode.totalUsageLimit,
        perUserLimit: promocode.perUserLimit,
        usageCount: promocode.usageCount,
        revenue: 0,
        uniqueUsers: 0,
        dateFrom: promocode.dateFrom ? formatClickHouseDateTime64(promocode.dateFrom) : null,
        dateTo: promocode.dateTo ? formatClickHouseDateTime64(promocode.dateTo) : null,
        isActive: promocode.isActive ? 1 : 0,
        createdAt: formatClickHouseDateTime64(promocode.createdAt ?? new Date()),
        updatedAt: formatClickHouseDateTime64(promocode.updatedAt ?? new Date()),
      },
    ]);
  }
}

type UserLean = {
  _id: Types.ObjectId;
  email: string;
  name: string;
};

type OrderSyncPayload = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  amount: number;
  promocodeId: Types.ObjectId | null;
  promocodeCode: string | null;
  discountAmount: number;
  finalAmount: number;
  createdAt?: Date;
  updatedAt?: Date;
};

type PromoUsageSyncPayload = {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  userId: Types.ObjectId;
  promocodeId: Types.ObjectId;
  discountAmount: number;
  orderAmount: number;
  createdAt?: Date;
  updatedAt?: Date;
};

type PromocodeSyncPayload = {
  _id: Types.ObjectId;
  code: string;
  discountPercent: number;
  totalUsageLimit: number | null;
  perUserLimit: number | null;
  usageCount: number;
  isActive: boolean;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};
