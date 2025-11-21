# 🎯 Insights Page: Dataset & Model Analysis Feature

## Overview

The Insights page now supports **TWO modes of analysis**:

1. **Dataset Insights** - Analyze data quality, outliers, correlations
2. **Model Evaluation Insights** - Analyze model performance metrics

Both modes feature a **context-aware AI chatbot** that provides personalized advice based on YOUR specific data or model.

---

## 🚀 What Was Added

### 1. **Dual-Mode Insights Page**

**Location**: `src/pages/Insights.tsx`

#### Features Added:
- ✅ Tab navigation to switch between Dataset and Model analysis
- ✅ Model selection dropdown with evaluation status
- ✅ Model evaluation metrics display (Accuracy, Precision, Recall, F1, MAE, MSE, RMSE, R²)
- ✅ EvalScore visualization with progress bar
- ✅ Model performance summary card
- ✅ Conditional rendering based on insight type

#### UI Components:
```typescript
<Tabs value={insightType} onValueChange={setInsightType}>
  <TabsList>
    <TabsTrigger value="dataset">Dataset Insights</TabsTrigger>
    <TabsTrigger value="model">Model Evaluation</TabsTrigger>
  </TabsList>
</Tabs>
```

---

### 2. **Enhanced InsightsAIChat Component**

**Location**: `src/components/InsightsAIChat.tsx`

#### New Features:
- ✅ Accepts `insightType` prop ("dataset" | "model")
- ✅ Dynamic welcome messages based on mode
- ✅ Context-aware quick questions
- ✅ Separate system prompts for dataset vs model analysis
- ✅ Model metrics integration

#### New Props:
```typescript
interface InsightsAIChatProps {
  // Existing dataset props
  datasetName?: string;
  qualityScore?: number;
  outlierCount?: number;
  correlationCount?: number;
  issues?: string[];
  summary?: string;
  
  // NEW: Model evaluation props
  insightType?: "dataset" | "model";
  modelName?: string;
  modelType?: string;
  modelFramework?: string;
  evalScore?: number;
  modelMetrics?: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
    mae?: number;
    mse?: number;
    rmse?: number;
    r2_score?: number;
  };
}
```

#### Context Building:
- **Dataset Mode**: Sends data quality metrics
- **Model Mode**: Sends model performance metrics

---

### 3. **Updated Edge Function (ai-mentor)**

**Location**: `supabase/functions/ai-mentor/index.ts`

#### Enhancements:
- ✅ Detects `insightType` from context
- ✅ Three distinct system prompts:
  1. **Model Evaluation Mode** - Analyzes specific model performance
  2. **Dataset Quality Mode** - Analyzes specific dataset quality
  3. **General Mode** - ML/DL educational assistant

#### Model Evaluation System Prompt:
```typescript
if (context?.page === 'insights' && context?.insightType === 'model') {
  systemPrompt = `You are a Context-Aware Model Evaluation Expert...`;
  // Includes: model name, type, framework, dataset, evalScore, metrics
}
```

---

## 📊 How It Works

### Dataset Insights Mode

1. User selects a dataset
2. Page fetches data quality metrics (quality score, outliers, correlations)
3. Displays:
   - Data Quality Radar (Completeness, Validity, Uniqueness, Consistency)
   - Feature Correlations
   - Outliers Detected
   - AI Summary
4. AI Chatbot has access to:
   - Dataset name
   - Quality score
   - Outlier count
   - Correlation count
   - Specific issues
   - AI-generated summary

### Model Evaluation Mode

1. User switches to "Model Evaluation" tab
2. User selects a model
3. Page fetches model evaluation results for selected dataset
4. Displays:
   - EvalScore (0-100)
   - Performance metrics (Accuracy, Precision, Recall, F1, etc.)
   - Model metadata (name, type, framework)
   - Performance summary
5. AI Chatbot has access to:
   - Model name, type, framework
   - Dataset name
   - EvalScore
   - All performance metrics

---

## 🎨 UI/UX Changes

### Tabs
```tsx
Dataset Insights | Model Evaluation
    [Active]            [Inactive]
```

### Model Selection (Model Mode)
```tsx
Select a model to analyze
  ┌─────────────────────────┐
  │ 🧠 BERT Classifier      │ ✓ Evaluated
  │ 🧠 Random Forest        │ ✓ Evaluated
  │ 🧠 Logistic Regression  │
  └─────────────────────────┘
```

### Metrics Display
```
EvalScore: 87.5/100
████████████████████░░░░░░░

Performance Metrics:
  Accuracy:  94.20%  ████████████████████
  Precision: 92.10%  ██████████████████░░
  Recall:    89.50%  █████████████████░░░
  F1 Score:  90.75%  ██████████████████░░
```

### AI Chat Badge
- Dataset Mode: `Analyzing YOUR Data`
- Model Mode: `Analyzing YOUR Model`

---

## 🤖 AI Chatbot Quick Questions

### Dataset Mode:
- "What are MY main quality issues?"
- "Should I remove outliers in MY data?"
- "Is MY dataset ready for modeling?"
- "How can I improve MY data quality?"
- "What do MY correlations mean?"

### Model Mode:
- "What are MY model's strongest metrics?"
- "Where is MY model underperforming?"
- "How can I improve MY model's accuracy?"
- "Is MY model overfitting or underfitting?"
- "What features impact MY predictions most?"

---

## 🔌 API Integration

### Endpoints Used:

1. **List Models**
   ```
   GET /api/models/
   ```
   Returns: `{ models: ModelData[] }`

2. **Get Evaluation History**
   ```
   GET /api/evaluation/history
   ```
   Returns: `{ evaluations: Evaluation[] }`

3. **AI Mentor Edge Function**
   ```
   POST https://[project].supabase.co/functions/v1/ai-mentor
   Body: {
     messages: Message[],
     context: {
       page: "insights",
       insightType: "model" | "dataset",
       modelInfo?: { ... },
       datasetInfo?: { ... }
     }
   }
   ```

---

## 📦 Data Flow

### Model Analysis Flow:
```
1. User selects Model tab
   ↓
2. Fetch available models (listModels())
   ↓
3. User selects a model
   ↓
4. Fetch evaluation for model+dataset combo
   ↓
5. Display metrics & EvalScore
   ↓
6. AI Chatbot receives model context
   ↓
7. User asks model-specific questions
   ↓
8. Edge Function analyzes with model metrics
   ↓
9. AI provides personalized model advice
```

---

## 🎯 Example Interactions

### Dataset Mode Example:
**User**: "What are MY main quality issues?"

**AI**: "Based on your dataset analysis:
- Your completeness is 87.3% (below the 95% threshold) - you have 245 missing values
- 3 features have outliers affecting 12% of your data
- Strong correlation (0.87) between Age and Income suggests potential multicollinearity

I recommend:
1. Impute missing values using median for numeric features
2. Review outliers in 'Salary' column before removal
3. Consider removing one of the correlated features"

### Model Mode Example:
**User**: "What are MY model's strongest metrics?"

**AI**: "Your BERT Classifier shows strong performance in these areas:
- **Accuracy: 94.20%** - Excellent overall correctness
- **F1 Score: 90.75%** - Great balance between precision and recall
- **EvalScore: 87.5/100** - Above-average performance

Your model's strongest point is **high accuracy**, meaning it correctly classifies 94.2% of cases. The F1 score of 90.75% indicates good balance - your model doesn't favor precision over recall or vice versa.

However, note that **recall (89.50%)** is slightly lower than precision (92.10%), meaning your model occasionally misses positive cases. This might be acceptable depending on your use case."

---

## 🔧 Technical Details

### State Management:
```typescript
const [insightType, setInsightType] = useState<"dataset" | "model">("dataset");
const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
const [modelEvaluation, setModelEvaluation] = useState<Evaluation | null>(null);
```

### Conditional Rendering:
```typescript
{insightType === "dataset" && (
  <DataQualityCard />
)}

{insightType === "model" && (
  <ModelEvaluationCard />
)}
```

### Context Passing:
```typescript
<InsightsAIChat
  insightType={insightType}
  // Dataset props when insightType === "dataset"
  datasetName={...}
  qualityScore={...}
  // Model props when insightType === "model"
  modelName={...}
  evalScore={...}
  modelMetrics={...}
/>
```

---

## 🚀 Deployment Instructions

### 1. Redeploy Edge Function

The Edge Function has been updated to handle model evaluation context.

**Steps:**
1. Go to https://supabase.com/dashboard/project/pohjbwazayfoynpbgfpn/functions
2. Click "ai-mentor" function
3. Click "Edit"
4. Copy ALL code from `supabase/functions/ai-mentor/index.ts`
5. Paste and click "Deploy"
6. Wait 10-30 seconds for deployment

### 2. Test Dataset Mode

1. Open EvalModel application
2. Go to Insights page
3. Select "Dataset Insights" tab
4. Select a dataset
5. Click sparkle button (AI chat)
6. Ask: "What are MY main quality issues?"
7. Verify AI references YOUR specific dataset metrics

### 3. Test Model Mode

1. Switch to "Model Evaluation" tab
2. Select a model from dropdown
3. Ensure model has been evaluated with selected dataset
4. Verify metrics display (Accuracy, Precision, Recall, etc.)
5. Click sparkle button (AI chat)
6. Ask: "What are MY model's strongest metrics?"
7. Verify AI references YOUR specific model performance

---

## 🎨 Visual Differences

### Dataset Mode:
- Shows: Data Quality Radar, Feature Correlations, Outliers
- AI Badge: "Analyzing YOUR Data"
- Quick Questions: Data quality focused

### Model Mode:
- Shows: Model Evaluation Metrics, EvalScore, Performance Summary
- AI Badge: "Analyzing YOUR Model"
- Quick Questions: Model performance focused

---

## 🔮 Future Enhancements

### Potential additions:
1. **Side-by-side comparison** - Compare multiple models
2. **Confusion matrix** - Visual representation of classification errors
3. **Feature importance** - Which features impact predictions most
4. **Learning curves** - Training vs validation performance over time
5. **ROC/AUC curves** - Classification threshold analysis
6. **Prediction samples** - View individual predictions with explanations

---

## 📋 Summary

### What Changed:
- ✅ Added Model Evaluation tab to Insights page
- ✅ Added model selection and metrics display
- ✅ Enhanced AI chatbot to handle both dataset and model contexts
- ✅ Updated Edge Function with model evaluation system prompt
- ✅ Dynamic quick questions based on mode
- ✅ Conditional rendering based on insight type

### Files Modified:
1. `src/pages/Insights.tsx` - Added tabs, model state, evaluation fetching
2. `src/components/InsightsAIChat.tsx` - Added model props, dynamic prompts
3. `supabase/functions/ai-mentor/index.ts` - Added model evaluation mode

### User Benefits:
- 🎯 **One place** for both data and model analysis
- 🤖 **Context-aware AI** that knows YOUR specific data and models
- 📊 **Actionable insights** for improving both data quality and model performance
- 🔄 **Easy switching** between dataset and model analysis

---

## 🎉 Result

Users now have a **comprehensive Insights page** that provides:
1. Deep dataset quality analysis
2. Detailed model performance evaluation
3. Context-aware AI assistant for both modes
4. Personalized recommendations based on actual metrics

The AI chatbot is truly **context-aware** - it knows YOUR specific dataset quality issues AND YOUR specific model performance metrics, providing targeted, actionable advice.

---

**Created**: 2025-01-05  
**Feature**: Insights Page Model Evaluation  
**Status**: Complete, Ready for Testing
