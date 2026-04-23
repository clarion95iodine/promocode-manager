import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Promocode, PromocodeSchema } from './promocode.schema';
import { PromocodesService } from './promocodes.service';
import { PromocodesController } from './promocodes.controller';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: Promocode.name, schema: PromocodeSchema }]), InfrastructureModule],
  controllers: [PromocodesController],
  providers: [PromocodesService],
  exports: [PromocodesService],
})
export class PromocodesModule {}
