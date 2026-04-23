import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClickHouseService } from './clickhouse.service';
import { RedisService } from './redis.service';
import { DatabaseBootstrapService } from './database-bootstrap.service';
import { User, UserSchema } from '../modules/users/user.schema';
import { Promocode, PromocodeSchema } from '../modules/promocodes/promocode.schema';
import { Order, OrderSchema } from '../modules/orders/order.schema';
import { PromoUsage, PromoUsageSchema } from '../modules/orders/promo-usage.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Promocode.name, schema: PromocodeSchema },
      { name: Order.name, schema: OrderSchema },
      { name: PromoUsage.name, schema: PromoUsageSchema },
    ]),
  ],
  providers: [ClickHouseService, RedisService, DatabaseBootstrapService],
  exports: [ClickHouseService, RedisService],
})
export class InfrastructureModule {}
