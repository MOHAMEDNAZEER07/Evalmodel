/**
 * Insights page – AI-powered data intelligence and model evaluation.
 * Layout shell that composes sub-components from @/components/insights/*
 * and delegates state management to useInsightsPageData().
 */

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, TrendingUp, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InsightsAIChat } from "@/components/InsightsAIChat";
import { DataQualityCard } from "@/components/insights/DataQualityCard";
import { ModelEvaluationCard } from "@/components/insights/ModelEvaluationCard";
import { CorrelationCard } from "@/components/insights/CorrelationCard";
import { OutlierCard } from "@/components/insights/OutlierCard";
import { ModelSummaryCard } from "@/components/insights/ModelSummaryCard";
import { useInsightsPageData } from "@/hooks/use-insights-page-data";

const Insights = () => {
  const {
    selectedDatasetId,
    setSelectedDatasetId,
    datasets,
    loadingDatasets,
    insightType,
    setInsightType,
    models,
    selectedModelId,
    setSelectedModelId,
    modelEvaluation,
    allEvaluations,
    loadingModels,
    loadingEvaluation,
    isLoading,
    error,
    refetch,
    overallQualityScore,
    qualityData,
    dataQualityMetrics,
    topCorrelations,
    correlations,
    outliersData,
    outliersList,
    dataQualityIssues,
    selectedDataset,
    summary,
  } = useInsightsPageData();

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2 neon-text">
                Data Intelligence & Insights
              </h1>
              <p className="text-muted-foreground text-lg">
                AI-powered analysis and interactive data exploration
              </p>
            </div>
            <div className="flex gap-3">
              <Select
                value={selectedDatasetId || ""}
                onValueChange={setSelectedDatasetId}
                disabled={loadingDatasets}
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select a dataset" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((dataset) => (
                    <SelectItem key={dataset.id} value={dataset.id}>
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        {dataset.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={refetch}
                variant="outline"
                size="icon"
                disabled={!selectedDatasetId || isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  {error.includes("Session expired") || error.includes("authentication")
                    ? "Your session has expired. Please log in again."
                    : error.includes("not found in storage") || error.includes("Object not found")
                    ? "Dataset file not found. The dataset may need to be re-uploaded. Please go to the Upload page to upload your dataset again."
                    : error}
                </span>
                {(error.includes("Session expired") || error.includes("authentication")) && (
                  <Button variant="outline" size="sm" onClick={() => (window.location.href = "/")} className="ml-4">
                    Go to Login
                  </Button>
                )}
                {(error.includes("not found in storage") || error.includes("Object not found")) && (
                  <Button variant="outline" size="sm" onClick={() => (window.location.href = "/upload")} className="ml-4">
                    Go to Upload
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {!selectedDatasetId && !loadingDatasets && datasets.length === 0 && (
            <Alert className="mt-4">
              <Database className="h-4 w-4" />
              <AlertDescription>No datasets found. Please upload a dataset first.</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Tabs for Dataset vs Model Insights */}
        <Tabs value={insightType} onValueChange={(v) => setInsightType(v as "dataset" | "model")} className="mb-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="dataset" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Dataset Insights
            </TabsTrigger>
            <TabsTrigger value="model" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Model Evaluation
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ask EvalModel – Inline Chat */}
            <Card className="glass-card p-8 animate-fade-in-up">
              <InsightsAIChat
                inline
                insightType={insightType}
                datasetName={selectedDataset?.name}
                qualityScore={overallQualityScore}
                outlierCount={outliersData?.affected_features}
                correlationCount={topCorrelations.length}
                issues={dataQualityIssues}
                summary={summary?.summary}
                modelName={models.find((m) => m.id === selectedModelId)?.name}
                modelType={models.find((m) => m.id === selectedModelId)?.model_type}
                modelFramework={models.find((m) => m.id === selectedModelId)?.framework}
                evalScore={modelEvaluation?.eval_score}
                modelMetrics={modelEvaluation?.metrics}
                allEvaluations={allEvaluations}
                allModels={models}
                allDatasets={datasets}
              />
            </Card>

            {/* Dataset: Data Quality Radar */}
            {insightType === "dataset" && (
              <DataQualityCard
                isLoading={isLoading}
                qualityData={qualityData}
                overallQualityScore={overallQualityScore}
                dataQualityMetrics={dataQualityMetrics}
              />
            )}

            {/* Model: Evaluation Metrics */}
            {insightType === "model" && (
              <ModelEvaluationCard
                models={models}
                selectedModelId={selectedModelId}
                setSelectedModelId={setSelectedModelId}
                selectedDatasetId={selectedDatasetId}
                loadingModels={loadingModels}
                loadingEvaluation={loadingEvaluation}
                modelEvaluation={modelEvaluation}
              />
            )}

            {/* Dataset: Correlations */}
            {insightType === "dataset" && (
              <CorrelationCard
                isLoading={isLoading}
                topCorrelations={topCorrelations}
                correlations={correlations}
                summaryTotalPairs={summary?.correlations?.total_pairs}
              />
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Dataset: Outliers */}
            {insightType === "dataset" && (
              <OutlierCard isLoading={isLoading} outliersList={outliersList} outliersData={outliersData} />
            )}

            {/* Model: Summary */}
            {insightType === "model" && selectedModelId && modelEvaluation && (
              <ModelSummaryCard
                models={models}
                selectedModelId={selectedModelId}
                modelEvaluation={modelEvaluation}
                selectedDataset={selectedDataset}
              />
            )}

            {/* Quick Actions */}
            <Card className="glass-card p-6 animate-fade-in-up">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Generate Quality Report
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <XCircle className="h-4 w-4 mr-2" />
                  Remove Outliers
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Feature Importance
                </Button>
              </div>
            </Card>

            {/* AI Summary */}
            <Card className="glass-card p-6 glow-border-accent animate-fade-in-up">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold">AI Summary</h3>
              </div>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : summary?.summary ? (
                <p className="text-sm text-muted-foreground">{summary.summary}</p>
              ) : selectedDatasetId ? (
                <p className="text-sm text-muted-foreground">Analyzing your dataset...</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a dataset to get AI-powered insights and recommendations.
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Insights;
