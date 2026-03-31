import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import type { DashboardData, DashboardMetrics, Evaluation, Model, Dataset } from '@/types/dashboard';

/**
 * Custom hook to fetch and manage dashboard data
 * Aggregates data from multiple API endpoints
 */
export const useDashboardData = () => {
  const [data, setData] = useState<DashboardData>({
    metrics: {
      totalModels: 0,
      totalDatasets: 0,
      totalEvaluations: 0,
      averageAccuracy: 0,
      averageEvalScore: 0,
      modelsEvaluated: 0,
      modelsUnevaluated: 0,
      recentActivity: 0,
    },
    recentEvaluations: [],
    isLoading: true,
    error: null,
  });

  const fetchDashboardData = async (signal?: AbortSignal) => {
    try {
      setData(prev => ({ ...prev, isLoading: true, error: null }));

      // Get auth token from localStorage
      const token = sessionStorage.getItem('access_token');
      if (token) {
        apiClient.setToken(token);
      }

      // Fetch all data in parallel
      // Use the same default params as other pages (limit=100) so requests share the cache
      const [modelsResponse, datasetsResponse, evaluationsResponse] = await Promise.all([
        apiClient.listModels(),
        apiClient.listDatasets(),
        apiClient.getEvaluationHistory(),
      ]);

      // Ignore result if this fetch was superseded (e.g. StrictMode double-mount)
      if (signal?.aborted) return;

      const models: Model[] = modelsResponse.models || [];
      const datasets: Dataset[] = datasetsResponse.datasets || [];
      const allEvaluations: Evaluation[] = evaluationsResponse.evaluations || [];

      const metrics = calculateMetrics(models, datasets, allEvaluations);
      const recentEvaluations = allEvaluations.slice(0, 10);

      setData({
        metrics,
        recentEvaluations,
        isLoading: false,
        error: null,
      });

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Error fetching dashboard data:', error);
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load dashboard data',
      }));
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchDashboardData(controller.signal);
    return () => controller.abort();
  }, []);

  return {
    ...data,
    refetch: fetchDashboardData,
  };
};

/**
 * Calculate dashboard metrics from raw data
 */
function calculateMetrics(
  models: Model[],
  datasets: Dataset[],
  evaluations: Evaluation[]
): DashboardMetrics {
  const totalModels = models.length;
  const totalDatasets = datasets.length;
  const totalEvaluations = evaluations.length;

  // Count evaluated vs unevaluated models
  const modelsEvaluated = models.filter(m => m.is_evaluated).length;
  const modelsUnevaluated = totalModels - modelsEvaluated;

  // Calculate average accuracy (from evaluations with accuracy metric)
  const evaluationsWithAccuracy = evaluations.filter(e => 
    e.metrics && typeof e.metrics.accuracy === 'number'
  );
  const averageAccuracy = evaluationsWithAccuracy.length > 0
    ? evaluationsWithAccuracy.reduce((sum, e) => sum + (e.metrics.accuracy || 0), 0) / evaluationsWithAccuracy.length
    : 0;

  // Calculate average EvalScore
  const averageEvalScore = totalEvaluations > 0
    ? evaluations.reduce((sum, e) => sum + e.eval_score, 0) / totalEvaluations
    : 0;

  // Count evaluations in last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentActivity = evaluations.filter(e => {
    const evalDate = new Date(e.evaluated_at);
    return evalDate >= sevenDaysAgo;
  }).length;

  return {
    totalModels,
    totalDatasets,
    totalEvaluations,
    averageAccuracy: Math.round(averageAccuracy * 100), // Convert to percentage
    averageEvalScore: Math.round(averageEvalScore * 10) / 10, // Round to 1 decimal
    modelsEvaluated,
    modelsUnevaluated,
    recentActivity,
  };
}

/**
 * Format relative time (e.g., "2 hours ago", "3 days ago")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / 60000);
  const diffInHours = Math.floor(diffInMs / 3600000);
  const diffInDays = Math.floor(diffInMs / 86400000);

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }
  if (diffInDays < 365) {
    const months = Math.floor(diffInDays / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }
  const years = Math.floor(diffInDays / 365);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

/**
 * Get primary metric from evaluation
 */
export function getPrimaryMetric(evaluation: Evaluation): { name: string; value: string } {
  const metrics = evaluation.metrics;
  
  // Priority order: accuracy, f1, r2, precision
  if (metrics.accuracy !== undefined) {
    return { name: 'Accuracy', value: `${(metrics.accuracy * 100).toFixed(1)}%` };
  }
  if (metrics.f1_score !== undefined) {
    return { name: 'F1 Score', value: `${(metrics.f1_score * 100).toFixed(1)}%` };
  }
  if (metrics.r2_score !== undefined) {
    return { name: 'R² Score', value: metrics.r2_score.toFixed(3) };
  }
  if (metrics.precision !== undefined) {
    return { name: 'Precision', value: `${(metrics.precision * 100).toFixed(1)}%` };
  }
  if (metrics.mae !== undefined) {
    return { name: 'MAE', value: metrics.mae.toFixed(3) };
  }
  
  // Fallback to EvalScore
  return { name: 'EvalScore', value: evaluation.eval_score.toFixed(1) };
}
