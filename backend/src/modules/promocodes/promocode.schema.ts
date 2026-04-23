import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PromocodeDocument = HydratedDocument<Promocode>;

@Schema({ timestamps: true, versionKey: false })
export class Promocode {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code!: string;

  @Prop({ required: true, min: 1, max: 100 })
  discountPercent!: number;

  @Prop({ type: Number, default: null, min: 1 })
  totalUsageLimit!: number | null;

  @Prop({ type: Number, default: null, min: 1 })
  perUserLimit!: number | null;

  @Prop({ default: 0, min: 0 })
  usageCount!: number;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ type: Date, default: null })
  dateFrom!: Date | null;

  @Prop({ type: Date, default: null })
  dateTo!: Date | null;
}

export const PromocodeSchema = SchemaFactory.createForClass(Promocode);
