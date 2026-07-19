"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { equity as defaultEquity } from "@/lib/data";

type EquityPoint = { trade: number; value: number };

function normalize(data?: Array<{ trade?: number; value?: number; equity?: number }> | null): EquityPoint[] {
  if (!data || !Array.isArray(data) || data.length === 0) return defaultEquity;
  return data.map((point, index) => ({
    trade: Number(point.trade ?? index + 1),
    value: Number(point.value ?? point.equity ?? 0),
  }));
}

export function EquityChart({
  compact = false,
  data,
}: {
  compact?: boolean;
  data?: Array<{ trade?: number; value?: number; equity?: number }> | null;
}) {
  const reduceMotion = useReducedMotion();
  const chartData = useMemo(() => normalize(data), [data]);
  const values = chartData.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(2, (max - min) * 0.08);
  const domain: [number, number] = [Math.floor(min - pad), Math.ceil(max + pad)];

  return (
    <div className={compact ? "h-[250px]" : "h-[370px]"}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 20, right: 4, left: compact ? -28 : 0, bottom: 0 }}>
          <defs>
            <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9BF56A" stopOpacity={0.34} />
              <stop offset="100%" stopColor="#62F6B2" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
          <XAxis hide={compact} dataKey="trade" stroke="#555" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
          <YAxis hide={compact} domain={domain} stroke="#555" tickLine={false} axisLine={false} tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }} />
          <Tooltip
            contentStyle={{ background: "#091210", border: "1px solid rgba(255,255,255,.1)", fontSize: 11 }}
            labelStyle={{ color: "#8D9B96" }}
            itemStyle={{ color: "#9BF56A" }}
            formatter={(value) => [`$${Number(value).toLocaleString()}`, "Equity"]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#9BF56A"
            strokeWidth={2.2}
            fill="url(#eq)"
            isAnimationActive={!reduceMotion}
            animationDuration={650}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
