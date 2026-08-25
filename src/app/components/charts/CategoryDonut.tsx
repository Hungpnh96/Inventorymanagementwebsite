import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Product } from '../../types';

interface Props {
  products: Product[];
  topN?: number;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f97316', '#0ea5e9', '#a855f7', '#ec4899', '#64748b'];

export function CategoryDonut({ products, topN = 6 }: Props) {
  const data = useMemo(() => {
    const groups = new Map<string, number>();
    for (const p of products) {
      const key = p.loaiHang?.trim() || 'Khác';
      groups.set(key, (groups.get(key) ?? 0) + p.giaTriKho);
    }
    const sorted = Array.from(groups.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, topN);
    const restValue = sorted.slice(topN).reduce((s, [, v]) => s + v, 0);
    const rows = top.map(([name, value]) => ({ name, value }));
    if (restValue > 0) rows.push({ name: 'Khác', value: restValue });
    return rows;
  }, [products, topN]);

  const total = data.reduce((s, r) => s + r.value, 0);

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        Chưa có dữ liệu
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          stroke="var(--background)"
          strokeWidth={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--popover-foreground)',
          }}
          formatter={(v: number) => [
            new Intl.NumberFormat('vi-VN', {
              style: 'currency',
              currency: 'VND',
              notation: 'compact',
              maximumFractionDigits: 1,
            }).format(v),
            `${((v / total) * 100).toFixed(0)}%`,
          ]}
        />
        <Legend
          iconType="circle"
          layout="vertical"
          align="right"
          verticalAlign="middle"
          wrapperStyle={{ fontSize: 11, paddingLeft: 8 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
