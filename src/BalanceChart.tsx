import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { money } from "./lib";
export default function BalanceChart({
  data,
}: {
  data: { date: string; balance: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={255}>
      <AreaChart
        data={data}
        margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="green" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bbf86a" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#bbf86a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          stroke="#282d28"
          strokeDasharray="3 5"
        />
        <XAxis
          dataKey="date"
          stroke="#7c887c"
          tickLine={false}
          axisLine={false}
          minTickGap={60}
        />
        <YAxis
          stroke="#7c887c"
          tickLine={false}
          axisLine={false}
          width={70}
          tickFormatter={(v) =>
            new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v)
          }
        />
        <Tooltip
          contentStyle={{
            background: "#202620",
            border: "1px solid #414c40",
            borderRadius: 12,
          }}
          formatter={(v) => [money(Number(v)), "Saldo"]}
        />
        <Area
          type="stepAfter"
          dataKey="balance"
          stroke="#bbf86a"
          strokeWidth={2.5}
          fill="url(#green)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
