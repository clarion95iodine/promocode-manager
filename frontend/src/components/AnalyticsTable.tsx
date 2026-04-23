import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, MenuItem, Select, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { api } from '../api/client';

type SortDirection = 'asc' | 'desc';

type AnalyticsResponse<T> = {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
};

export type Column<T> = {
  key: keyof T & string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
};

export function AnalyticsTable<T extends Record<string, unknown>>({
  title,
  endpoint,
  columns,
}: {
  title: string;
  endpoint: string;
  columns: Column<T>[];
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>(columns[0]?.key ?? 'createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [preset, setPreset] = useState<'today' | '7d' | '30d' | 'custom'>('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const dateRange = useMemo(() => {
    const now = new Date();
    const to = now.toISOString();
    const from = new Date(now);
    if (preset === 'today') from.setHours(0, 0, 0, 0);
    else if (preset === '7d') from.setDate(from.getDate() - 7);
    else if (preset === '30d') from.setDate(from.getDate() - 30);
    else {
      return {
        dateFrom: customFrom ? new Date(customFrom).toISOString() : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        dateTo: customTo ? new Date(customTo).toISOString() : to,
      };
    }
    return { dateFrom: from.toISOString(), dateTo: to };
  }, [customFrom, customTo, preset]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: [endpoint, page, pageSize, search, sortBy, sortDirection, dateRange.dateFrom, dateRange.dateTo],
    queryFn: async () => {
      const response = await api.get<AnalyticsResponse<T>>(endpoint, {
        params: { page, pageSize, search, sortBy, sortDirection, ...dateRange },
      });
      return response.data;
    },
  });

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Typography variant="h6">{title}</Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField size="small" label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select size="small" value={preset} onChange={(e) => setPreset(e.target.value as typeof preset)}>
          <MenuItem value="today">Сегодня</MenuItem>
          <MenuItem value="7d">Последние 7 дней</MenuItem>
          <MenuItem value="30d">Последние 30 дней</MenuItem>
          <MenuItem value="custom">Произвольный</MenuItem>
        </Select>
        {preset === 'custom' ? (
          <>
            <TextField size="small" type="date" label="From" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField size="small" type="date" label="To" value={customTo} onChange={(e) => setCustomTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          </>
        ) : null}
        <Select size="small" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
          {[10, 20, 50].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
        </Select>
        <Button variant="outlined" onClick={() => refetch()}>Refresh</Button>
      </Box>

      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell key={column.key} onClick={() => {
                if (!column.sortable) return;
                if (sortBy === column.key) setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
                else setSortBy(column.key);
              }} sx={{ cursor: column.sortable ? 'pointer' : 'default' }}>
                {column.label}
                {sortBy === column.key ? ` ${sortDirection === 'asc' ? '▲' : '▼'}` : ''}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading || !data ? (
            <TableRow><TableCell colSpan={columns.length}>Loading...</TableCell></TableRow>
          ) : data.data.map((row) => (
            <TableRow key={String(row['id'] ?? JSON.stringify(row))}>
              {columns.map((column) => (
                <TableCell key={column.key}>{column.render ? column.render(row) : String(row[column.key] ?? '')}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Button disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Prev</Button>
        <Typography>
          Page {page} / {Math.max(1, Math.ceil((data?.meta.total ?? 0) / pageSize))} — Total {data?.meta.total ?? 0}
        </Typography>
        <Button disabled={Boolean(data && page * pageSize >= data.meta.total)} onClick={() => setPage((current) => current + 1)}>Next</Button>
      </Box>
    </Box>
  );
}
