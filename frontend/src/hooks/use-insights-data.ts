import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { InsightsState, DataQualityMetrics, OutliersData, CorrelationsData, InsightsSummary } from '@/types/insights';

/**
 * Custom hook to fetch and manage insights data for a dataset
 */
export const useInsightsData = (datasetId: string | null) => {
  const [state, setState] = useState<InsightsState>({
    datasetId: null,
    quality: null,
    outliers: null,
    correlations: null,
    summary: null,
    isLoading: false,
    error: null,
  });

  const fetchDataQuality = useCallback(async (id: string) => {
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        apiClient.setToken(token);
      }

      const response = await apiClient.getDataQuality(id) as { 
        dataset_id: string;
        quality_metrics: DataQualityMetrics;
      };
      
      setState(prev => ({
        ...prev,
        quality: response.quality_metrics,
      }));

      return response.quality_metrics;
    } catch (error) {
      console.error('Error fetching data quality:', error);
      throw error;
    }
  }, []);

  const fetchOutliers = useCallback(async (id: string, method: 'iqr' | 'zscore' = 'iqr') => {
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        apiClient.setToken(token);
      }

      const response = await apiClient.getOutliers(id, method) as OutliersData & { dataset_id: string };
      
      setState(prev => ({
        ...prev,
        outliers: {
          outliers: response.outliers,
          total_outliers: response.total_outliers,
          affected_features: response.affected_features,
          method: response.method,
        },
      }));

      return response;
    } catch (error) {
      console.error('Error fetching outliers:', error);
      throw error;
    }
  }, []);

  const fetchCorrelations = useCallback(async (
    id: string,
    method: 'pearson' | 'spearman' = 'pearson',
    threshold: number = 0.5
  ) => {
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        apiClient.setToken(token);
      }

      const response = await apiClient.getCorrelations(id, method, threshold) as CorrelationsData & { dataset_id: string };
      
      setState(prev => ({
        ...prev,
        correlations: {
          correlations: response.correlations,
          strong_correlations: response.strong_correlations,
          total_pairs: response.total_pairs,
          correlation_matrix: response.correlation_matrix,
          method: response.method,
          features_analyzed: response.features_analyzed,
        },
      }));

      return response;
    } catch (error) {
      console.error('Error fetching correlations:', error);
      throw error;
    }
  }, []);

  const fetchSummary = useCallback(async (id: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const token = localStorage.getItem('access_token');
      if (token) {
        apiClient.setToken(token);
      }

      const response = await apiClient.getInsightsSummary(id) as InsightsSummary;
      
      setState({
        datasetId: id,
        quality: response.quality_metrics,
        outliers: response.outliers,
        correlations: {
          correlations: response.correlations.top_correlations,
          strong_correlations: response.correlations.strong_correlations,
          total_pairs: response.correlations.total_pairs,
          method: 'pearson',
          features_analyzed: [],
        },
        summary: response,
        isLoading: false,
        error: null,
      });

      return response;
    } catch (error) {
      console.error('Error fetching insights summary:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load insights',
      }));
      throw error;
    }
  }, []);

  // Fetch all insights when dataset ID changes
  useEffect(() => {
    if (datasetId) {
      fetchSummary(datasetId);
    } else {
      setState({
        datasetId: null,
        quality: null,
        outliers: null,
        correlations: null,
        summary: null,
        isLoading: false,
        error: null,
      });
    }
  }, [datasetId, fetchSummary]);

  return {
    ...state,
    fetchDataQuality,
    fetchOutliers,
    fetchCorrelations,
    fetchSummary,
    refetch: () => datasetId && fetchSummary(datasetId),
  };
};

/**
 * Get quality status color for UI
 */
export function getQualityStatusColor(status: string): string {
  switch (status) {
    case 'good':
      return 'text-green-500';
    case 'warning':
      return 'text-yellow-500';
    case 'poor':
      return 'text-red-500';
    default:
      return 'text-muted-foreground';
  }
}

/**
 * Get quality status badge variant
 */
export function getQualityBadgeVariant(status: string): 'default' | 'destructive' | 'outline' {
  switch (status) {
    case 'good':
      return 'default';
    case 'warning':
      return 'outline';
    case 'poor':
      return 'destructive';
    default:
      return 'outline';
  }
}

/**
 * Get impact color for outliers
 */
export function getImpactColor(impact: string): string {
  switch (impact) {
    case 'high':
      return 'border-red-500 text-red-500';
    case 'medium':
      return 'border-yellow-500 text-yellow-500';
    case 'low':
      return 'border-green-500 text-green-500';
    default:
      return 'border-muted-foreground text-muted-foreground';
  }
}
