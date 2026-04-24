import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface MetricsChartDatum {
  name: string;
  value: number;
  rawValue: number;
  interpretation: {
    status: string;
    color: string;
  };
}

interface FairnessMetricsChartProps {
  data: MetricsChartDatum[];
  goodColor: string;
  moderateColor: string;
  poorColor: string;
}

export function FairnessMetricsChart({
  data,
  goodColor,
  moderateColor,
  poorColor,
}: FairnessMetricsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} layout="vertical" margin={{ left: 150 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 1]} />
        <YAxis type="category" dataKey="name" width={145} />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const point = payload[0].payload as MetricsChartDatum;
              return (
                <div className="bg-background border border-border rounded-lg shadow-lg p-3">
                  <p className="font-semibold text-sm mb-1">{point.name}</p>
                  <p className="text-sm">Value: {point.rawValue.toFixed(4)}</p>
                  <span className={`text-sm font-medium ${point.interpretation.color}`}>
                    {point.interpretation.status}
                  </span>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                entry.interpretation.status === "Fair"
                  ? goodColor
                  : entry.interpretation.status === "Moderate"
                  ? moderateColor
                  : poorColor
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
