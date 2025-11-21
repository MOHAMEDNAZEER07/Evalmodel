/**
 * useSearch hook
 * Reusable search and filter logic for any list of items
 */

import { useState, useMemo, useCallback } from 'react';
import { searchAndFilter, sortByRelevance } from '@/lib/search';

interface UseSearchOptions<T> {
  items: T[];
  searchFields: (keyof T)[];
  initialQuery?: string;
  initialFilters?: { field: keyof T; value: any }[];
  sortByRelevance?: boolean;
  primarySortField?: keyof T;
}

interface UseSearchReturn<T> {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filters: { field: keyof T; value: any }[];
  setFilter: (field: keyof T, value: any) => void;
  clearFilters: () => void;
  filteredItems: T[];
  resultCount: number;
}

export function useSearch<T extends Record<string, any>>({
  items,
  searchFields,
  initialQuery = '',
  initialFilters = [],
  sortByRelevance: shouldSort = false,
  primarySortField = 'name' as keyof T,
}: UseSearchOptions<T>): UseSearchReturn<T> {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<{ field: keyof T; value: any }[]>(initialFilters);

  const setFilter = useCallback((field: keyof T, value: any) => {
    setFilters((prev) => {
      const existing = prev.find((f) => f.field === field);
      if (existing) {
        return prev.map((f) => (f.field === field ? { field, value } : f));
      }
      return [...prev, { field, value }];
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters([]);
    setSearchQuery('');
  }, []);

  const filteredItems = useMemo(() => {
    // Filter out 'all' or empty filters
    const activeFilters = filters.filter(f => f.value && f.value !== 'all' && f.value !== '');
    
    let results = searchAndFilter(items, searchQuery, searchFields, activeFilters);
    
    if (shouldSort && searchQuery.trim()) {
      results = sortByRelevance(results, searchQuery, primarySortField);
    }
    
    return results;
  }, [items, searchQuery, searchFields, filters, shouldSort, primarySortField]);

  return {
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    clearFilters,
    filteredItems,
    resultCount: filteredItems.length,
  };
}
