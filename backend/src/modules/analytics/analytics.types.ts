export interface AnalyticsTableResponse<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export interface UsersAnalyticsRow {
  id: string;
  email: string;
  name: string;
  phone: string;
  isActive: number;
  createdAt: string;
  totalOrders: number;
  totalSpent: number;
  totalDiscount: number;
  promoUses: number;
}

export interface PromocodeAnalyticsRow {
  id: string;
  code: string;
  discountPercent: number;
  totalUsageLimit: number | null;
  perUserLimit: number | null;
  usageCount: number;
  revenue: number;
  uniqueUsers: number;
  dateFrom: string | null;
  dateTo: string | null;
  isActive: number;
  createdAt: string;
}

export interface PromoUsageAnalyticsRow {
  id: string;
  orderId: string;
  userId: string;
  userEmail: string;
  userName: string;
  promocodeId: string;
  promocodeCode: string;
  discountAmount: number;
  orderAmount: number;
  createdAt: string;
}
