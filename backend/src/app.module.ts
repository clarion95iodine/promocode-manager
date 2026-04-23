import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PromocodesModule } from './modules/promocodes/promocodes.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGO_URL ?? 'mongodb://localhost:27017/promocode-manager'),
    InfrastructureModule,
    AuthModule,
    UsersModule,
    PromocodesModule,
    OrdersModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
