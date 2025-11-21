# Fairness Feature - Key Mapping Verification

## ✅ Key Mappings Verified

### 1. Backend Service → Database (Python → PostgreSQL)

**fairness.py returns:**
```python
{
    'fairness_metrics': {
        'demographic_parity_difference': float,
        'equal_opportunity_difference': float,
        'disparate_impact_ratio': float,
        'statistical_parity': float,
        'predictive_parity': float,
        'equalized_odds_difference': float,
        'overall_fairness_score': float
    },
    'group_metrics': [
        {
            'group': str,
            'sample_count': int,
            'accuracy': float,
            'precision': float,
            'recall': float,
            'f1_score': float,
            'true_positive_rate': float,
            'false_positive_rate': float,
            'positive_prediction_rate': float,
            'true_positives': int,
            'false_positives': int,
            'true_negatives': int,
            'false_negatives': int
        }
    ],
    'sensitive_attribute': str,
    'num_groups': int,
    'analysis_successful': bool
}
```

**evaluation.py saves to database:**
```python
eval_data = {
    "fairness_metrics": fairness_result.get("fairness_metrics"),  # JSONB
    "group_metrics": fairness_result.get("group_metrics"),        # JSONB array
    "sensitive_attribute": fairness_result.get("sensitive_attribute")  # TEXT
}
```

### 2. Database → Frontend (PostgreSQL → TypeScript)

**Supabase Query:**
```typescript
.select(`
  *,
  models:model_id(name),
  datasets:dataset_id(name)
`)
```

**Frontend Interfaces:**
```typescript
interface FairnessMetrics {
  demographic_parity_difference: number;
  equal_opportunity_difference: number;
  disparate_impact_ratio: number;
  statistical_parity: number;
  predictive_parity: number;
  equalized_odds_difference: number;
  overall_fairness_score: number;
}

interface GroupMetrics {
  group: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  true_positive_rate: number;
  false_positive_rate: number;
  positive_prediction_rate: number;
  sample_count: number;
}

interface Evaluation {
  id: string;
  model_id: string;
  dataset_id: string;
  model_type: string;
  meta_score: number;
  fairness_metrics?: FairnessMetrics;
  group_metrics?: GroupMetrics[];
  sensitive_attribute?: string;
  created_at: string;
  models?: {
    name: string;
  };
  datasets?: {
    name: string;
  };
}
```

## 🔑 Key Fixes Applied

### Issue 1: Model/Dataset Names
**Problem:** Frontend expected `model_name` and `dataset_name` directly on evaluation
**Solution:** Added JOIN query to fetch related model and dataset names
```typescript
// Before (WRONG):
model_name: string;
dataset_name: string;

// After (CORRECT):
models?: { name: string };
datasets?: { name: string };

// Usage:
evalItem.models?.name || 'Unknown Model'
evalItem.datasets?.name || 'Unknown Dataset'
```

### Issue 2: Unused Import
**Problem:** Imported `Database` type but not using it
**Solution:** Removed unused import

## 🎯 Data Flow Verification

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User runs evaluation with dataset containing sensitive  │
│    attribute (e.g., gender, race, age_group)               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Backend: evaluation.py detects sensitive attribute      │
│    - Looks for: gender, race, sex, age_group, ethnicity    │
│    - Falls back to categorical columns with few values     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Backend: fairness_engine.analyze_fairness()             │
│    - Computes 6 fairness metrics                           │
│    - Analyzes performance by demographic group             │
│    - Calculates overall fairness score                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Backend: Saves to database (evaluations table)          │
│    - fairness_metrics: JSONB                               │
│    - group_metrics: JSONB array                            │
│    - sensitive_attribute: TEXT                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Frontend: Fairness.tsx loads evaluations                │
│    - JOINs models and datasets tables for names            │
│    - Filters for evaluations with fairness_metrics         │
│    - Auto-selects most recent                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Frontend: Displays fairness analysis                    │
│    - Overall score with color coding                       │
│    - Fairness metrics charts                               │
│    - Group comparison visualizations                       │
│    - Actionable recommendations                            │
└─────────────────────────────────────────────────────────────┘
```

## ✅ All Keys Correctly Mapped

### Fairness Metrics Keys (Match 100%)
- ✅ demographic_parity_difference
- ✅ equal_opportunity_difference
- ✅ disparate_impact_ratio
- ✅ statistical_parity
- ✅ predictive_parity
- ✅ equalized_odds_difference
- ✅ overall_fairness_score

### Group Metrics Keys (Match 100%)
- ✅ group
- ✅ accuracy
- ✅ precision
- ✅ recall
- ✅ f1_score
- ✅ true_positive_rate
- ✅ false_positive_rate
- ✅ positive_prediction_rate
- ✅ sample_count

### Additional Backend Keys (Used Internally)
- true_positives
- false_positives
- true_negatives
- false_negatives
(These are computed but not displayed in frontend, available if needed)

### Evaluation Keys (Match 100%)
- ✅ id
- ✅ model_id
- ✅ dataset_id
- ✅ fairness_metrics
- ✅ group_metrics
- ✅ sensitive_attribute
- ✅ created_at
- ✅ models.name (via JOIN)
- ✅ datasets.name (via JOIN)

## 🎨 Chart Data Transformations

### Bar Chart (Fairness Metrics)
```typescript
metricsChartData = Object.entries(fairnessMetrics)
  .filter(([key]) => key !== 'overall_fairness_score')
  .map(([key, value]) => ({
    name: formatMetricName(key),      // "Demographic Parity Difference"
    value: Math.abs(value),            // Absolute value for visualization
    rawValue: value,                   // Original value for tooltip
    interpretation: getMetricInterpretation(key, value)  // Fair/Moderate/Biased
  }))
```

### Line Chart (Group Comparison)
```typescript
groupComparisonData = groupMetrics.map(group => ({
  group: group.group,
  accuracy: group.accuracy * 100,    // Convert to percentage
  precision: group.precision * 100,
  recall: group.recall * 100,
  f1_score: group.f1_score * 100,
}))
```

### Radar Chart (Multi-Metric View)
```typescript
radarData = groupMetrics.map(group => ({
  metric: group.group,               // Group name as axis
  Accuracy: group.accuracy * 100,
  Precision: group.precision * 100,
  Recall: group.recall * 100,
  'F1 Score': group.f1_score * 100,
}))
```

## 🔍 Type Safety

All interfaces are strongly typed with TypeScript:
- ✅ No `any` types in production code
- ✅ Optional chaining for nullable fields (`?.`)
- ✅ Fallback values for undefined data
- ✅ Type guards for data validation

## 📋 Testing Checklist

Use this to verify key mappings:

- [ ] Database migration adds all 3 columns
- [ ] Backend returns fairness_metrics as object (not null)
- [ ] Backend returns group_metrics as array (not null)
- [ ] Backend saves sensitive_attribute name correctly
- [ ] Frontend fetches with JOIN for model/dataset names
- [ ] Frontend displays model × dataset in selector
- [ ] Charts receive correct data format
- [ ] All metric keys render without undefined errors
- [ ] Group metrics table displays all columns
- [ ] Overall score calculates correctly (0-1 range)

## 🎉 Status: All Keys Verified ✅

No key mismatches found. The data flow from backend → database → frontend is consistent and type-safe.
