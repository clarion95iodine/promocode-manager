import { Types } from 'mongoose';

export const DEMO_USER_EMAIL = 'demo@promocode.local';
export const DEMO_USER_PASSWORD = 'password123';

export type DemoSeed = {
  user: {
    email: string;
    name: string;
    phone: string;
    passwordHash: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  users: Array<{
    email: string;
    name: string;
    phone: string;
    passwordHash: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
  promocodes: Array<{
    code: string;
    discountPercent: number;
    totalUsageLimit: number | null;
    perUserLimit: number | null;
    usageCount: number;
    isActive: boolean;
    dateFrom: Date | null;
    dateTo: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  orders: Array<{
    userEmail: string;
    amount: number;
    promocodeCode: string | null;
    discountAmount: number;
    finalAmount: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

export function createDemoSeed(): DemoSeed {
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const inThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return {
    user: {
      email: DEMO_USER_EMAIL,
      name: 'Demo User',
      phone: '+10000000000',
      passwordHash: 'demo-password-hash-placeholder',
      isActive: true,
      createdAt: threeDaysAgo,
      updatedAt: threeDaysAgo,
    },
    users: [
      {
        email: DEMO_USER_EMAIL,
        name: 'Demo User',
        phone: '+10000000000',
        passwordHash: 'demo-password-hash-placeholder',
        isActive: true,
        createdAt: threeDaysAgo,
        updatedAt: threeDaysAgo,
      },
      {
        email: 'alice@promocode.local',
        name: 'Alice Johnson',
        phone: '+10000000001',
        passwordHash: 'alice-password-hash-placeholder',
        isActive: true,
        createdAt: twoDaysAgo,
        updatedAt: twoDaysAgo,
      },
      {
        email: 'bob@promocode.local',
        name: 'Bob Smith',
        phone: '+10000000002',
        passwordHash: 'bob-password-hash-placeholder',
        isActive: true,
        createdAt: oneDayAgo,
        updatedAt: oneDayAgo,
      },
    ],
    promocodes: [
      {
        code: 'WELCOME10',
        discountPercent: 10,
        totalUsageLimit: 100,
        perUserLimit: 1,
        usageCount: 1,
        isActive: true,
        dateFrom: threeDaysAgo,
        dateTo: inThirtyDays,
        createdAt: twoDaysAgo,
        updatedAt: twoDaysAgo,
      },
      {
        code: 'SUMMER20',
        discountPercent: 20,
        totalUsageLimit: 50,
        perUserLimit: 2,
        usageCount: 1,
        isActive: true,
        dateFrom: threeDaysAgo,
        dateTo: inThirtyDays,
        createdAt: twoDaysAgo,
        updatedAt: twoDaysAgo,
      },
      {
        code: 'OLD5',
        discountPercent: 5,
        totalUsageLimit: 10,
        perUserLimit: 1,
        usageCount: 0,
        isActive: false,
        dateFrom: threeDaysAgo,
        dateTo: yesterday,
        createdAt: oneDayAgo,
        updatedAt: oneDayAgo,
      },
    ],
    orders: [
      {
        userEmail: DEMO_USER_EMAIL,
        amount: 120,
        promocodeCode: null,
        discountAmount: 0,
        finalAmount: 120,
        createdAt: oneDayAgo,
        updatedAt: oneDayAgo,
      },
      {
        userEmail: DEMO_USER_EMAIL,
        amount: 200,
        promocodeCode: 'WELCOME10',
        discountAmount: 20,
        finalAmount: 180,
        createdAt: oneDayAgo,
        updatedAt: oneDayAgo,
      },
      {
        userEmail: 'alice@promocode.local',
        amount: 350,
        promocodeCode: 'SUMMER20',
        discountAmount: 70,
        finalAmount: 280,
        createdAt: twoDaysAgo,
        updatedAt: twoDaysAgo,
      },
      {
        userEmail: 'bob@promocode.local',
        amount: 80,
        promocodeCode: null,
        discountAmount: 0,
        finalAmount: 80,
        createdAt: twoDaysAgo,
        updatedAt: twoDaysAgo,
      },
    ],
  };
}
