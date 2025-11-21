# 🤖 AI Assistants Guide - EvalModel

## Two Distinct AI Assistants

Your EvalModel application now has **two specialized AI assistants**, each designed for different purposes:

---

## 1. 🌐 General AI Assistant (Floating Bot Icon)

### Location
- **Bottom-right floating purple/blue bot icon**
- Available on **all pages** across the application

### Purpose
**General ML/DL Knowledge & Learning**
- Educational assistant for Data Science, ML, and DL concepts
- No access to your specific data or models
- Provides general knowledge and best practices

### What It Can Help With
✅ **Machine Learning Concepts**
- Explain algorithms (Random Forest, SVM, Neural Networks, etc.)
- Compare different models
- Discuss when to use which algorithm

✅ **Deep Learning Architectures**
- CNN, RNN, LSTM, Transformers
- Transfer learning
- Model architectures

✅ **Data Science Topics**
- Feature engineering techniques
- Data preprocessing strategies
- Statistical concepts

✅ **Best Practices**
- Model training strategies
- Hyperparameter tuning approaches
- Optimization algorithms (SGD, Adam, etc.)

✅ **Python Libraries**
- scikit-learn usage
- TensorFlow/Keras
- PyTorch

### Example Questions
- "What's the difference between CNN and RNN?"
- "Explain gradient descent optimization"
- "How does transfer learning work?"
- "Compare Random Forest vs XGBoost"
- "What is overfitting and how to prevent it?"

### Key Features
- 💬 Clean, conversational interface
- 📚 Educational focus
- 🎓 Teaching with examples
- 🌍 General knowledge (not dataset-specific)

---

## 2. 🎯 Context-Aware Data Quality Assistant (Insights Page)

### Location
- **Insights Page ONLY**
- Sparkling purple/blue floating button (bottom-right on Insights page)

### Purpose
**Personalized Analysis of YOUR Specific Dataset**
- Has real-time access to YOUR dataset metrics
- Analyzes YOUR specific data quality issues
- Provides PERSONALIZED recommendations

### What It Can Help With
✅ **Your Dataset Quality Issues**
- "What are MY main quality issues?" ← Analyzes YOUR actual data
- "Why is MY quality score 85.5%?" ← References YOUR metrics
- "What's causing low completeness in MY data?"

✅ **Your Specific Outliers**
- "Should I remove outliers in MY data?" ← Based on YOUR outliers
- "Which features have outliers in MY dataset?"
- "How do outliers affect MY model performance?"

✅ **Your Feature Correlations**
- "What do MY correlations mean?" ← Interprets YOUR features
- "Are high correlations a problem in MY data?"
- "Which features are correlated in MY dataset?"

✅ **Personalized Recommendations**
- "How can I improve MY data quality?"
- "Is MY dataset ready for modeling?"
- "What should I fix first in MY data?"

### What It Has Access To
🔍 **Real-Time Dataset Metrics:**
- Your dataset name
- Overall quality score (%)
- Completeness, validity, uniqueness, consistency scores
- Number of outliers and affected features
- Significant correlations count
- Specific issues detected
- AI-generated summary

### Example Interaction

**You ask:** "What are MY main quality issues?"

**Context-Aware Assistant responds:**
"Looking at your dataset 'customer_churn.csv':

Your main issues are:
1. **Completeness: 88%** - You have 12 missing values that need attention
2. **Outliers in 3 features** - This is affecting your overall quality score of 85.5%
3. **Strong correlation** between 'age' and 'tenure' (0.87) - might cause multicollinearity

**Recommended actions:**
1. Handle the 12 missing values (imputation or removal)
2. Review outliers in those 3 features
3. Consider feature engineering to reduce correlation

Your dataset is close to model-ready but needs these fixes first!"

### Key Features
- 🎯 **Dataset-specific insights** - References YOUR actual metrics
- 📊 **Real-time analysis** - Updates as you select different datasets
- 💡 **Actionable advice** - Specific steps for YOUR data
- 🔗 **Context-aware** - Understands your current data quality state

---

## 🔄 How to Use Both Effectively

### Use General AI Assistant When:
- ❓ Learning about ML/DL concepts
- 📖 Understanding algorithms
- 🎓 Getting general best practices
- 🔍 Comparing different approaches
- 📚 Educational questions

### Use Context-Aware Assistant When:
- 🎯 Analyzing YOUR specific dataset
- 🔧 Fixing YOUR data quality issues
- 📊 Understanding YOUR metrics
- 💡 Getting personalized recommendations
- ✅ Checking if YOUR data is ready

---

## 🚀 Technical Implementation

### General AI Assistant
```typescript
// No context sent, general mode
context: {
  page: "dashboard" // or any page except insights
}
```

### Context-Aware Assistant
```typescript
// Rich context sent
context: {
  page: "insights",
  datasetInfo: {
    name: "your_dataset.csv",
    qualityScore: 85.5,
    outlierCount: 3,
    correlationCount: 5,
    issues: ["12 missing values", "Completeness is 88%"],
    summary: "Dataset analysis summary..."
  }
}
```

### Edge Function Logic
The Edge Function (`ai-mentor`) detects `context.page`:
- **If page === 'insights'**: Use dataset-specific system prompt with metrics
- **Otherwise**: Use general ML/DL educational prompt

---

## 📊 Current Status

✅ **Both AI assistants are fully functional**
✅ **Edge Function deployed with Gemini 2.5 Flash**
✅ **Context-aware system prompts implemented**
✅ **Real-time dataset metrics integration**
✅ **Streaming responses working**

---

## 🎯 Next Steps

To ensure both are working:

1. **Redeploy Edge Function** to Supabase with updated code
2. **Test General AI**: Click floating bot icon on any page, ask "What is CNN?"
3. **Test Context-Aware AI**: 
   - Go to Insights page
   - Select a dataset
   - Click sparkle button
   - Ask "What are MY quality issues?"
4. **Verify** the Context-Aware AI references YOUR specific metrics

---

## 🎉 Benefits

### For Learning & Education
The **General AI Assistant** serves as your ML/DL tutor, always available to explain concepts and best practices.

### For Your Projects
The **Context-Aware Assistant** acts as a data quality analyst specifically for YOUR datasets, providing personalized, actionable insights.

**Together, they provide comprehensive AI support for both learning and practical data analysis!** 🚀
