"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PLATFORMS, PLATFORM_COLORS, PLATFORM_LABELS } from "@/lib/constants";
import type { TrendPoint } from "@/lib/queries";

export function VisibilityTrend({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(v: string) => v.slice(5)}
          stroke="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--popover-foreground)",
          }}
          formatter={(value, name) => [
            `${value}%`,
            PLATFORM_LABELS[name as keyof typeof PLATFORM_LABELS] ?? String(name),
          ]}
        />
        {PLATFORMS.map((p) => (
          <Line
            key={p}
            type="monotone"
            dataKey={p}
            stroke={PLATFORM_COLORS[p]}
            strokeWidth={2}
            dot={false}
            name={p}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
