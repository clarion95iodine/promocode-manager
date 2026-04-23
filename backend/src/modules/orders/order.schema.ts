import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OrderDocument = HydratedDocument<Order>;

@Schema({ timestamps: true, versionKey: false })
export class Order {
  @Prop({ type: Types.ObjectId, required: true, ref: 'User', index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ default: null, type: Types.ObjectId, ref: 'Promocode' })
  promocodeId!: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  promocodeCode!: string | null;

  @Prop({ default: 0, min: 0 })
  discountAmount!: number;

  @Prop({ default: 0, min: 0 })
  finalAmount!: number;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
