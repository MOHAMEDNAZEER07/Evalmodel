# Fairness Analysis - Setup Instructions

## ✅ What's Been Implemented

### Backend
1. ✅ **Fairness Engine** (`backend/app/services/fairness.py`)
   - Comprehensive fairness metrics computation
   - Support for multiple fairness definitions
   - Group-level performance analysis
   - Overall fairness scoring

2. ✅ **Integration** (`backend/app/routes/evaluation.py`)
   - Automatic sensitive attribute detection
   - Fairness analysis runs during evaluation
   - Results stored in database

3. ✅ **API Schema** (`backend/app/models/schemas.py`)
   - Added fairness_metrics, group_metrics, sensitive_attribute fields

### Frontend
1. ✅ **Fairness Page** (`src/pages/Fairness.tsx`)
   - Overall fairness score with color-coded levels
   - Three tabs: Metrics | Group Comparison | Recommendations
   - Multiple chart types (Bar, Line, Radar)
   - Detailed metrics table
   - Actionable recommendations

2. ✅ **Routing** (`src/App.tsx`)
   - Added /fairness route
   - Integrated with protected routes

### Database
1. ✅ **Migration SQL** (`backend/migrations/add_fairness_fields.sql`)
   - 3 new columns for evaluations table
   - Indexes for performance
   - Ready to run in Supabase

## 🔧 Setup Steps (Do These Now!)

### Step 1: Run Database Migration
**REQUIRED** - Without this, fairness data won't be stored

1. Open your **Supabase Dashboard**
2. Go to **SQL Editor**
3. Copy the contents of `backend/migrations/add_fairness_fields.sql`
4. Paste and click **Run**

Or run this SQL directly:
```sql
ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS fairness_metrics JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS group_metrics JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS sensitive_attribute TEXT;

CREATE INDEX IF NOT EXISTS idx_evaluations_fairness_metrics ON evaluations USING GIN (fairness_metrics);
CREATE INDEX IF NOT EXISTS idx_evaluations_sensitive_attribute ON evaluations (sensitive_attribute) WHERE sensitive_attribute IS NOT NULL;
```

### Step 2: Restart Backend Server
The backend is already running, but restart to ensure new code is loaded:

```powershell
# In the uvicorn terminal, press Ctrl+C to stop, then restart:
cd backend; .\venv\Scripts\Activate.ps1; python -m uvicorn main:app --reload
```

### Step 3: Test with a Dataset
To see fairness analysis in action, you need a dataset with demographic information:

**Option A: Use existing dataset with sensitive attributes**
- Dataset should have columns like: gender, race, sex, age_group, ethnicity

**Option B: Create a test dataset**
Example CSV structure:
```csv
feature1,feature2,gender,target
0.5,1.2,male,1
0.3,0.8,female,0
0.7,1.5,male,1
0.2,0.6,female,1
...
```

### Step 4: Run an Evaluation
1. Upload your model and dataset
2. Go to **Evaluate** page
3. Run evaluation
4. The system will automatically:
   - Detect sensitive attribute (gender, race, etc.)
   - Compute fairness metrics
   - Store results in database

### Step 5: View Fairness Analysis
1. Navigate to **Analytics > Fairness** in sidebar
2. Select an evaluation from dropdown
3. Explore the three tabs:
   - **Fairness Metrics**: See bias indicators
   - **Group Comparison**: Compare performance across groups
   - **Recommendations**: Get actionable advice

## 📊 Fairness Metrics Explained

### Demographic Parity Difference
- Measures difference in positive prediction rates between groups
- **Fair**: ≤ 0.1
- **Goal**: Close to 0

### Equal Opportunity Difference
- Measures difference in true positive rates (recall)
- **Fair**: ≤ 0.1
- **Goal**: Close to 0

### Disparate Impact Ratio
- Ratio of positive prediction rates
- **Fair**: 0.8 - 1.25
- **Goal**: Close to 1.0

### Overall Fairness Score
- Combined score (0-100%)
- **Excellent**: 90%+
- **Good**: 75-90%
- **Fair**: 60-75%
- **Poor**: <60%

## 🎯 Features

### Automatic Detection
- System automatically finds sensitive attributes in your dataset
- Looks for: gender, race, sex, age_group, ethnicity, protected_attribute
- Falls back to categorical columns with few unique values

### Multi-Chart Visualization
- **Bar Chart**: Fairness metrics comparison
- **Line Chart**: Performance trends across groups
- **Radar Chart**: 360° multi-metric view
- **Table**: Detailed group statistics

### Actionable Insights
- Color-coded status indicators (Green/Yellow/Red)
- Specific recommendations per metric
- Best practices for improving fairness
- Resource links

## 🔍 Testing Checklist

- [ ] Database migration executed successfully
- [ ] Backend server restarted and running
- [ ] Dataset with sensitive attribute uploaded
- [ ] Model evaluation completed
- [ ] Fairness page loads without errors
- [ ] Charts render correctly
- [ ] Metrics display proper values
- [ ] Group comparison shows all groups
- [ ] Recommendations appear

## 🐛 Troubleshooting

### "No Fairness Data Available"
**Cause**: No evaluations have fairness metrics yet
**Solution**: 
1. Ensure database migration was run
2. Run a new evaluation with a dataset containing demographic columns
3. Refresh the page

### Fairness Analysis Not Running
**Cause**: No sensitive attribute detected in dataset
**Solution**: Add a column named 'gender', 'race', 'sex', or 'age_group' to your dataset

### Charts Not Rendering
**Cause**: Missing Recharts library or data format issue
**Solution**: 
```powershell
npm install recharts
```

### Backend Error During Evaluation
**Cause**: Fairness service import or analysis error
**Solution**: Check backend logs for specific error message

## 📝 Example Test Dataset

Create `test_fairness.csv`:
```csv
age,income,gender,approved
25,50000,male,1
30,60000,female,1
22,45000,male,0
35,70000,female,1
28,55000,male,1
32,65000,female,0
26,52000,male,1
29,58000,female,1
24,48000,male,0
33,68000,female,1
```

This dataset will trigger fairness analysis on the 'gender' attribute.

## 🎉 Success Criteria

When everything is working, you should see:
1. ✅ Fairness page accessible at `/fairness`
2. ✅ Evaluations with fairness_metrics appearing in dropdown
3. ✅ Overall Fairness Score displayed with color
4. ✅ All three tabs working (Metrics, Groups, Recommendations)
5. ✅ Charts rendering correctly
6. ✅ Group metrics table populated
7. ✅ Status badges showing Fair/Moderate/Biased

## 🚀 Next Steps

After basic setup works:
1. Test with different datasets and model types
2. Experiment with various sensitive attributes
3. Try models with different levels of fairness
4. Use recommendations to improve model fairness
5. Compare fairness across multiple models

---

**Need Help?** Check the logs:
- Backend: Look at uvicorn terminal output
- Frontend: Open browser DevTools Console (F12)
