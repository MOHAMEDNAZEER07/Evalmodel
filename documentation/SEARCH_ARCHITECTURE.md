# Search Module Architecture

This document describes the modular search system implemented across the EvalModel application.

## Architecture Overview

The search functionality is now organized into reusable, modular components that can be used throughout the application.

## Core Modules

### 1. `src/lib/search.ts` - Search Utilities
**Purpose:** Core search logic and utility functions

**Functions:**
- `searchItems<T>()` - Generic search across multiple fields
- `filterByField<T>()` - Filter items by specific field value
- `searchAndFilter<T>()` - Combined search and filter
- `debounce()` - Debounce function for search input
- `highlightText()` - Highlight search query in text
- `sortByRelevance<T>()` - Sort results by relevance to query

**Usage Example:**
```typescript
import { searchItems } from '@/lib/search';

const results = searchItems(
  models,
  'pytorch',
  ['name', 'description', 'framework']
);
```

### 2. `src/hooks/use-search.ts` - Search Hook
**Purpose:** Reusable React hook for search functionality

**Features:**
- State management for search query and filters
- Automatic filtering and sorting
- Memoized results for performance

**Usage Example:**
```typescript
import { useSearch } from '@/hooks/use-search';

const {
  searchQuery,
  setSearchQuery,
  setFilter,
  filteredItems,
  resultCount
} = useSearch({
  items: models,
  searchFields: ['name', 'description', 'framework'],
  sortByRelevance: true
});
```

### 3. `src/components/SearchBar.tsx` - Search Component
**Purpose:** Reusable search UI component

**Props:**
- `placeholder` - Placeholder text
- `value` - Current search value
- `onChange` - Change handler
- `filterOptions` - Optional filter dropdown
- `onFilterChange` - Filter change handler

**Usage Example:**
```tsx
<SearchBar
  placeholder="Search models..."
  value={searchQuery}
  onChange={setSearchQuery}
  filterOptions={[
    { label: 'All', value: 'all' },
    { label: 'PyTorch', value: 'pytorch' }
  ]}
  onFilterChange={(value) => setFilter('framework', value)}
/>
```

### 4. `src/lib/global-search.ts` - Global Search Service
**Purpose:** Centralized search across all entities (models, datasets, evaluations)

**Methods:**
- `search(options)` - Search across multiple entity types
- `matchesModel()` - Check if model matches query
- `matchesDataset()` - Check if dataset matches query
- `matchesEvaluation()` - Check if evaluation matches query

**Usage Example:**
```typescript
import { globalSearchService } from '@/lib/global-search';

const results = await globalSearchService.search({
  query: 'classifier',
  includeModels: true,
  includeDatasets: true,
  limit: 5
});
```

## Implementation Guide

### Adding Search to a New Page

1. **Import the hook:**
```typescript
import { useSearch } from '@/hooks/use-search';
import SearchBar from '@/components/SearchBar';
```

2. **Initialize the search hook:**
```typescript
const {
  searchQuery,
  setSearchQuery,
  setFilter,
  filteredItems,
  resultCount
} = useSearch({
  items: yourData,
  searchFields: ['field1', 'field2', 'field3'],
  sortByRelevance: true
});
```

3. **Add the SearchBar component:**
```tsx
<SearchBar
  placeholder="Search..."
  value={searchQuery}
  onChange={setSearchQuery}
  filterOptions={yourFilterOptions}
  onFilterChange={(value) => setFilter('fieldName', value)}
/>
```

4. **Use filtered results:**
```tsx
{filteredItems.map(item => (
  <div key={item.id}>{item.name}</div>
))}
```

## Current Implementations

### 1. ModelRegistry Page
- **File:** `src/pages/ModelRegistry.tsx`
- **Search Fields:** name, description, framework, model_type, production_version
- **Features:** Search + Type filter, relevance sorting
- **Component:** Uses `useSearch` hook + `SearchBar` component

### 2. Global Navbar Search
- **File:** `src/components/Navbar.tsx`
- **Search Scope:** Models, Datasets
- **Features:** Keyboard shortcut (Ctrl+K), Command dialog, Quick navigation
- **Service:** Uses `GlobalSearchService`

## Benefits

1. **Reusability:** Write once, use everywhere
2. **Consistency:** Same search behavior across the app
3. **Maintainability:** Fix bugs in one place
4. **Performance:** Memoized results, debounced API calls
5. **Type Safety:** Full TypeScript support
6. **Testability:** Easy to unit test

## Performance Optimizations

1. **Debouncing:** 300ms delay to avoid excessive API calls
2. **Memoization:** Results are cached until dependencies change
3. **Lazy Loading:** Only fetch when needed
4. **Relevance Sorting:** Exact matches prioritized over partial matches

## Future Enhancements

1. **Fuzzy Search:** Add fuzzy matching for typos
2. **Search History:** Remember recent searches
3. **Advanced Filters:** Date ranges, numeric ranges
4. **Search Analytics:** Track popular searches
5. **Elasticsearch Integration:** For large datasets
6. **Voice Search:** Speech-to-text search input

## Testing

Example test for search utility:
```typescript
import { searchItems } from '@/lib/search';

describe('searchItems', () => {
  it('should find items matching query', () => {
    const items = [
      { id: '1', name: 'PyTorch Model', description: 'CNN' },
      { id: '2', name: 'TensorFlow Model', description: 'RNN' }
    ];
    
    const results = searchItems(items, 'pytorch', ['name']);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('PyTorch Model');
  });
});
```

## Troubleshooting

### Search not working
1. Check if items array is populated
2. Verify search fields exist on items
3. Check browser console for errors

### Slow performance
1. Reduce debounce delay if needed
2. Limit number of search fields
3. Consider server-side search for large datasets

### Type errors
1. Ensure items extend `SearchableItem` interface
2. Check search fields are valid keys of item type
