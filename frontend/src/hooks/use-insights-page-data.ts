/**
 * Custom hook that encapsulates all data-fetching and state
 * management for the Insights page.
 */

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useInsightsData } from "@/hooks/use-insights-data";
import type { Dataset } from "@/types/dashboard";
import type { ModelData, Evaluation } from "@/types/insights";

export function useInsightsPageData() {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [insightType, setInsightType] = useState<"dataset" | "model">("dataset");

  // Model insights state
  const [models, setModels] = useState<ModelData[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [modelEvaluation, setModelEvaluation] = useState<Evaluation | null>(null);
  const [allEvaluations, setAllEvaluations] = useState<Evaluation[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingEvaluation, setLoadingEvaluation] = useState(false);

  const { quality, outliers, correlations, summary, isLoading, error, refetch } =
    useInsightsData(selectedDatasetId);

  // ---------- data fetching effects ----------

  // Fetch ALL evaluations on mount for AI context
  useEffect(() => {
    const fetchAllEvaluations = async () => {
      try {
        const token = sessionStorage.getItem("access_token");
        if (token) apiClient.setToken(token);
        const data = await apiClient.getEvaluationHistory();
        console.log("📊 Loaded all evaluations for AI context:", data.evaluations?.length || 0);
        setAllEvaluations(data.evaluations || []);
      } catch (err) {
        console.error("Error fetching all evaluations:", err);
      }
    };
    fetchAllEvaluations();
  }, []);

  // Fetch available datasets on mount
  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const token = sessionStorage.getItem("access_token");
        if (token) apiClient.setToken(token);
        const response = await apiClient.listDatasets();
        setDatasets(response.datasets || []);
        if (response.datasets && response.datasets.length > 0) {
          setSelectedDatasetId(response.datasets[0].id);
        }
      } catch (err) {
        console.error("Error fetching datasets:", err);
      } finally {
        setLoadingDatasets(false);
      }
    };
    fetchDatasets();
  }, []);

  // Fetch available models on mount
  useEffect(() => {
    const fetchModels = async () => {
      setLoadingModels(true);
      try {
        const token = sessionStorage.getItem("access_token");
        if (token) apiClient.setToken(token);
        const response = await apiClient.listModels();
        setModels(
          (response.models || []).map((m: any) => ({
            id: m.id,
            name: m.name,
            description: m.description || "",
            model_type: m.model_type || m.type || "unknown",
            framework: m.framework || "unknown",
            file_size: m.file_size || 0,
            uploaded_at: m.uploaded_at || new Date().toISOString(),
            is_evaluated: m.is_evaluated || false,
          } as ModelData))
        );
        if (insightType === "model") {
          const evaluatedModel = (response.models || []).find((m: any) => m.is_evaluated);
          if (evaluatedModel && selectedDatasetId) {
            setSelectedModelId(evaluatedModel.id);
          }
        }
      } catch (err) {
        console.error("Error fetching models:", err);
      } finally {
        setLoadingModels(false);
      }
    };
    fetchModels();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select model when switching to model tab
  useEffect(() => {
    if (insightType === "model" && models.length > 0 && selectedDatasetId && !selectedModelId) {
      const evaluatedModel = models.find((m) => m.is_evaluated);
      if (evaluatedModel) setSelectedModelId(evaluatedModel.id);
    }
  }, [insightType, models, selectedDatasetId, selectedModelId]);

  // Fetch model evaluation when model is selected
  useEffect(() => {
    const fetchEvaluation = async () => {
      if (!selectedModelId || !selectedDatasetId) return;
      setLoadingEvaluation(true);
      try {
        const token = sessionStorage.getItem("access_token");
        if (token) apiClient.setToken(token);
        const data = await apiClient.getEvaluationHistory();
        setAllEvaluations(data.evaluations || []);

        // Exact match first, then fallback to most recent for this model
        let evaluation = data.evaluations?.find(
          (e: Evaluation) => e.model_id === selectedModelId && e.dataset_id === selectedDatasetId
        );
        if (!evaluation) {
          evaluation = data.evaluations?.find((e: Evaluation) => e.model_id === selectedModelId);
        }
        setModelEvaluation(evaluation || null);
      } catch (err) {
        console.error("Error fetching evaluation:", err);
        setModelEvaluation(null);
      } finally {
        setLoadingEvaluation(false);
      }
    };
    fetchEvaluation();
  }, [selectedModelId, selectedDatasetId]);

  // ---------- derived / computed data ----------

  const overallQualityScore = quality
    ? quality.overall_score
    : summary?.quality_metrics?.overall_score || 0;

  const qualityData = quality || summary?.quality_metrics;

  const dataQualityMetrics = qualityData
    ? [
        { name: "Completeness", value: qualityData.completeness, status: qualityData.completeness >= 95 ? "good" : qualityData.completeness >= 80 ? "warning" : "poor" },
        { name: "Validity", value: qualityData.validity, status: qualityData.validity >= 95 ? "good" : qualityData.validity >= 80 ? "warning" : "poor" },
        { name: "Uniqueness", value: qualityData.uniqueness, status: qualityData.uniqueness >= 70 ? "good" : qualityData.uniqueness >= 50 ? "warning" : "poor" },
        { name: "Consistency", value: qualityData.consistency, status: qualityData.consistency >= 95 ? "good" : qualityData.consistency >= 80 ? "warning" : "poor" },
      ]
    : [];

  const correlationData =
    summary?.correlations?.top_correlations || correlations?.correlations || [];
  const topCorrelations = correlationData.slice(0, 5);

  const outliersData = outliers || summary?.outliers;
  const outliersList = outliersData?.outliers?.slice(0, 5) || [];

  const dataQualityIssues: string[] = [];
  if (qualityData) {
    if (qualityData.missing_values > 0)
      dataQualityIssues.push(`${qualityData.missing_values} missing values detected`);
    if (qualityData.completeness < 95)
      dataQualityIssues.push(`Completeness is ${qualityData.completeness.toFixed(1)}% (below 95%)`);
    if (qualityData.validity < 95)
      dataQualityIssues.push(`Data validity is ${qualityData.validity.toFixed(1)}% (below 95%)`);
    if (qualityData.uniqueness < 70)
      dataQualityIssues.push(`Uniqueness is ${qualityData.uniqueness.toFixed(1)}% (below 70%)`);
  }
  if (outliersData && outliersData.total_outliers > 0) {
    dataQualityIssues.push(
      `${outliersData.total_outliers} total outliers across ${outliersData.affected_features} features`
    );
  }

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);

  return {
    // State & setters
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
    // Insight data hook results
    isLoading,
    error,
    refetch,
    // Derived data
    overallQualityScore,
    qualityData,
    dataQualityMetrics,
    correlationData,
    topCorrelations,
    correlations,
    outliersData,
    outliersList,
    dataQualityIssues,
    selectedDataset,
    summary,
  };
}
