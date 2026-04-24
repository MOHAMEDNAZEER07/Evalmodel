import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface GroupComparisonDatum {
  group: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
}

interface FairnessGroupChartsProps {
  groupComparisonData: GroupComparisonDatum[];
}

export function FairnessGroupCharts({
  groupComparisonData,
}: FairnessGroupChartsProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Performance by Group</CardTitle>
          <CardDescription>Comparing metrics across different demographic groups</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={groupComparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="group" />
              <YAxis domain={[0, 100]} label={{ value: "Percentage", angle: -90, position: "insideLeft" }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="accuracy" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="precision" stroke="#10b981" strokeWidth={2} />
              <Line type="monotone" dataKey="recall" stroke="#f59e0b" strokeWidth={2} />
              <Line type="monotone" dataKey="f1_score" stroke="#8b5cf6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Grouped Metric Comparison</CardTitle>
          <CardDescription>Side-by-side metric comparison by group</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={groupComparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="group" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="accuracy" fill="#3b82f6" />
              <Bar dataKey="precision" fill="#10b981" />
              <Bar dataKey="recall" fill="#f59e0b" />
              <Bar dataKey="f1_score" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </>
  );
}
