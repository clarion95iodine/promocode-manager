import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Container,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { AnalyticsTable, Column } from '../components/AnalyticsTable';
import { useAuth } from '../state/AuthContext';
import { api } from '../api/client';

type UserRow = {
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
};

type PromocodeRow = {
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
};

type PromoUsageRow = {
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
};

type MyOrder = {
  _id?: string;
  id?: string;
  amount: number;
  finalAmount: number;
  discountAmount: number;
  promocodeCode: string | null;
  createdAt: string;
};

const userColumns: Column<UserRow>[] = [
  { key: 'email', label: 'Email', sortable: true },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'phone', label: 'Phone' },
  { key: 'totalOrders', label: 'Orders', sortable: true },
  { key: 'totalSpent', label: 'Spent', sortable: true },
  { key: 'totalDiscount', label: 'Discount', sortable: true },
  { key: 'promoUses', label: 'Promo uses', sortable: true },
];

const promocodeColumns: Column<PromocodeRow>[] = [
  { key: 'code', label: 'Code', sortable: true },
  { key: 'discountPercent', label: 'Discount %', sortable: true },
  { key: 'usageCount', label: 'Uses', sortable: true },
  { key: 'revenue', label: 'Revenue', sortable: true },
  { key: 'uniqueUsers', label: 'Unique users', sortable: true },
  { key: 'isActive', label: 'Active' },
];

const usageColumns: Column<PromoUsageRow>[] = [
  { key: 'userEmail', label: 'User email', sortable: true },
  { key: 'userName', label: 'User name' },
  { key: 'promocodeCode', label: 'Promo code', sortable: true },
  { key: 'discountAmount', label: 'Discount', sortable: true },
  { key: 'orderAmount', label: 'Order amount', sortable: true },
  { key: 'createdAt', label: 'Created at', sortable: true },
];

export function DashboardPage() {
  const [tab, setTab] = useState(0);
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const [promoCode, setPromoCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState('10');
  const [totalUsageLimit, setTotalUsageLimit] = useState('');
  const [perUserLimit, setPerUserLimit] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [orderAmount, setOrderAmount] = useState('100');
  const [applyOrderId, setApplyOrderId] = useState('');
  const [applyPromocodeCode, setApplyPromocodeCode] = useState('');

  const promocodeValidation = useMemo(() => {
    const codeError = promoCode.trim() === '' ? 'Code is required' : promoCode.trim().length < 3 ? 'Code must be at least 3 characters' : null;
    const discountValue = Number(discountPercent);
    const discountError = discountPercent === '' ? 'Discount is required' : Number.isNaN(discountValue) ? 'Discount must be a number' : discountValue < 1 || discountValue > 100 ? 'Discount must be between 1 and 100' : null;
    const totalUsageValue = totalUsageLimit === '' ? null : Number(totalUsageLimit);
    const totalUsageError = totalUsageLimit !== '' && (!Number.isInteger(totalUsageValue) || (totalUsageValue ?? 0) <= 0) ? 'Total usage limit must be a positive integer' : null;
    const perUserValue = perUserLimit === '' ? null : Number(perUserLimit);
    const perUserError = perUserLimit !== '' && (!Number.isInteger(perUserValue) || (perUserValue ?? 0) <= 0) ? 'Per-user limit must be a positive integer' : null;
    const dateOrderError = dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo) ? 'Date from must be before date to' : null;
    return { codeError, discountError, totalUsageError, perUserError, dateOrderError, isValid: !codeError && !discountError && !totalUsageError && !perUserError && !dateOrderError };
  }, [dateFrom, dateTo, discountPercent, perUserLimit, promoCode, totalUsageLimit]);

  const orderValidation = useMemo(() => {
    const amountValue = Number(orderAmount);
    const amountError = orderAmount === '' ? 'Amount is required' : Number.isNaN(amountValue) ? 'Amount must be a number' : amountValue <= 0 ? 'Amount must be positive' : null;
    return { amountError, isValid: !amountError };
  }, [orderAmount]);

  const applyValidation = useMemo(() => {
    const mongoIdPattern = /^[a-f\d]{24}$/i;
    const orderIdError = applyOrderId.trim() === '' ? 'Order ID is required' : mongoIdPattern.test(applyOrderId.trim()) ? null : 'Enter a valid order ID';
    const promocodeCodeError = applyPromocodeCode.trim() === '' ? 'Promocode code is required' : applyPromocodeCode.trim().length < 3 ? 'Promocode code must be at least 3 characters' : null;
    return { orderIdError, promocodeCodeError, isValid: !orderIdError && !promocodeCodeError };
  }, [applyOrderId, applyPromocodeCode]);

  const myOrdersQuery = useQuery({
    queryKey: ['my-orders'],
    queryFn: async () => {
      const response = await api.get<{ items: MyOrder[]; total: number }>('/orders/me', { params: { limit: 100, skip: 0 } });
      return response.data;
    },
    enabled: tab === 3,
  });

  const createPromocodeMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/promocodes', {
        code: promoCode,
        discountPercent: Number(discountPercent),
        totalUsageLimit: totalUsageLimit ? Number(totalUsageLimit) : null,
        perUserLimit: perUserLimit ? Number(perUserLimit) : null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      });
      return response.data;
    },
    onSuccess: () => {
      setPromoCode('');
      setTotalUsageLimit('');
      setPerUserLimit('');
      setDateFrom('');
      setDateTo('');
      setMessage('Promocode created');
      queryClient.invalidateQueries({ queryKey: ['/analytics/promocodes'] });
      queryClient.invalidateQueries({ queryKey: ['/analytics/users'] });
    },
    onError: () => setMessage('Failed to create promocode'),
  });

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/orders', { amount: Number(orderAmount) });
      return response.data;
    },
    onSuccess: () => {
      setOrderAmount('100');
      setMessage('Order created');
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['/analytics/users'] });
      queryClient.invalidateQueries({ queryKey: ['/analytics/promo-usages'] });
    },
    onError: () => setMessage('Failed to create order'),
  });

  const applyPromocodeMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/orders/${applyOrderId}/apply-promocode`, { promocodeCode: applyPromocodeCode.trim().toUpperCase() });
      return response.data;
    },
    onSuccess: () => {
      setApplyOrderId('');
      setApplyPromocodeCode('');
      setMessage('Promocode applied');
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['/analytics/users'] });
      queryClient.invalidateQueries({ queryKey: ['/analytics/promocodes'] });
      queryClient.invalidateQueries({ queryKey: ['/analytics/promo-usages'] });
    },
    onError: () => setMessage('Failed to apply promocode'),
  });

  const handlePromocodeSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!promocodeValidation.isValid) {
      setMessage('Please fix the highlighted fields');
      return;
    }
    createPromocodeMutation.mutate();
  };

  const handleOrderSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!orderValidation.isValid) {
      setMessage('Please fix the highlighted fields');
      return;
    }
    createOrderMutation.mutate();
  };

  const handleApplySubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!applyValidation.isValid) {
      setMessage('Please fix the highlighted fields');
      return;
    }
    applyPromocodeMutation.mutate();
  };

  const orderRows = useMemo(() => myOrdersQuery.data?.items ?? [], [myOrdersQuery.data]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">PromoCode Manager</Typography>
        <Button variant="outlined" onClick={logout}>Logout</Button>
      </Box>

      {message ? (
        <Alert severity={message.includes('Failed') || message.includes('Please fix') ? 'error' : 'info'} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message}
        </Alert>
      ) : null}

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 3 }}>
        <Tab label="Users analytics" />
        <Tab label="Promocodes analytics" />
        <Tab label="Promo usages" />
        <Tab label="Manage" />
      </Tabs>

      {tab === 0 ? <AnalyticsTable title="Users" endpoint="/analytics/users" columns={userColumns} /> : null}
      {tab === 1 ? <AnalyticsTable title="Promocodes" endpoint="/analytics/promocodes" columns={promocodeColumns} /> : null}
      {tab === 2 ? <AnalyticsTable title="Promo usages" endpoint="/analytics/promo-usages" columns={usageColumns} /> : null}

      {tab === 3 ? (
        <Stack spacing={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Create promocode</Typography>
            <Box component="form" onSubmit={handlePromocodeSubmit} sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <TextField
                label="Code"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                error={Boolean(promocodeValidation.codeError)}
                helperText={promocodeValidation.codeError ?? ' '}
              />
              <TextField
                label="Discount %"
                type="number"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                error={Boolean(promocodeValidation.discountError)}
                helperText={promocodeValidation.discountError ?? ' '}
              />
              <TextField
                label="Total usage limit"
                type="number"
                value={totalUsageLimit}
                onChange={(e) => setTotalUsageLimit(e.target.value)}
                error={Boolean(promocodeValidation.totalUsageError)}
                helperText={promocodeValidation.totalUsageError ?? ' '}
              />
              <TextField
                label="Per-user limit"
                type="number"
                value={perUserLimit}
                onChange={(e) => setPerUserLimit(e.target.value)}
                error={Boolean(promocodeValidation.perUserError)}
                helperText={promocodeValidation.perUserError ?? ' '}
              />
              <TextField label="Date from" type="date" InputLabelProps={{ shrink: true }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} error={Boolean(promocodeValidation.dateOrderError)} helperText={promocodeValidation.dateOrderError ?? ' '} />
              <TextField label="Date to" type="date" InputLabelProps={{ shrink: true }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} error={Boolean(promocodeValidation.dateOrderError)} helperText={promocodeValidation.dateOrderError ?? ' '} />
              <Button type="submit" variant="contained" sx={{ gridColumn: '1 / -1' }} disabled={createPromocodeMutation.isPending || !promocodeValidation.isValid}>Create promocode</Button>
            </Box>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Create order</Typography>
            <Box component="form" onSubmit={handleOrderSubmit} sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Amount"
                type="number"
                value={orderAmount}
                onChange={(e) => setOrderAmount(e.target.value)}
                error={Boolean(orderValidation.amountError)}
                helperText={orderValidation.amountError ?? ' '}
              />
              <Button type="submit" variant="contained" disabled={createOrderMutation.isPending || !orderValidation.isValid}>Create order</Button>
            </Box>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Apply promocode to order</Typography>
            <Box component="form" onSubmit={handleApplySubmit} sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <TextField
                label="Order ID"
                value={applyOrderId}
                onChange={(e) => setApplyOrderId(e.target.value)}
                helperText={applyValidation.orderIdError ?? 'Pick an order from the table below'}
                error={Boolean(applyValidation.orderIdError)}
              />
              <TextField
                label="Promocode code"
                value={applyPromocodeCode}
                onChange={(e) => setApplyPromocodeCode(e.target.value)}
                error={Boolean(applyValidation.promocodeCodeError)}
                helperText={applyValidation.promocodeCodeError ?? ' '}
              />
              <Button type="submit" variant="contained" sx={{ gridColumn: '1 / -1' }} disabled={applyPromocodeMutation.isPending || !applyValidation.isValid}>Apply promocode</Button>
            </Box>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">My orders</Typography>
              <Button onClick={() => myOrdersQuery.refetch()}>Refresh</Button>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Order ID</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Discount</TableCell>
                  <TableCell>Final</TableCell>
                  <TableCell>Promocode</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orderRows.map((order) => {
                  const orderId = order.id ?? order._id ?? '';
                  return (
                    <TableRow key={orderId} hover onClick={() => setApplyOrderId(orderId)} sx={{ cursor: 'pointer' }}>
                      <TableCell>{orderId}</TableCell>
                      <TableCell>{order.amount}</TableCell>
                      <TableCell>{order.discountAmount}</TableCell>
                      <TableCell>{order.finalAmount}</TableCell>
                      <TableCell>{order.promocodeCode ?? '-'}</TableCell>
                      <TableCell>{order.createdAt}</TableCell>
                    </TableRow>
                  );
                })}
                {!myOrdersQuery.isLoading && orderRows.length === 0 ? (
                  <TableRow><TableCell colSpan={6}>No orders yet</TableCell></TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Paper>
        </Stack>
      ) : null}
    </Container>
  );
}
