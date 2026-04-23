import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User } from './user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ClickHouseService } from '../../infrastructure/clickhouse.service';
import { formatClickHouseDateTime64 } from '../../common/clickhouse-date';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly clickHouseService: ClickHouseService,
  ) {}

  async create(dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    const exists = await this.userModel.exists({ email });
    if (exists) {
      throw new ConflictException('User already exists');
    }

    const user = await this.userModel.create({
      email,
      name: dto.name,
      phone: dto.phone,
      passwordHash: await bcrypt.hash(dto.password, 10),
      isActive: true,
    });

    await this.syncUser(user);
    return this.safeUser(user);
  }

  async findAll(limit = 20, skip = 0) {
    const [items, total] = await Promise.all([
      this.userModel.find().skip(skip).limit(limit).sort({ createdAt: -1 }),
      this.userModel.countDocuments(),
    ]);

    return { items: items.map((item) => this.safeUser(item)), total };
  }

  async findById(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.safeUser(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.userModel.findById(id).select('+passwordHash');
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const exists = await this.userModel.exists({ email: dto.email.toLowerCase() });
      if (exists) {
        throw new ConflictException('User already exists');
      }
    }

    if (dto.email) user.email = dto.email.toLowerCase();
    if (dto.name) user.name = dto.name;
    if (dto.phone) user.phone = dto.phone;
    if (typeof dto.isActive === 'boolean') user.isActive = dto.isActive;
    if (dto.password) user.passwordHash = await bcrypt.hash(dto.password, 10);

    await user.save();
    await this.syncUser(user);
    return this.safeUser(user);
  }

  async deactivate(id: string) {
    const user = await this.userModel.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.syncUser(user);
    return this.safeUser(user);
  }

  async findForAuthByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase() }).select('+passwordHash +refreshTokenHash').exec();
  }

  private async syncUser(user: UserSyncPayload): Promise<void> {
    await this.clickHouseService.insertRows('users', [
      {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        phone: user.phone,
        isActive: user.isActive ? 1 : 0,
        createdAt: formatClickHouseDateTime64(user.createdAt ?? new Date()),
        updatedAt: formatClickHouseDateTime64(user.updatedAt ?? new Date()),
        totalOrders: 0,
        totalSpent: 0,
        totalDiscount: 0,
        promoUses: 0,
      },
    ]);
  }

  private safeUser(user: { toObject(): Record<string, unknown> }) {
    const object = user.toObject() as Record<string, unknown>;
    delete object.passwordHash;
    delete object.refreshTokenHash;
    return object;
  }
}

type UserSyncPayload = {
  _id: Types.ObjectId;
  email: string;
  name: string;
  phone: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};
