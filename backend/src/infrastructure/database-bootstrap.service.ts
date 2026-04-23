import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { ClickHouseService } from './clickhouse.service';
import { DEMO_USER_EMAIL, DEMO_USER_PASSWORD, createDemoSeed } from './demo-data';
import { formatClickHouseDateTime64 } from '../common/clickhouse-date';
import { User } from '../modules/users/user.schema';
import { Promocode } from '../modules/promocodes/promocode.schema';
import { Order } from '../modules/orders/order.schema';
import { PromoUsage } from '../modules/orders/promo-usage.schema';

@Injectable()
export class DatabaseBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseBootstrapService.name);

  constructor(
    private readonly clickHouseService: ClickHouseService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Promocode.name) private readonly promocodeModel: Model<Promocode>,
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(PromoUsage.name) private readonly promoUsageModel: Model<PromoUsage>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.clickHouseService.bootstrap();
    await this.seedDemoData();
    this.logger.log('Database bootstrap complete');
  }

  private async seedDemoData(): Promise<void> {
    const existingDemo = await this.userModel.exists({ email: DEMO_USER_EMAIL });
    if (existingDemo) {
      return;
    }

    const seed = createDemoSeed();
    const passwordHashMap = new Map<string, string>();

    const hashFor = async (password: string): Promise<string> => {
      const cached = passwordHashMap.get(password);
      if (cached) {
        return cached;
      }

      const hashed = await bcrypt.hash(password, 10);
      passwordHashMap.set(password, hashed);
      return hashed;
    };

    const users = await Promise.all(
      seed.users.map(async (user) => this.userModel.create({ ...user, passwordHash: await hashFor(DEMO_USER_PASSWORD) })),
    );

    const usersByEmail = new Map(users.map((user) => [user.email, user] as const));
    const promocodes = await Promise.all(seed.promocodes.map(async (promocode) => this.promocodeModel.create(promocode)));
    const promocodesByCode = new Map(promocodes.map((promocode) => [promocode.code, promocode] as const));
    const promoOrders = seed.orders.filter((order) => order.promocodeCode);
    const userSeedsByEmail = new Map(seed.users.map((user) => [user.email, user] as const));

    const orderDocs = await Promise.all(
      seed.orders.map(async (order) => {
        const user = usersByEmail.get(order.userEmail);
        if (!user) {
          throw new Error(`Seed user not found: ${order.userEmail}`);
        }

        const promocode = order.promocodeCode ? promocodesByCode.get(order.promocodeCode) ?? null : null;
        return this.orderModel.create({
          userId: user._id,
          amount: order.amount,
          promocodeId: promocode?._id ?? null,
          promocodeCode: order.promocodeCode,
          discountAmount: order.discountAmount,
          finalAmount: order.finalAmount,
        });
      }),
    );

    const orderByPromoCodeAndUser = new Map(
      orderDocs
        .filter((order) => order.promocodeCode)
        .map((order) => [`${order.userId.toString()}:${order.promocodeCode}`, order] as const),
    );

    const usageRows = await Promise.all(
      promoOrders.map(async (order) => {
        const user = usersByEmail.get(order.userEmail);
        const orderDoc = orderByPromoCodeAndUser.get(`${user?._id.toString()}:${order.promocodeCode}`);
        const promocode = order.promocodeCode ? promocodesByCode.get(order.promocodeCode) : null;
        if (!user || !orderDoc || !promocode) {
          throw new Error(`Seed reference missing for order ${order.userEmail} / ${order.promocodeCode}`);
        }

        return this.promoUsageModel.create({
          orderId: orderDoc._id,
          userId: user._id,
          promocodeId: promocode._id,
          discountAmount: order.discountAmount,
          orderAmount: order.amount,
        });
      }),
    );

    await this.clickHouseService.insertRows('users', users.map((user, index) => {
      const userSeed = seed.users[index];
      return {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        phone: user.phone,
        isActive: user.isActive ? 1 : 0,
        createdAt: formatClickHouseDateTime64(userSeed.createdAt),
        updatedAt: formatClickHouseDateTime64(userSeed.updatedAt),
        totalOrders: seed.orders.filter((order) => order.userEmail === user.email).length,
        totalSpent: seed.orders.filter((order) => order.userEmail === user.email).reduce((sum, order) => sum + order.amount, 0),
        totalDiscount: seed.orders.filter((order) => order.userEmail === user.email).reduce((sum, order) => sum + order.discountAmount, 0),
        promoUses: seed.orders.filter((order) => order.userEmail === user.email && Boolean(order.promocodeCode)).length,
      };
    }));

    await this.clickHouseService.insertRows('promocodes', promocodes.map((promocode, index) => {
      const promocodeSeed = seed.promocodes[index];
      return {
        id: promocode._id.toString(),
        code: promocode.code,
        discountPercent: promocode.discountPercent,
        totalUsageLimit: promocode.totalUsageLimit,
        perUserLimit: promocode.perUserLimit,
        usageCount: promocode.usageCount,
        revenue: seed.orders.filter((order) => order.promocodeCode === promocode.code).reduce((sum, order) => sum + order.amount, 0),
        uniqueUsers: new Set(seed.orders.filter((order) => order.promocodeCode === promocode.code).map((order) => order.userEmail)).size,
        dateFrom: promocodeSeed.dateFrom ? formatClickHouseDateTime64(promocodeSeed.dateFrom) : null,
        dateTo: promocodeSeed.dateTo ? formatClickHouseDateTime64(promocodeSeed.dateTo) : null,
        isActive: promocode.isActive ? 1 : 0,
        createdAt: formatClickHouseDateTime64(promocodeSeed.createdAt),
        updatedAt: formatClickHouseDateTime64(promocodeSeed.updatedAt),
      };
    }));

    await this.clickHouseService.insertRows('orders', orderDocs.map((order, index) => {
      const orderSeed = seed.orders[index];
      return {
        id: order._id.toString(),
        userId: order.userId.toString(),
        userEmail: users.find((user) => user._id.equals(order.userId))?.email ?? '',
        userName: users.find((user) => user._id.equals(order.userId))?.name ?? '',
        promocodeId: order.promocodeId ? order.promocodeId.toString() : null,
        promocodeCode: order.promocodeCode,
        amount: order.amount,
        discountAmount: order.discountAmount,
        finalAmount: order.finalAmount,
        createdAt: formatClickHouseDateTime64(orderSeed.createdAt),
        updatedAt: formatClickHouseDateTime64(orderSeed.updatedAt),
      };
    }));

    await this.clickHouseService.insertRows('promo_usages', usageRows.map((usage, index) => {
      const usageSeed = promoOrders[index];
      return {
        id: usage._id.toString(),
        orderId: usage.orderId.toString(),
        userId: usage.userId.toString(),
        userEmail: users.find((user) => user._id.equals(usage.userId))?.email ?? '',
        userName: users.find((user) => user._id.equals(usage.userId))?.name ?? '',
        promocodeId: usage.promocodeId.toString(),
        promocodeCode: promocodes.find((promocode) => promocode._id.equals(usage.promocodeId))?.code ?? '',
        discountAmount: usage.discountAmount,
        orderAmount: usage.orderAmount,
        createdAt: formatClickHouseDateTime64(usageSeed.createdAt),
        updatedAt: formatClickHouseDateTime64(usageSeed.updatedAt),
      };
    }));

    this.logger.log(`Seeded demo data for ${DEMO_USER_EMAIL}`);
  }
}
