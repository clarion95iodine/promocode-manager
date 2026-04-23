import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './order.schema';
import { PromoUsage, PromoUsageSchema } from './promo-usage.schema';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { PromocodesModule } from '../promocodes/promocodes.module';
import { User, UserSchema } from '../users/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: PromoUsage.name, schema: PromoUsageSchema },
      { name: User.name, schema: UserSchema },
    ]),
    InfrastructureModule,
    PromocodesModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
