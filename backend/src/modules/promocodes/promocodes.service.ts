import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Promocode } from './promocode.schema';
import { CreatePromocodeDto } from './dto/create-promocode.dto';
import { UpdatePromocodeDto } from './dto/update-promocode.dto';
import { ClickHouseService } from '../../infrastructure/clickhouse.service';
import { formatClickHouseDateTime64 } from '../../common/clickhouse-date';

@Injectable()
export class PromocodesService {
  constructor(
    @InjectModel(Promocode.name) private readonly promocodeModel: Model<Promocode>,
    private readonly clickHouseService: ClickHouseService,
  ) {}

  async create(dto: CreatePromocodeDto) {
    const code = dto.code.toUpperCase();
    const exists = await this.promocodeModel.exists({ code });
    if (exists) {
      throw new ConflictException('Promocode already exists');
    }

    const promocode = await this.promocodeModel.create({
      code,
      discountPercent: dto.discountPercent,
      totalUsageLimit: dto.totalUsageLimit ?? null,
      perUserLimit: dto.perUserLimit ?? null,
      dateFrom: dto.dateFrom ? new Date(dto.dateFrom) : null,
      dateTo: dto.dateTo ? new Date(dto.dateTo) : null,
      isActive: true,
      usageCount: 0,
    });

    await this.syncPromocode(promocode);
    return promocode.toObject();
  }

  async findAll(limit = 20, skip = 0) {
    const [items, total] = await Promise.all([
      this.promocodeModel.find().skip(skip).limit(limit).sort({ createdAt: -1 }),
      this.promocodeModel.countDocuments(),
    ]);

    return { items: items.map((item) => item.toObject()), total };
  }

  async findById(id: string) {
    const promocode = await this.promocodeModel.findById(id);
    if (!promocode) {
      throw new NotFoundException('Promocode not found');
    }
    return promocode.toObject();
  }

  async findActiveById(id: string) {
    const promocode = await this.promocodeModel.findById(id);
    if (!promocode) {
      throw new NotFoundException('Promocode not found');
    }
    return promocode;
  }

  async findActiveByCode(code: string) {
    const normalizedCode = code.trim().toUpperCase();
    const promocode = await this.promocodeModel.findOne({ code: normalizedCode });
    if (!promocode) {
      throw new NotFoundException('Promocode not found');
    }
    return promocode;
  }

  async update(id: string, dto: UpdatePromocodeDto) {
    const promocode = await this.promocodeModel.findById(id);
    if (!promocode) {
      throw new NotFoundException('Promocode not found');
    }

    if (dto.code) {
      const nextCode = dto.code.toUpperCase();
      const exists = await this.promocodeModel.exists({ code: nextCode, _id: { $ne: id } });
      if (exists) {
        throw new ConflictException('Promocode already exists');
      }
      promocode.code = nextCode;
    }
    if (typeof dto.discountPercent === 'number') promocode.discountPercent = dto.discountPercent;
    if ('totalUsageLimit' in dto) promocode.totalUsageLimit = dto.totalUsageLimit ?? null;
    if ('perUserLimit' in dto) promocode.perUserLimit = dto.perUserLimit ?? null;
    if (typeof dto.isActive === 'boolean') promocode.isActive = dto.isActive;
    if ('dateFrom' in dto) promocode.dateFrom = dto.dateFrom ? new Date(dto.dateFrom) : null;
    if ('dateTo' in dto) promocode.dateTo = dto.dateTo ? new Date(dto.dateTo) : null;

    await promocode.save();
    await this.syncPromocode(promocode);
    return promocode.toObject();
  }

  async deactivate(id: string) {
    const promocode = await this.promocodeModel.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!promocode) {
      throw new NotFoundException('Promocode not found');
    }

    await this.syncPromocode(promocode);
    return promocode.toObject();
  }

  async incrementUsageCount(id: string): Promise<void> {
    await this.promocodeModel.findByIdAndUpdate(id, { $inc: { usageCount: 1 } });
  }

  async countUserUsages(promocodeId: string, userId: string): Promise<number> {
    return this.promocodeModel.db.collection('promo_usages').countDocuments({
      promocodeId,
      userId,
    });
  }

  private async syncPromocode(promocode: PromocodeSyncPayload): Promise<void> {
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
