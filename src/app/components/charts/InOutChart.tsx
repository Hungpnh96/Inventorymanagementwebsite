import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Transaction } from '../../types';

interface Props {
  transactions: Transaction[];
  days?: number;
}

export function InOutChart({ transactions, days = 14 }: Props) {
  const data = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rows: { date: string; label: string; nhap: number; xuat: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      rows.push({
        date: key,
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        nhap: 0,
        xuat: 0,
      });
    }
    const map = new Map(rows.map((r) => [r.date, r]));
    for (const t of transactions) {
      const d = new Date(t.date);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      const row = map.get(key);
      if (row) {
        if (t.type === 'import') row.nhap += t.quantity;
        else row.xuat += t.quantity;
      }
    }
    return Array.from(map.values());
  }, [transactions, days]);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: 'currentColor', fillOpacity: 0.6 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'currentColor', fillOpacity: 0.6 }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip
          cursor={{ stroke: 'currentColor', strokeOpacity: 0.15 }}
          contentStyle={{
            backgroundColor: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--popover-foreground)',
          }}
          labelStyle={{ color: 'var(--muted-foreground)' }}
        />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 11 }}
          formatter={(v) => (v === 'nhap' ? 'Nhập' : 'Xuất')}
        />
        <Area
          type="monotone"
          dataKey="nhap"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#gradIn)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="xuat"
          stroke="#f97316"
          strokeWidth={2}
          fill="url(#gradOut)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
