# Fairness Analysis Feature - Database Migration

## Overview
This migration adds fairness analysis capabilities to the evaluation system, allowing detection and measurement of bias across demographic groups.

## New Fields Added to `evaluations` Table

1. **fairness_metrics** (JSONB)
   - Stores computed fairness metrics including:
     - demographic_parity_difference
     - equal_opportunity_difference
     - disparate_impact_ratio
     - statistical_parity
     - predictive_parity
     - equalized_odds_difference
     - overall_fairness_score

2. **group_metrics** (JSONB Array)
   - Performance metrics broken down by demographic groups
   - Each group includes: accuracy, precision, recall, F1, TPR, FPR, sample counts

3. **sensitive_attribute** (TEXT)
   - Name of the sensitive feature used for fairness analysis
   - Examples: 'gender', 'race', 'age_group'

## How to Run the Migration

### Option 1: Supabase Dashboard (Recommended)
1. Log into your Supabase dashboard
2. Navigate to **SQL Editor**
3. Open `backend/migrations/add_fairness_fields.sql`
4. Copy and paste the SQL content
5. Click **Run** to execute

### Option 2: Supabase CLI
```bash
# If you have Supabase CLI installed
supabase db push
```

## Verification

After running the migration, verify the columns were added:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'evaluations' 
AND column_name IN ('fairness_metrics', 'group_metrics', 'sensitive_attribute');
```

Expected output:
```
column_name          | data_type
---------------------|----------
fairness_metrics     | jsonb
group_metrics        | jsonb
sensitive_attribute  | text
```

## How It Works

1. **Automatic Detection**: When you run an evaluation, the system automatically:
   - Looks for common sensitive attribute columns (gender, race, sex, age_group, etc.)
   - Falls back to categorical columns with few unique values
   - Runs fairness analysis if a sensitive attribute is found

2. **Fairness Metrics**: Computes multiple standard fairness metrics:
   - **Demographic Parity**: Equal positive prediction rates across groups
   - **Equal Opportunity**: Equal true positive rates across groups
   - **Disparate Impact**: Ratio of positive rates (should be 0.8-1.25)
   - **Equalized Odds**: Equal TPR and FPR across groups

3. **Group Comparison**: Breaks down all performance metrics by demographic group:
   - Accuracy, Precision, Recall, F1 Score
   - True Positive Rate, False Positive Rate
   - Sample counts per group

4. **Overall Score**: Combines all metrics into a single fairness score (0-1):
   - 0.9+ : Excellent fairness
   - 0.75-0.9: Good fairness
   - 0.6-0.75: Fair
   - <0.6: Poor (action needed)

## Usage Example

After migration, when you evaluate a model with a dataset containing demographic information:

```python
# The system automatically detects sensitive attributes and runs fairness analysis
# No additional configuration needed!

# Results will include:
{
  "fairness_metrics": {
    "demographic_parity_difference": 0.05,
    "equal_opportunity_difference": 0.03,
    "disparate_impact_ratio": 0.95,
    "overall_fairness_score": 0.87
  },
  "group_metrics": [
    {
      "group": "male",
      "accuracy": 0.85,
      "precision": 0.83,
      "sample_count": 500
    },
    {
      "group": "female",
      "accuracy": 0.83,
      "precision": 0.81,
      "sample_count": 480
    }
  ],
  "sensitive_attribute": "gender"
}
```

## Frontend Access

The Fairness page (`/fairness`) will automatically display:
- Overall fairness score with visual indicator
- Detailed fairness metrics breakdown
- Group comparison charts (bar, line, radar)
- Actionable recommendations for improving fairness

## Notes

- Fairness analysis only runs for **classification** models
- Requires at least **2 demographic groups** in the test set
- If no sensitive attribute is detected, fairness analysis is skipped
- Old evaluations won't have fairness data (only new evaluations after migration)

## Rollback (if needed)

To remove the fairness fields:

```sql
ALTER TABLE evaluations
DROP COLUMN IF EXISTS fairness_metrics,
DROP COLUMN IF EXISTS group_metrics,
DROP COLUMN IF EXISTS sensitive_attribute;

DROP INDEX IF EXISTS idx_evaluations_fairness_metrics;
DROP INDEX IF EXISTS idx_evaluations_sensitive_attribute;
```
