import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type Model, Types } from 'mongoose';
import { AuthService } from './auth.service';
import { User } from '../users/user.schema';
import { RedisService } from '../../infrastructure/redis.service';
import type { LoginDto } from './dto/login.dto';

type UserDoc = {
  id: string;
  email: string;
  passwordHash: string;
  refreshTokenHash?: string | null;
  isActive: boolean;
  toObject: () => Record<string, unknown>;
};

describe('AuthService.login', () => {
  const userId = new Types.ObjectId().toString();

  const exists = jest.fn();
  const create = jest.fn();
  const findOne = jest.fn();
  const findById = jest.fn();
  const findByIdAndUpdate = jest.fn();
  const userModel = {
    exists,
    create,
    findOne,
    findById,
    findByIdAndUpdate,
  } as unknown as Model<User>;

  const signAsync = jest.fn();
  const verifyAsync = jest.fn();
  const jwtService = {
    signAsync,
    verifyAsync,
  } as unknown as JwtService;

  const rateLimit = jest.fn(async (_key: string, _limit: number, _ttlSeconds: number): Promise<boolean> => false);
  const redisService = {
    rateLimit,
  } as unknown as RedisService;

  const service = new AuthService(userModel, jwtService, redisService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 429 when login attempts exceed the Redis rate limit', async () => {
    const dto: LoginDto = { email: 'john@example.com', password: 'password123' };

    await expect(service.login(dto, 'rate:login:127.0.0.1:john@example.com')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Too many login attempts. Try again later.',
    });

    expect(findOne).not.toHaveBeenCalled();
    expect(signAsync).not.toHaveBeenCalled();
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
