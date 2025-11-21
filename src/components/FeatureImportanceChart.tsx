import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Award, AlertCircle } from 'lucide-react';

interface FeatureImportanceData {
  feature: string;
  importance: number;
  rank: number;
}

interface FeatureImportanceChartProps {
  data: FeatureImportanceData[];
  method?: string;
  topN?: number;
}

const COLORS = [
  '#8b5cf6', // purple
  '#6366f1', // indigo  
  '#3b82f6', // blue
  '#0ea5e9', // sky
  '#06b6d4', // cyan
  '#14b8a6', // teal
  '#10b981', // emerald
  '#84cc16', // lime
  '#eab308', // yellow
  '#f59e0b', // amber
];

export const FeatureImportanceChart: React.FC<FeatureImportanceChartProps> = ({ 
  data, 
  method = 'SHAP',
  topN = 10 
}) => {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            Feature Importance
          </CardTitle>
          <CardDescription>No feature importance data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Get top N features
  const topFeatures = data.slice(0, topN);
  
  // Format data for chart
  const chartData = topFeatures.map((item) => ({
    name: item.feature.length > 20 ? item.feature.substring(0, 17) + '...' : item.feature,
    fullName: item.feature,
    importance: item.importance,
    rank: item.rank,
  }));

  // Calculate statistics
  const totalImportance = data.reduce((sum, item) => sum + item.importance, 0);
  const topFeatureImportance = topFeatures.reduce((sum, item) => sum + item.importance, 0);
  const coveragePercent = totalImportance > 0 ? (topFeatureImportance / totalImportance * 100).toFixed(1) : '0';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Feature Importance
            </CardTitle>
            <CardDescription>
              Top {topN} most important features for model predictions
            </CardDescription>
          </div>
          <Badge variant="outline" className="ml-2">
            {method}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" />
            <span className="text-muted-foreground">
              Top {topN} features explain <strong>{coveragePercent}%</strong> of model decisions
            </span>
          </div>
          <span className="text-muted-foreground">
            {data.length} total features
          </span>
        </div>

        <ResponsiveContainer width="100%" height={Math.max(400, topFeatures.length * 50)}>
          <BarChart 
            data={chartData} 
            layout="vertical"
            margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              type="number"
              label={{ value: 'Importance Score', position: 'insideBottom', offset: -5 }}
            />
            <YAxis 
              type="category" 
              dataKey="name"
              width={115}
              tick={{ fontSize: 12 }}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-background border border-border rounded-lg shadow-lg p-3">
                      <p className="font-semibold text-sm mb-1">{data.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        Rank: #{data.rank}
                      </p>
                      <p className="text-sm font-medium text-primary">
                        Importance: {data.importance.toFixed(4)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          {topFeatures.slice(0, 6).map((feature, index) => (
            <div 
              key={feature.feature}
              className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30"
            >
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" title={feature.feature}>
                  {feature.feature}
                </p>
                <p className="text-xs text-muted-foreground">
                  {feature.importance.toFixed(4)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
