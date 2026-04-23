import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PromoUsageDocument = HydratedDocument<PromoUsage>;

@Schema({ timestamps: true, versionKey: false })
export class PromoUsage {
  @Prop({ type: Types.ObjectId, required: true, ref: 'Order', index: true })
  orderId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, ref: 'User', index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, ref: 'Promocode', index: true })
  promocodeId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  discountAmount!: number;

  @Prop({ required: true, min: 0 })
  orderAmount!: number;
}

export const PromoUsageSchema = SchemaFactory.createForClass(PromoUsage);
