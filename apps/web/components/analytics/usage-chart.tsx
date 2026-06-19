'use client';

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { format, parseISO } from 'date-fns';
import { formatAmount } from '@/lib/utils';

interface VolumePoint {
  date: string;
  fundedBaseUnits: string;
  releasedBaseUnits: string;
}

interface UsageChartProps {
  data: VolumePoint[];
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-xl text-xs">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-mono-num font-semibold text-foreground mt-0.5">
        {formatAmount(BigInt(Math.round(payload[0]?.value ?? 0)), 6, 'USDC')}
      </p>
    </div>
  );
}

export function UsageChart({ data }: UsageChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg bg-muted/30 text-sm text-muted-foreground">
        No volume data yet
      </div>
    );
  }

  const chartData = data.map((d) => ({
    date: (() => {
      try { return format(parseISO(d.date), 'MMM d'); } catch { return d.date; }
    })(),
    funded: Number(BigInt(d.fundedBaseUnits)),
    released: Number(BigInt(d.releasedBaseUnits)),
  }));

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(263,70%,50%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(263,70%,50%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${(v / 1_000_000).toFixed(v < 1_000_000 ? 2 : 0)}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="funded"
            name="Funded"
            stroke="hsl(263,70%,50%)"
            strokeWidth={2}
            fill="url(#volumeGrad)"
          />
          <Area
            type="monotone"
            dataKey="released"
            name="Released"
            stroke="hsl(160,84%,39%)"
            strokeWidth={2}
            fill="transparent"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
