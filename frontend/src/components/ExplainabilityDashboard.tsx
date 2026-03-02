import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, Sparkles, Info, CheckCircle2, XCircle } from 'lucide-react';
import { FeatureImportanceChart } from './FeatureImportanceChart';

interface ExplainabilityDashboardProps {
  featureImportance: Array<{ feature: string; importance: number; rank: number }> | null;
  explainabilityMethod: string | null;
  shapSummary: {
    mean_abs_shap?: number;
    max_shap?: number;
    top_features?: string[];
    base_value?: number;
  } | null;
}

export const ExplainabilityDashboard: React.FC<ExplainabilityDashboardProps> = ({
  featureImportance,
  explainabilityMethod,
  shapSummary,
}) => {
  if (!featureImportance || featureImportance.length === 0) {
    return (
      <div className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Explainability analysis is not available for this evaluation. This may occur if:
            <ul className="list-disc list-inside mt-2 ml-4 space-y-1">
              <li>The model type doesn't support SHAP/LIME analysis</li>
              <li>Required libraries (SHAP, LIME) are not installed</li>
              <li>The model was evaluated before explainability features were added</li>
            </ul>
            <p className="mt-2 font-medium">
              Run a new evaluation to generate explainability insights.
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Model Explainability</h2>
            <p className="text-sm text-muted-foreground">
              Understanding what drives your model's predictions
            </p>
          </div>
        </div>
        {explainabilityMethod && (
          <Badge variant="secondary" className="flex items-center gap-2">
            <Sparkles className="h-3 w-3" />
            {explainabilityMethod === 'SHAP' && 'SHAP Analysis'}
            {explainabilityMethod === 'LIME' && 'LIME Analysis'}
            {explainabilityMethod === 'basic' && 'Basic Feature Importance'}
          </Badge>
        )}
      </div>

      {/* SHAP Summary Stats (if available) */}
      {shapSummary && explainabilityMethod === 'SHAP' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {shapSummary.mean_abs_shap !== undefined && (
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Average Feature Impact</CardDescription>
                <CardTitle className="text-2xl">
                  {shapSummary.mean_abs_shap.toFixed(4)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Mean absolute SHAP value across all features
                </p>
              </CardContent>
            </Card>
          )}
          
          {shapSummary.max_shap !== undefined && (
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Maximum Feature Impact</CardDescription>
                <CardTitle className="text-2xl">
                  {shapSummary.max_shap.toFixed(4)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Strongest individual feature contribution
                </p>
              </CardContent>
            </Card>
          )}
          
          {shapSummary.base_value !== undefined && shapSummary.base_value !== null && (
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Model Base Value</CardDescription>
                <CardTitle className="text-2xl">
                  {shapSummary.base_value.toFixed(4)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Average model output (expected value)
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Feature Importance Chart */}
      <FeatureImportanceChart 
        data={featureImportance} 
        method={explainabilityMethod || 'Unknown'}
        topN={10}
      />

      {/* Interpretation Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5" />
            How to Interpret
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {explainabilityMethod === 'SHAP' && (
            <>
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">SHAP Values</p>
                  <p className="text-sm text-muted-foreground">
                    SHAP (SHapley Additive exPlanations) values show how each feature contributes to pushing the model output from the base value to the actual prediction. Positive values push the prediction higher, negative values lower.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Feature Importance</p>
                  <p className="text-sm text-muted-foreground">
                    The chart shows the mean absolute SHAP value for each feature, representing its average impact on predictions across all samples. Higher bars indicate more influential features.
                  </p>
                </div>
              </div>
            </>
          )}
          
          {explainabilityMethod === 'LIME' && (
            <>
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">LIME Explanations</p>
                  <p className="text-sm text-muted-foreground">
                    LIME (Local Interpretable Model-agnostic Explanations) creates simplified local models to explain individual predictions. The importance scores show which features had the most impact.
                  </p>
                </div>
              </div>
            </>
          )}
          
          {explainabilityMethod === 'basic' && (
            <>
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Built-in Feature Importance</p>
                  <p className="text-sm text-muted-foreground">
                    These values come directly from the model's internal feature importance calculations (e.g., from tree-based models or linear coefficients).
                  </p>
                </div>
              </div>
            </>
          )}
          
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Using These Insights</p>
              <p className="text-sm text-muted-foreground">
                Focus on top-ranked features for:
                <span className="block mt-1">• Feature engineering and selection</span>
                <span className="block">• Data quality improvements</span>
                <span className="block">• Model debugging and validation</span>
                <span className="block">• Stakeholder communication</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
