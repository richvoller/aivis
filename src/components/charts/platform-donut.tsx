"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PLATFORM_COLORS, PLATFORM_LABELS, type Platform } from "@/lib/constants";
import type { PlatformBreakdown } from "@/lib/queries";

export function PlatformDonut({ data }: { data: PlatformBreakdown[] }) {
  const chartData = data
    .filter((d) => d.total > 0)
    .map((d) => ({
      name: PLATFORM_LABELS[d.platform],
      platform: d.platform,
      value: d.mentioned,
    }));

  if (!chartData.length) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No mention data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
        >
          {chartData.map((entry) => (
            <Cell key={entry.platform} fill={PLATFORM_COLORS[entry.platform as Platform]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--popover-foreground)",
          }}
          formatter={(value) => [`${value} mentions`, ""]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
