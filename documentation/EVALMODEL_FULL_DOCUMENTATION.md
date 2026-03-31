# EvalModel — Complete Platform Documentation

**Universal AI Model Evaluation Platform with Hybrid Trust Framework**

> A research-grade, framework-agnostic model evaluation system that goes beyond traditional metrics to deliver trust-aware, fairness-audited, and explainable model assessments.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [UI Navigation & Page Guide](#4-ui-navigation--page-guide)
5. [Core Methodology: SMCP Pipeline](#5-core-methodology-smcp-pipeline)
6. [Hybrid Trust Framework (MetaEvaluator)](#6-hybrid-trust-framework-metaevaluator)
7. [Fairness Analysis Engine](#7-fairness-analysis-engine)
8. [Explainability Engine](#8-explainability-engine)
9. [Insights AI Chat](#9-insights-ai-chat)
10. [Authentication & Authorization](#10-authentication--authorization)
11. [Database Schema](#11-database-schema)
12. [API Reference](#12-api-reference)
13. [Supported Model Formats & Frameworks](#13-supported-model-formats--frameworks)
14. [Evaluation Metrics Reference](#14-evaluation-metrics-reference)
15. [EvalScore Calculation](#15-evalscore-calculation)
16. [Search System](#16-search-system)
17. [User Workflow: End-to-End](#17-user-workflow-end-to-end)
18. [Configuration & Environment Variables](#18-configuration--environment-variables)
19. [Deployment Architecture](#19-deployment-architecture)
20. [Glossary](#20-glossary)

---

## 1. Platform Overview

### What is EvalModel?

EvalModel is a **universal AI model evaluation platform** designed to solve the fundamental problem of comparing machine learning models across different domains, frameworks, and metric systems. It provides:

- **Unified EvalScore (0–100)** — A single number that lets you compare a classification model against a regression model objectively
- **Hybrid Trust Framework** — A 10-step mathematical pipeline that computes trust scores, data instability indices, and non-compensatory safety guards
- **Fairness Auditing** — Automatic bias detection across sensitive attributes (gender, race, age, etc.)
- **Explainability** — SHAP and LIME integration for understanding *why* models make predictions
- **AI-Powered Insights** — A context-aware AI chat that analyzes YOUR specific model's results and gives actionable recommendations

### Who is it for?

| User Type | Use Case |
|-----------|----------|
| **ML Researchers** | Standardized evaluation for papers, reproducible benchmarks |
| **Data Scientists** | Quick model comparison, bias detection, deployment readiness |
| **ML Engineers** | Production model monitoring, version comparison, trust assessment |
| **Students & Educators** | Understanding evaluation metrics, learning model assessment |
| **Non-Technical Stakeholders** | Single EvalScore to understand model quality without ML expertise |

### Key Differentiators

1. **Framework-Agnostic** — Upload scikit-learn, PyTorch, TensorFlow, Keras, or ONNX models
2. **Domain-Independent** — Classification, regression, NLP, and computer vision all produce comparable scores
3. **Trust-Aware** — Goes beyond accuracy to assess data quality, fairness, and robustness
4. **Non-Compensatory Guards** — A high-accuracy model with terrible fairness gets flagged, not hidden
5. **Full Transparency** — Every calculation is shown step-by-step with mathematical formulas

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ Dashboard │ │  Upload  │ │ Evaluate │ │    Compare    │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ Insights │ │ Fairness │ │Explainab.│ │   Registry    │  │
│  │ + AI Chat│ │          │ │          │ │               │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP/REST (JSON)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (FastAPI + Python)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │   Auth   │ │  Models  │ │ Datasets │ │  Evaluation   │  │
│  │  Routes  │ │  Routes  │ │  Routes  │ │    Routes     │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────┬───────┘  │
│                                                  │          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  SERVICE LAYER                        │   │
│  │  ┌────────────┐ ┌────────────────┐ ┌──────────────┐  │  │
│  │  │SMCP Engine │ │ MetaEvaluator  │ │  Explainab.  │  │  │
│  │  │(EvalScore) │ │(Trust Framework)│ │   Engine    │  │  │
│  │  └────────────┘ └────────────────┘ └──────────────┘  │  │
│  │  ┌────────────┐ ┌────────────────┐                   │  │
│  │  │  Fairness  │ │   Insights     │                   │  │
│  │  │   Engine   │ │    Engine      │                   │  │
│  │  └────────────┘ └────────────────┘                   │  │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │ Supabase Client SDK
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  INFRASTRUCTURE (Supabase)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  PostgreSQL   │  │   Storage    │  │    Auth (GoTrue)  │ │
│  │  + RLS        │  │   Buckets    │  │    JWT + OAuth    │ │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Edge Functions (AI Mentor Chat)               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Summary

1. **User uploads** model (.pkl, .onnx, .pt, .h5) + dataset (.csv) via frontend
2. **Files stored** in Supabase Storage buckets; metadata in PostgreSQL
3. **User triggers evaluation** → backend downloads files → runs SMCP pipeline
4. **SMCP computes** raw metrics → normalizes → produces EvalScore
5. **MetaEvaluator** computes trust score, DII, component scores, guard checks
6. **Fairness Engine** detects sensitive attributes, computes bias metrics
7. **Explainability Engine** runs SHAP/LIME for feature importance
8. **Results persisted** to `evaluations` table with all computed fields
9. **Frontend renders** 6 research-grade dashboard panels
10. **AI Chat** uses all stored data to answer questions about the model

---

## 3. Technology Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| **React 18.3** | Component-based UI framework |
| **TypeScript 5.8** | Static type safety |
| **Vite** | Build tool + dev server with HMR |
| **Tailwind CSS** | Utility-first responsive styling |
| **shadcn/ui** | 49+ accessible UI component primitives |
| **Recharts** | Interactive charts (radar, bar, line, area) |
| **React Router** | Client-side routing |
| **React Query** | Server state management + caching |
| **Lucide React** | Icon library |
| **Sonner** | Toast notification system |

### Backend

| Technology | Purpose |
|------------|---------|
| **Python 3.10+** | Core language |
| **FastAPI 0.115** | Async REST API framework |
| **Pydantic** | Request/response validation |
| **scikit-learn** | Traditional ML model loading + metrics |
| **PyTorch** | Deep learning model support |
| **TensorFlow/Keras** | Neural network model support |
| **ONNX Runtime** | Framework-agnostic model inference |
| **SHAP** | SHapley Additive exPlanations |
| **LIME** | Local Interpretable Model-agnostic Explanations |
| **pandas / numpy** | Data manipulation |
| **Uvicorn** | ASGI server |
| **supabase-py** | Supabase client SDK |

### Infrastructure

| Technology | Purpose |
|------------|---------|
| **Supabase** | Backend-as-a-Service |
| **PostgreSQL 15** | Database with Row-Level Security |
| **Supabase Storage** | Object storage for models & datasets |
| **Supabase Auth (GoTrue)** | JWT authentication + OAuth |
| **Supabase Edge Functions** | Serverless AI chat (Deno runtime) |

---

## 4. UI Navigation & Page Guide

### Navigation Structure

EvalModel uses a **sidebar + top navbar** layout. The sidebar is always visible on desktop and collapses on mobile.

```
┌──────────────────────────────────────────────────┐
│  Navbar [Logo] [Search Ctrl+K] [User Menu]       │
├──────────┬───────────────────────────────────────┤
│ Sidebar  │                                       │
│          │          Main Content Area             │
│ Dashboard│                                       │
│ Upload   │   (Changes based on active route)     │
│ Evaluate │                                       │
│ Compare  │                                       │
│ Insights │                                       │
│ ──────── │                                       │
│ Analytics│                                       │
│  Explain.│                                       │
│  Fairness│                                       │
│ ──────── │                                       │
│ Registry │                                       │
│ Settings │                                       │
│          │                                       │
│          │              [AI Mentor Floating Btn]  │
└──────────┴───────────────────────────────────────┘
```

### Page-by-Page Guide

---

#### 4.1 Login & Signup (`/login`, `/signup`)

**What it does:** User authentication.

**UI Elements:**
- Email and password form fields
- "Create Account" / "Sign In" button
- Link to toggle between login and signup
- Error messages for invalid credentials

**Flow:**
1. User enters email + password
2. Frontend calls backend `/api/auth/login` or `/api/auth/signup`
3. Backend validates with Supabase Auth
4. JWT tokens returned and stored in localStorage
5. User redirected to Dashboard

---

#### 4.2 Dashboard (`/`)

**What it does:** Overview of the user's ML workspace — model count, evaluation history, recent activity.

**UI Elements:**
- **Stats cards**: Total Models, Total Datasets, Total Evaluations, Recent Activity (last 7 days)
- **Recent evaluations table**: Model name, dataset, EvalScore, date
- **Quick action buttons**: Upload Model, New Evaluation

**Data Source:** `apiClient.getEvaluationHistory()`, `apiClient.listModels()`, `apiClient.listDatasets()`

---

#### 4.3 Upload (`/upload`)

**What it does:** Upload ML models and datasets to the platform.

**UI Elements:**
- **Tab switcher**: Model Upload | Dataset Upload
- **Drag-and-drop zone**: File area with supported format hints
- **Model metadata form**:
  - Name (text input)
  - Description (textarea)
  - Model Type: Classification / Regression / NLP / Computer Vision (dropdown)
  - Framework: scikit-learn / PyTorch / TensorFlow / Keras / ONNX (dropdown)
- **Dataset metadata form**:
  - Name (text input)
  - Description (textarea)
- **Progress bar**: Shows upload percentage
- **File validation**: Checks extension, size limit

**Supported Formats:**
| Category | Extensions |
|----------|------------|
| Models | `.pkl`, `.joblib`, `.pt`, `.pth`, `.h5`, `.keras`, `.onnx` |
| Datasets | `.csv` |

**Flow:**
1. User selects tab (Model or Dataset)
2. Drags file or clicks to browse
3. Fills in metadata
4. Clicks "Upload"
5. Frontend sends multipart form to backend
6. Backend validates → stores file in Supabase Storage → saves metadata to PostgreSQL
7. Toast notification confirms success

---

#### 4.4 Evaluate (`/evaluate`)

**What it does:** The core page — runs the full SMCP + MetaEvaluator pipeline on a model-dataset pair and displays research-grade results.

**UI Elements (Top Section):**
- **Model dropdown**: Select from uploaded models (shows name + framework badge)
- **Dataset dropdown**: Select from uploaded datasets (shows name + row count)
- **Sensitive Attribute input** (optional): Specify which column to use for fairness analysis
- **"Evaluate Model" button**: Triggers the full pipeline
- **Loading spinner**: Shows during evaluation (typically 2–10 seconds)

**UI Elements (Results — 6 Panels):**

**Panel 1: Trust Overview (`TrustOverviewPanel`)**
- Large trust score gauge (0–100) with color coding:
  - 🟢 ≥ 70: High Trust
  - 🟡 50–69: Moderate Trust
  - 🔴 < 50: Low Trust / Untrusted
- EvalScore display
- Meta verdict badge (e.g., "High Trust", "Conditional Trust", "High Risk")
- DII (Data Instability Index) indicator
- Dataset health score bar

**Panel 2: Component Breakdown (`ComponentBreakdownPanel`)**
- Four component scores displayed as progress bars:
  - **P (Performance)**: Model accuracy/quality score [0, 1]
  - **H (Health)**: Dataset health = 1 − DII [0, 1]
  - **F (Fairness)**: 1 − Demographic Parity [0, 1]
  - **R (Robustness)**: 1 − train/test gap [0, 1]
- Color-coded status badges per component
- Hybrid weight (λ) for each component showing how much influence each has

**Panel 3: Calculation Transparency (`CalculationTransparencyPanel`)**
- Step-by-step mathematical formulas:
  - Risk calculation: `r_i = 1 − score_i`
  - Automatic weights: `β_auto_i = r_i / Σr`
  - Lambda (λ) derivation from DII
  - Hybrid weights: `β_i = λ · β_auto_i + (1−λ) · user_w_i`
  - Final trust score: `T = 100 × Σ(β_i · score_i)`
- Actual numeric values shown at each step
- Guard threshold display

**Panel 4: Mode Comparison (`ModeComparisonPanel`)**
- Side-by-side comparison of **Balanced** vs **Strict** evaluation modes:
  - Balanced mode: Proportional risk weighting, additive DII, guard threshold = 0.30
  - Strict mode: Convex risk amplification (γ=1.5), multiplicative DII, guard threshold = 0.40, global instability penalty
- Visual diff showing score differences between modes
- Explanation of when to use each mode

**Panel 5: Guard Activation Alert (`GuardActivationAlert`)**
- Only visible when a non-compensatory guard triggers
- Red alert banner showing:
  - Which component(s) fell below threshold
  - The threshold value (0.30 balanced / 0.40 strict)
  - The actual component score
  - Override verdict ("high_risk")
- Explanation of why high accuracy doesn't compensate for critical failures

**Panel 6: Advanced Analytics (`AdvancedAnalyticsPanel`)**
- Feature importance chart (bar chart of top features)
- Fairness metrics summary (if sensitive attribute detected)
- SHAP summary statistics
- Flags and recommendations list
- Raw metrics table

**Data Source:** `POST /api/evaluation/evaluate` returns the complete `EvaluationResult` with all fields.

---

#### 4.5 Compare (`/compare`)

**What it does:** Multi-model comparison with radar charts and leaderboards.

**UI Elements:**
- **Model selection**: Multi-select checkboxes from uploaded models
- **Dataset selection**: Choose evaluation dataset
- **"Compare" button**: Runs evaluations for all selected models
- **Radar chart**: Each model is a colored polygon; axes = normalized metrics
- **Leaderboard table**: Sortable by EvalScore, accuracy, F1, etc.
- **Metric detail cards**: Click a model to see full breakdown

**Flow:**
1. User selects 2+ models and a dataset
2. Clicks "Compare"
3. Backend runs SMCP pipeline for each model
4. Results aggregated into comparison matrix
5. Radar chart and leaderboard rendered

---

#### 4.6 Insights (`/insights`)

**What it does:** AI-powered data intelligence with dual tabs for dataset quality analysis and model evaluation analysis, plus an embedded AI chat.

**UI Elements:**

**Tab 1: Dataset Insights**
- **Dataset selector dropdown** at the top
- **AI Chat panel** (inline, takes up left 2/3 of the screen)
- **Data Quality Radar**: Completeness, Validity, Uniqueness, Consistency scores
- **Outlier Detection cards**: Per-feature outlier counts with high/medium/low impact
- **Correlation Analysis**: Top significant feature correlations with strength/direction

**Tab 2: Model Evaluation**
- **Model selector dropdown**
- **AI Chat** (same panel, context switches to model data)
- **Evaluation metrics display**: All raw metrics for selected model
- **Model summary card**: Framework, type, eval score, date

**AI Chat** (embedded in both tabs):
- Full-width chat interface within the page
- Sends complete evaluation data as context (including trust score, DII, component scores, fairness metrics, feature importance, flags, recommendations, verdict)
- Quick question buttons for common queries
- Markdown rendering in responses
- Powered by Supabase Edge Function (AI Mentor)

---

#### 4.7 Explainability (`/explainability`)

**What it does:** Visualizes *why* a model makes the predictions it does, using SHAP and LIME.

**UI Elements:**
- **Evaluation selector**: Dropdown of past evaluations
- **Feature Importance chart**: Horizontal bar chart showing top features by importance
- **SHAP Summary**: Mean absolute SHAP values, max SHAP, top contributing features
- **Method badge**: Shows which method was used (SHAP TreeExplainer, SHAP KernelExplainer, LIME, or Basic)
- **Feature contribution table**: Detailed per-feature breakdown

---

#### 4.8 Fairness (`/fairness`)

**What it does:** Audits model predictions for bias across demographic groups.

**UI Elements:**
- **Evaluation selector**: Dropdown to choose which evaluation to audit
- **Overall Fairness Score** gauge with color thresholds:
  - 🟢 ≥ 0.90: Excellent
  - 🟡 ≥ 0.75: Good
  - 🟠 ≥ 0.60: Fair
  - 🔴 ≥ 0.40: Poor
  - ⚫ < 0.40: Critical
- **Three tabs:**
  - **Fairness Metrics Tab**: Bar chart + table showing:
    - Demographic Parity (DP)
    - Equal Opportunity Difference (EOD)
    - Equalized Odds
    - Disparate Impact Ratio
    - Predictive Parity
    - Statistical Parity
  - **Group Comparison Tab**: Side-by-side bar charts comparing per-group accuracy, precision, recall, F1, TPR, FPR
  - **Recommendations Tab**: Actionable advice based on metric thresholds (e.g., "Apply re-weighting to reduce demographic parity gap")
- **Sensitive attribute badge**: Shows which attribute was analyzed (e.g., "gender", "race")

---

#### 4.9 Model Registry (`/registry`)

**What it does:** Central repository of all uploaded models with version tracking.

**UI Elements:**
- **Model list table**: Name, type, framework, size, upload date, evaluation status
- **Search and filter**: By name, framework, type, evaluation status
- **Model detail modal**: Full metadata, evaluation history, version info

---

#### 4.10 Settings (`/settings`)

**What it does:** User profile and account management.

**UI Elements:**
- Profile information (email, username)
- Account tier display (Free / Pro / Enterprise)
- Usage quota display

---

#### 4.11 AI Mentor (Floating Button)

**What it does:** A floating purple chat button in the bottom-right corner (available on ALL pages). Unlike the Insights AI Chat which analyzes YOUR data, this is a general ML knowledge assistant.

**UI Elements:**
- Floating circular button with sparkle icon
- Expandable chat panel with messages
- Can answer general ML questions, explain concepts, provide code examples

---

## 5. Core Methodology: SMCP Pipeline

### What is SMCP?

The **Standardized Model Comparison Pipeline (SMCP)** is the core evaluation engine that takes any ML model + dataset pair and produces a unified EvalScore on a 0–100 scale.

### Pipeline Steps

```
   Model File (.pkl/.pt/.h5/.onnx)
             │
             ▼
   ┌─────────────────────┐
   │  1. Type Detection   │  Infer framework from file extension
   │     & Model Loading  │  Load with appropriate library
   └──────────┬──────────┘
              │
              ▼
   ┌─────────────────────┐
   │  2. Dataset Loading  │  Parse CSV, split features/target
   │     & Preprocessing  │  Handle missing values, encoding
   └──────────┬──────────┘
              │
              ▼
   ┌─────────────────────┐
   │  3. Inference        │  Run model.predict(X_test)
   │                      │  Get predictions in standard format
   └──────────┬──────────┘
              │
              ▼
   ┌─────────────────────┐
   │  4. Metric           │  Compute domain-specific metrics
   │     Computation      │  (accuracy, F1, MAE, R², etc.)
   └──────────┬──────────┘
              │
              ▼
   ┌─────────────────────┐
   │  5. Normalization    │  Map all metrics to [0, 1]
   │                      │  Invert error metrics
   └──────────┬──────────┘
              │
              ▼
   ┌─────────────────────┐
   │  6. Weighted         │  Apply domain-specific weights
   │     Aggregation      │  Compute final EvalScore
   └──────────┬──────────┘
              │
              ▼
        EvalScore (0–100)
```

### Model Loading (Step 1)

The SMCP engine uses a multi-fallback loading strategy:

| Framework | File Extensions | Loading Method |
|-----------|----------------|---------------|
| scikit-learn | `.pkl`, `.joblib` | joblib.load → pickle.load → pickle(latin1) → pickle(bytes) → pickle(fix_imports) |
| PyTorch | `.pt`, `.pth` | torch.load with CPU mapping |
| TensorFlow/Keras | `.h5`, `.keras` | tf.keras.models.load_model |
| ONNX | `.onnx` | onnxruntime.InferenceSession wrapped in ONNXModelWrapper |

The ONNXModelWrapper provides a sklearn-compatible interface (`predict()`, `predict_proba()`) for ONNX models, making them interchangeable with sklearn models in the pipeline.

### Metric Computation (Step 4)

**Classification:**
```
accuracy  = (TP + TN) / (TP + TN + FP + FN)
precision = TP / (TP + FP)
recall    = TP / (TP + FN)
F1        = 2 × (precision × recall) / (precision + recall)
```

**Regression:**
```
MAE  = (1/n) × Σ|y_i − ŷ_i|
MSE  = (1/n) × Σ(y_i − ŷ_i)²
RMSE = √MSE
R²   = 1 − (SS_res / SS_tot) = 1 − Σ(y_i − ŷ_i)² / Σ(y_i − ȳ)²
```

### Normalization (Step 5)

- **Direct metrics** (higher is better): accuracy, precision, recall, F1, R², IoU, Dice → kept as-is in [0, 1]
- **Cost metrics** (lower is better): MAE, MSE, RMSE, perplexity → transformed using `normalized = 1 / (1 + value)`

### Weighted Aggregation (Step 6)

Domain-specific weight schemes:

| Domain | Metric Weights |
|--------|---------------|
| **Classification** | Accuracy: 0.25, Precision: 0.25, Recall: 0.25, F1: 0.25 |
| **Regression** | R²: 0.40, MAE: 0.30, RMSE: 0.30 |
| **NLP** | BLEU: 0.40, ROUGE: 0.40, Perplexity: 0.20 |
| **Computer Vision** | Accuracy: 0.30, IoU: 0.35, Dice: 0.35 |

**Formula:**

$$\text{EvalScore} = 100 \times \sum_{i} w_i \times \text{normalized}_i$$

---

## 6. Hybrid Trust Framework (MetaEvaluator)

### Overview

The **Hybrid Trust Framework** is a research-grade evaluation layer built on top of SMCP. While EvalScore tells you *how well a model performs*, the Trust Framework tells you *how much you should trust that performance*.

It answers critical questions that raw metrics cannot:
- "Is a 95% accuracy score reliable, or is the dataset garbage?"
- "Is this model equally fair to all demographic groups?"
- "Can a high F1 score compensate for terrible data quality?"

### The 10-Step Pipeline

The MetaEvaluator runs a 10-step deterministic pipeline:

#### Step 1: Component Scores [0, 1]

Four fundamental components are computed:

| Component | Symbol | Formula | Meaning |
|-----------|--------|---------|---------|
| **Performance** | P | F1 (classification) or max(0, R²) (regression) | How good are the predictions? |
| **Health** | H | 1 − DII | How trustworthy is the dataset? |
| **Fairness** | F | 1 − Demographic Parity | How unbiased are the predictions? |
| **Robustness** | R | 1 − \|train_metric − test_metric\| | How stable is the model? |

#### Step 2: Risk Values

Each component's risk is derived:

$$r_i = 1 - \text{score}_i$$

In **strict mode**, risks are amplified with convex power:

$$r_i^{\text{strict}} = r_i^{\gamma} \quad \text{where } \gamma = 1.5$$

This means moderate risks (0.3) become amplified (0.164), while high risks (0.7) become even higher (0.586).

#### Step 3: Automatic Weights (Risk-Proportional)

The system automatically allocates more attention to weaker areas:

$$\beta_{\text{auto},i} = \frac{r_i}{\sum_j r_j}$$

If fairness is the weakest component, it gets the highest automatic weight — the system focuses on what matters most.

#### Step 4: Hybrid Weights (λ Blending)

The key innovation — blending automatic (data-driven) weights with user-defined weights:

$$\beta_i = \lambda \cdot \beta_{\text{auto},i} + (1 - \lambda) \cdot w_{\text{user},i}$$

Where λ (lambda) is derived from the Data Instability Index:

| Mode | λ Formula | Rationale |
|------|-----------|-----------|
| **Balanced** | λ = DII | Higher data instability → more automatic control |
| **Strict** | λ = DII^1.5 | Even more aggressive automatic control |

Lambda is capped at 0.85 to preserve at least 15% user influence.

#### Step 5: Trust Score Computation

$$T = 100 \times \sum_i \beta_i \cdot \text{score}_i$$

In **strict mode**, a global instability penalty is applied:

$$T_{\text{strict}} = T \times (1 - \alpha \cdot \text{DII}) \quad \text{where } \alpha = 0.15$$

#### Step 6: Non-Compensatory Guard

**This is the safety mechanism.** If ANY component falls below the guard threshold, the model is flagged as high-risk regardless of how good the other components are.

| Mode | Guard Threshold |
|------|----------------|
| Balanced | 0.30 |
| Strict | 0.40 |

**Example:** A model with P=0.95, H=0.90, F=0.25, R=0.85 would be flagged as `high_risk` because F(0.25) < threshold(0.30). High accuracy does NOT compensate for unfair predictions.

#### Step 7: Flags & Recommendations

The system generates context-aware warnings:
- "⚠ High class imbalance detected (ratio > 0.7)"
- "⚠ DII > 0.3 — significant data instability"
- "⚠ Demographic parity gap exceeds 0.2"
- "⚠ Possible overfitting — train/test gap > 10%"

And actionable recommendations:
- "Apply SMOTE or class weighting to address imbalance"
- "Investigate and clean unstable features"
- "Consider fairness-aware training techniques"
- "Use regularization or early stopping"

#### Step 8: Mathematical Integrity Validation

Every output is validated:
- All scores bounded in [0, 1]
- Trust score in [0, 100]
- No NaN or Infinity values
- Weights sum to 1.0 (within tolerance 1e-6)

#### Step 9: Structured Summary Log

A complete execution trace is logged for reproducibility:
```
=== Hybrid Trust Evaluation (balanced) ===
Component Scores: P=0.89 H=0.92 F=0.78 R=0.85
Risk Values:      r_P=0.11 r_H=0.08 r_F=0.22 r_R=0.15
Lambda (λ):       0.08
Hybrid Weights:   β_P=0.22 β_H=0.19 β_F=0.35 β_R=0.24
Trust Score:       85.2/100
Guard Status:      PASSED (all ≥ 0.30)
Verdict:           high_trust
```

#### Step 10: Result Compilation

Full result object returned with backward compatibility for the legacy meta_score field.

### Trust Score Verdicts

| Verdict | Condition | Meaning |
|---------|-----------|---------|
| `high_trust` | T ≥ 70, guard passed | Safe for production |
| `moderate_trust` | 50 ≤ T < 70, guard passed | Acceptable with monitoring |
| `low_trust` | 30 ≤ T < 50, guard passed | Needs improvement |
| `untrusted` | T < 30, guard passed | Not recommended |
| `high_risk` | Guard triggered | Critical failure — do not deploy |
| `conditional_trust` | Edge cases | Requires manual review |

### DII (Data Instability Index)

The DII measures how much you can trust the dataset itself:

**Balanced mode (Additive):**

$$\text{DII} = \frac{I + M + D + S}{4}$$

**Strict mode (Multiplicative):**

$$\text{DII} = 1 - (1-I)(1-M)(1-D)(1-S)$$

Where:
- **I** = Class imbalance ratio (max_class / total samples, penalized above 0.6)
- **M** = Missing value ratio (missing / total cells)
- **D** = Duplicate row fraction
- **S** = Average skewness penalty (abs skew scaled to [0, 1])

### Advanced Features

**Multi-Run Bootstrap Confidence Intervals:**
```python
evaluator.evaluate_multi_run(n_runs=20, sigma=0.02)
```
Runs the evaluation 20 times with Gaussian perturbation (σ=0.02) and computes 95% confidence intervals using t-distribution.

**Lambda Sensitivity Analysis:**
```python
evaluator.evaluate_lambda_sensitivity()
```
Tests λ exponents [1.0, 1.2, 1.5, 2.0] to show how trust score changes with different aggressiveness levels.

---

## 7. Fairness Analysis Engine

### Purpose

The Fairness Engine detects whether a model treats different demographic groups equitably. It runs automatically when a sensitive attribute is detected in the dataset.

### Sensitive Attribute Detection

The system detects sensitive attributes in this priority order:
1. **User-specified** — explicitly provided in the evaluation request
2. **Dataset metadata** — stored with the dataset upload
3. **Auto-detection** — searches for columns named: `gender`, `sex`, `race`, `ethnicity`, `age_group`, `religion`, `disability`, `nationality`

### Metrics Computed

| Metric | Formula | Ideal Value | Concern If |
|--------|---------|-------------|------------|
| **Demographic Parity** | \|PPR₀ − PPR₁\| | 0.0 | > 0.2 |
| **Equal Opportunity Diff** | \|TPR₀ − TPR₁\| | 0.0 | > 0.2 |
| **Equalized Odds** | max(\|TPR diff\|, \|FPR diff\|) | 0.0 | > 0.2 |
| **Disparate Impact Ratio** | PPR₁ / PPR₀ | 1.0 | < 0.8 or > 1.25 |
| **Predictive Parity** | 1 − \|Precision₀ − Precision₁\| | 1.0 | < 0.8 |
| **Statistical Parity** | 1 − DP | 1.0 | < 0.8 |

Where PPR = Positive Prediction Rate, TPR = True Positive Rate, FPR = False Positive Rate.

### Per-Group Metrics

For each demographic group, the engine computes:
- Accuracy, Precision, Recall, F1 Score
- True Positive Rate (TPR) / Sensitivity
- False Positive Rate (FPR)
- Positive Prediction Rate (PPR)
- Full confusion matrix (TP, TN, FP, FN)

### Overall Fairness Score

$$\text{Fairness Score} = \frac{1}{n} \sum_{i=1}^{n} s_i$$

Where $s_i$ is each fairness metric score (all normalized to [0, 1] where 1 = perfectly fair).

### Integration with Trust Framework

The fairness score feeds directly into the MetaEvaluator as the **F (Fairness) component**:

$$F = 1 - \text{Demographic Parity}$$

If F < 0.30 (balanced) or F < 0.40 (strict), the non-compensatory guard triggers, overriding the verdict to `high_risk`.

---

## 8. Explainability Engine

### Purpose

The Explainability Engine answers the question: *"Why did the model make these predictions?"*

### Method Selection (Fallback Chain)

```
Try SHAP TreeExplainer   →  Best for tree-based models (RF, XGBoost, LightGBM)
  ↓ (fails)
Try SHAP KernelExplainer →  Universal but slower, works with any model
  ↓ (fails)
Try SHAP LinearExplainer →  For linear models (LogisticRegression, LinearSVM)
  ↓ (fails)
Try LIME                 →  Model-agnostic, sample-based explanations
  ↓ (fails)
Basic Feature Importance →  Extract model.feature_importances_ or model.coef_
```

### SHAP (SHapley Additive exPlanations)

SHAP values come from cooperative game theory. Each feature gets a "Shapley value" representing its average marginal contribution to the prediction across all possible feature coalitions.

**Output:**
- Per-feature importance scores (sorted by magnitude)
- Mean absolute SHAP values across all test samples
- Top contributing features with direction (positive/negative)
- SHAP summary statistics (mean, max, base value)
- Sample explanations for the first 5 test instances

### LIME (Local Interpretable Model-agnostic Explanations)

LIME creates a simple interpretable model (linear) around a single prediction to explain it locally.

**Output:**
- Feature contribution weights for each sample
- Averaged importance across 10 random samples
- Local explanation for individual predictions

### Basic Feature Importance

For models that natively support feature importance:
- Tree-based models: `model.feature_importances_` (Gini or entropy-based)
- Linear models: `abs(model.coef_)` normalized to sum to 1

### Single Prediction Explanation

```python
explainability_engine.explain_prediction(model, sample, feature_names)
```

Explains why the model predicted a specific value for one data point, showing which features pushed the prediction up or down.

---

## 9. Insights AI Chat

### Architecture

```
User Question
     │
     ▼
InsightsAIChat Component (React)
     │
     ├── buildAllEvaluationsContext()  ─── Formats ALL evaluation history
     │                                      including trust scores, DII,
     │                                      component scores, fairness,
     │                                      feature importance, flags, etc.
     │
     ├── buildContextMessage()  ──────── Formats CURRENT model's detailed
     │                                    analysis (trust framework, fairness,
     │                                    explainability, recommendations)
     │
     ▼
supabase.functions.invoke("ai-mentor")
     │
     ▼
Edge Function (Deno)
     │
     ├── buildSystemPrompt(context) ─── Constructs system prompt with
     │                                    all evaluation data
     │
     ├── Call LLM API (Gemini/OpenAI)
     │
     ▼
AI Response (Markdown)
```

### Context Sent to AI

The AI chat doesn't use generic knowledge — it receives the user's **actual evaluation data** as context:

**For the currently selected model:**
- Model name, type, framework, dataset
- EvalScore and all raw metrics
- Trust Score and DII
- Component scores (P, H, F, R)
- Risk values and hybrid weights (λ)
- Meta verdict
- Dataset health score
- Fairness metrics and sensitive attribute
- Feature importance (top features)
- SHAP summary
- Explainability method used
- Flags and warnings
- Recommendations

**For all evaluations:**
- Complete history with trust scores, DII, verdicts
- Component breakdowns per evaluation
- Fairness summaries per evaluation
- Top features per evaluation

### Quick Questions

Pre-configured quick question buttons:
- "What are MY model's strongest metrics?"
- "Where is MY model underperforming?"
- "How can I improve MY model's accuracy?"
- "Is MY model overfitting or underfitting?"
- "What features impact MY predictions most?"

---

## 10. Authentication & Authorization

### Flow

```
Frontend (React)  →  Backend (FastAPI)  →  Supabase Auth
     │                      │                    │
  API Client         Auth Routes            User Database
     │                      │                    │
  AuthContext         JWT Tokens           Session Storage
```

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/signup` | POST | Create account (email + password) |
| `/api/auth/login` | POST | Authenticate, receive JWT tokens |
| `/api/auth/logout` | POST | Invalidate session |
| `/api/auth/me` | GET | Get current user profile (requires Bearer token) |

### Token Management

1. **Login/Signup** returns `access_token` + `refresh_token`
2. Tokens stored in `localStorage`
3. Every API request includes `Authorization: Bearer <access_token>` header
4. Backend validates token via Supabase's `auth.get_user()` dependency
5. Protected routes in frontend redirect to `/login` if no valid session

### Row-Level Security (RLS)

All database tables use RLS policies ensuring:
- Users can only read/write their **own** data
- Model files are only accessible by their owner
- Evaluation history is scoped per user

---

## 11. Database Schema

### Tables

```sql
┌─────────────────────────────────────────────────┐
│                    users                         │
├─────────────────────────────────────────────────┤
│ id           UUID  PRIMARY KEY                   │
│ email        TEXT  UNIQUE NOT NULL               │
│ username     TEXT                                 │
│ hashed_pass  TEXT  NOT NULL                       │
│ tier         TEXT  DEFAULT 'free'                 │
│ model_count  INT   DEFAULT 0                      │
│ created_at   TIMESTAMP                           │
│ updated_at   TIMESTAMP                           │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                    models                        │
├─────────────────────────────────────────────────┤
│ id           UUID  PRIMARY KEY                   │
│ user_id      UUID  FK → users(id)                │
│ name         TEXT  NOT NULL                       │
│ description  TEXT                                 │
│ model_type   TEXT  (classification/regression/    │
│                     nlp/cv)                       │
│ framework    TEXT  (sklearn/pytorch/tensorflow/   │
│                     keras/onnx)                   │
│ file_path    TEXT  NOT NULL                       │
│ file_size    BIGINT                               │
│ is_evaluated BOOLEAN DEFAULT false                │
│ created_at   TIMESTAMP                           │
│ updated_at   TIMESTAMP                           │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                   datasets                       │
├─────────────────────────────────────────────────┤
│ id           UUID  PRIMARY KEY                   │
│ user_id      UUID  FK → users(id)                │
│ name         TEXT  NOT NULL                       │
│ description  TEXT                                 │
│ file_path    TEXT  NOT NULL                       │
│ file_size    BIGINT                               │
│ row_count    INT                                  │
│ column_count INT                                  │
│ created_at   TIMESTAMP                           │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                  evaluations                     │
├─────────────────────────────────────────────────┤
│ id                  UUID  PRIMARY KEY            │
│ model_id            UUID  FK → models(id)        │
│ dataset_id          UUID  FK → datasets(id)      │
│ user_id             UUID  FK → users(id)         │
│ metrics             JSONB  (raw metrics)         │
│ eval_score          FLOAT  (0-100)               │
│ normalized_metrics  JSONB                        │
│ weight_distribution JSONB                        │
│ meta_score          FLOAT                        │
│ trust_score         FLOAT                        │
│ DII                 FLOAT                        │
│ component_scores    JSONB  {P, H, F, R}          │
│ risk_values         JSONB                        │
│ hybrid_weights      JSONB                        │
│ dataset_health_score FLOAT                       │
│ meta_flags          JSONB  [strings]             │
│ meta_recommendations JSONB [strings]             │
│ meta_verdict        TEXT                         │
│ feature_importance  JSONB  {feature: score}      │
│ explainability_method TEXT                        │
│ shap_summary        JSONB                        │
│ fairness_metrics    JSONB                        │
│ group_metrics       JSONB                        │
│ sensitive_attribute TEXT                          │
│ evaluated_at        TIMESTAMP                    │
└─────────────────────────────────────────────────┘
```

### RLS Policies

All tables have:
- `SELECT` policy: `auth.uid() = user_id`
- `INSERT` policy: `auth.uid() = user_id`
- `UPDATE` policy: `auth.uid() = user_id`
- `DELETE` policy: `auth.uid() = user_id`

### Triggers

- **Auto model count**: Updates `users.model_count` when models are inserted/deleted
- **Auto profile creation**: Creates user profile when Supabase Auth user is created

---

## 12. API Reference

### Authentication

| Endpoint | Method | Body | Response |
|----------|--------|------|----------|
| `/api/auth/signup` | POST | `{email, password, username?}` | `{access_token, refresh_token, user}` |
| `/api/auth/login` | POST | `{email, password}` | `{access_token, refresh_token, user}` |
| `/api/auth/logout` | POST | — | `{message}` |
| `/api/auth/me` | GET | — | `{id, email, username, tier}` |

### Models

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/models` | GET | List user's models |
| `POST /api/models/upload` | POST | Upload model file (multipart) |
| `GET /api/models/{id}` | GET | Get model details |
| `DELETE /api/models/{id}` | DELETE | Delete model |

### Datasets

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/datasets` | GET | List user's datasets |
| `POST /api/datasets/upload` | POST | Upload dataset CSV (multipart) |
| `GET /api/datasets/{id}` | GET | Get dataset details |
| `GET /api/datasets/{id}/preview` | GET | Preview rows + column info |
| `DELETE /api/datasets/{id}` | DELETE | Delete dataset |

### Evaluation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /api/evaluation/evaluate` | POST | Run full SMCP + MetaEvaluator pipeline |
| `GET /api/evaluation/history` | GET | Get all evaluations (with ?limit=N) |
| `POST /api/evaluation/compare` | POST | Compare multiple models |

### Insights

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/insights/quality/{dataset_id}` | GET | Data quality analysis |
| `GET /api/insights/outliers/{dataset_id}` | GET | Outlier detection |
| `GET /api/insights/correlations/{dataset_id}` | GET | Feature correlations |
| `GET /api/insights/summary/{dataset_id}` | GET | Combined summary |

---

## 13. Supported Model Formats & Frameworks

### File Format → Framework Mapping

| Extension | Framework | Loading Method |
|-----------|-----------|---------------|
| `.pkl` | scikit-learn | joblib → pickle (5 fallback methods) |
| `.joblib` | scikit-learn | joblib.load |
| `.pt`, `.pth` | PyTorch | torch.load(map_location='cpu') |
| `.h5` | TensorFlow/Keras | tf.keras.models.load_model |
| `.keras` | Keras | tf.keras.models.load_model |
| `.onnx` | ONNX | onnxruntime.InferenceSession → ONNXModelWrapper |

### ONNX Special Handling

ONNX models are wrapped in `ONNXModelWrapper` that provides:
- `predict()` — runs inference session, returns argmax for classification or regressed value
- `predict_proba()` — returns probability outputs for classification

ONNX is the **recommended format** for production because:
- Cross-Python-version compatible
- Cross-framework compatible
- No sklearn/PyTorch dependency at inference
- Optimized inference performance

### Model Type Detection

| Model Type | How Detected | Primary Metrics |
|------------|-------------|----------------|
| Classification | User-specified or `model.classes_` exists | Accuracy, Precision, Recall, F1 |
| Regression | User-specified or continuous target detected | MAE, MSE, RMSE, R² |
| NLP | User-specified | BLEU, ROUGE, Perplexity |
| Computer Vision | User-specified | Accuracy, IoU, Dice |

---

## 14. Evaluation Metrics Reference

### Classification Metrics

| Metric | Range | Interpretation | EvalScore Weight |
|--------|-------|---------------|-----------------|
| **Accuracy** | [0, 1] | Fraction of correct predictions | 0.25 |
| **Precision** | [0, 1] | Of predicted positives, how many are correct | 0.25 |
| **Recall** | [0, 1] | Of actual positives, how many were found | 0.25 |
| **F1 Score** | [0, 1] | Harmonic mean of precision and recall | 0.25 |

### Regression Metrics

| Metric | Range | Interpretation | EvalScore Weight |
|--------|-------|---------------|-----------------|
| **R²** | (-∞, 1] | Proportion of variance explained | 0.40 |
| **MAE** | [0, ∞) | Average absolute error (lower = better) | 0.30 |
| **RMSE** | [0, ∞) | Root mean squared error (lower = better) | 0.30 |
| **MSE** | [0, ∞) | Mean squared error (computed, not weighted) | — |

### NLP Metrics

| Metric | Range | Interpretation | EvalScore Weight |
|--------|-------|---------------|-----------------|
| **BLEU** | [0, 1] | N-gram precision with brevity penalty | 0.40 |
| **ROUGE** | [0, 1] | N-gram recall | 0.40 |
| **Perplexity** | [1, ∞) | Language model quality (lower = better) | 0.20 |

### Computer Vision Metrics

| Metric | Range | Interpretation | EvalScore Weight |
|--------|-------|---------------|-----------------|
| **Accuracy** | [0, 1] | Pixel-level correctness | 0.30 |
| **IoU** | [0, 1] | Intersection over Union | 0.35 |
| **Dice** | [0, 1] | Overlap coefficient | 0.35 |

---

## 15. EvalScore Calculation

### Formula

$$\text{EvalScore} = 100 \times \sum_{i} w_i \times \hat{m}_i$$

Where:

$$\hat{m}_i = \begin{cases} m_i & \text{if } m_i \text{ is a direct metric (accuracy, F1, R², etc.)} \\ \frac{1}{1 + m_i} & \text{if } m_i \text{ is a cost metric (MAE, RMSE, etc.)} \end{cases}$$

### Example: Classification Model

```
Raw Metrics:
  accuracy  = 0.92
  precision = 0.89
  recall    = 0.87
  f1_score  = 0.88

Normalized (all direct metrics, kept as-is):
  accuracy  = 0.92
  precision = 0.89
  recall    = 0.87
  f1_score  = 0.88

Weighted Aggregation:
  EvalScore = 100 × (0.25 × 0.92 + 0.25 × 0.89 + 0.25 × 0.87 + 0.25 × 0.88)
  EvalScore = 100 × 0.89
  EvalScore = 89.0
```

### Example: Regression Model

```
Raw Metrics:
  r2_score = 0.85
  mae      = 2.3
  rmse     = 3.1

Normalized:
  r2_score = 0.85             (direct metric)
  mae      = 1/(1+2.3) = 0.303  (cost metric inverted)
  rmse     = 1/(1+3.1) = 0.244  (cost metric inverted)

Weighted Aggregation:
  EvalScore = 100 × (0.40 × 0.85 + 0.30 × 0.303 + 0.30 × 0.244)
  EvalScore = 100 × (0.340 + 0.091 + 0.073)
  EvalScore = 100 × 0.504
  EvalScore = 50.4
```

---

## 16. Search System

### Global Search (Ctrl+K)

The platform provides a global search accessible from any page via keyboard shortcut `Ctrl+K` or the search bar in the navbar.

**Searchable Entities:**
- Models (by name, description, framework, type)
- Datasets (by name, description)
- Evaluations (by model name, dataset name, score)

**Architecture:**
- `GlobalSearchService` singleton handles cross-entity search
- `useSearch` hook provides debounced, memoized search state
- `SearchBar` component renders the search UI
- Results sorted by relevance score

### Page-Level Search

Individual pages (Models, Datasets) have local search bars that filter the displayed list in real-time.

**Utility Functions:**
- `searchItems<T>()` — Generic search across multiple fields
- `filterByField<T>()` — Filter by specific field value
- `sortByRelevance<T>()` — Sort results by query relevance
- `debounce()` — Rate-limit search input processing
- `highlightText()` — Highlight matching text in results

---

## 17. User Workflow: End-to-End

### Complete Evaluation Workflow

```
Step 1: Sign Up / Login
│   → Create account at /signup or login at /login
│   → JWT tokens issued and stored
│
Step 2: Upload Model
│   → Navigate to /upload
│   → Select "Model" tab
│   → Drag-and-drop .pkl/.onnx/.pt/.h5 file
│   → Fill in: name, type (classification/regression), framework
│   → Click "Upload" → stored in Supabase
│
Step 3: Upload Dataset
│   → Stay on /upload, switch to "Dataset" tab
│   → Drag-and-drop .csv file
│   → Fill in: name, description
│   → Click "Upload" → stored in Supabase
│
Step 4: Evaluate Model
│   → Navigate to /evaluate
│   → Select model from dropdown
│   → Select dataset from dropdown
│   → (Optional) Enter sensitive attribute for fairness analysis
│   → Click "Evaluate Model"
│   → Wait 2-10 seconds for full pipeline
│   → View 6 result panels:
│       1. Trust Overview (score, verdict, DII)
│       2. Component Breakdown (P, H, F, R)
│       3. Calculation Transparency (formulas)
│       4. Mode Comparison (balanced vs strict)
│       5. Guard Alert (if triggered)
│       6. Advanced Analytics (features, fairness)
│
Step 5: Compare Models (optional)
│   → Navigate to /compare
│   → Select multiple models
│   → Select dataset
│   → Click "Compare"
│   → View radar chart + leaderboard
│
Step 6: Analyze with AI
│   → Navigate to /insights
│   → Select "Model Evaluation" tab
│   → Choose your model
│   → Use the AI chat to ask questions:
│       "What are my model's weaknesses?"
│       "Is my model fair across gender groups?"
│       "Should I trust this trust score?"
│   → AI analyzes YOUR actual data and responds
│
Step 7: Deep Dive
│   → /explainability → See which features matter most (SHAP/LIME)
│   → /fairness → Audit bias across demographic groups
│   → /registry → Track all your models in one place
│
Step 8: Iterate
│   → Upload improved model
│   → Re-evaluate
│   → Compare with previous version
│   → Verify improvements in trust score
```

### What Happens During Evaluation (Behind the Scenes)

```
User clicks "Evaluate Model"
        │
        ▼
Backend receives POST /api/evaluation/evaluate
        │
        ├── 1. Fetch model & dataset metadata from DB
        ├── 2. Download model file from Supabase Storage
        ├── 3. Download dataset file from Supabase Storage
        │
        ▼
    SMCP Pipeline
        ├── 4. Detect framework from file extension
        ├── 5. Load model with appropriate loader
        ├── 6. Load dataset CSV, split features/target
        ├── 7. Run model.predict(X_test)
        ├── 8. Compute domain-specific metrics
        ├── 9. Normalize metrics to [0,1]
        ├── 10. Apply domain weights
        ├── 11. Calculate EvalScore (0-100)
        │
        ▼
    Dataset Statistics
        ├── 12. Count missing values, duplicates
        ├── 13. Detect class imbalance
        ├── 14. Calculate skewness per feature
        ├── 15. Identify low-variance features
        │
        ▼
    MetaEvaluator (Balanced Mode)
        ├── 16. Compute P, H, F, R component scores
        ├── 17. Calculate risk values
        ├── 18. Derive lambda (λ) from DII
        ├── 19. Compute hybrid weights
        ├── 20. Calculate trust score
        ├── 21. Check non-compensatory guards
        ├── 22. Generate flags & recommendations
        ├── 23. Determine verdict
        │
        ▼
    MetaEvaluator (Strict Mode)
        ├── 24. Re-run with convex amplification
        ├── 25. Multiplicative DII
        ├── 26. Higher guard threshold (0.40)
        ├── 27. Global instability penalty
        │
        ▼
    Fairness Analysis (if sensitive attribute detected)
        ├── 28. Detect/validate sensitive attribute
        ├── 29. Split predictions by group
        ├── 30. Compute per-group metrics
        ├── 31. Calculate fairness metrics (DP, EOD, etc.)
        │
        ▼
    Explainability Analysis
        ├── 32. Try SHAP (Tree → Kernel → Linear)
        ├── 33. Fallback to LIME if SHAP fails
        ├── 34. Fallback to basic feature importance
        │
        ▼
    Save & Return
        ├── 35. Upsert all results to evaluations table
        ├── 36. Mark model as evaluated
        ├── 37. Return complete EvaluationResult to frontend
        │
        ▼
    Frontend renders 6 panels with full results
```

---

## 18. Configuration & Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_KEY` | Supabase anon/public key | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJhbGci...` |
| `DATABASE_URL` | Direct PostgreSQL connection | `postgresql://...` |
| `SECRET_KEY` | App secret for JWT | Random 64-char string |
| `JWT_SECRET` | JWT signing secret | Same as Supabase JWT secret |
| `API_HOST` | Server bind address | `0.0.0.0` |
| `API_PORT` | Server port | `8000` |
| `DEBUG` | Enable debug mode | `True` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost:8080,...` |
| `MAX_UPLOAD_SIZE_MB` | Max file upload size | `1024` |
| `STORAGE_BUCKET_MODELS` | Supabase bucket name for models | `models` |
| `STORAGE_BUCKET_DATASETS` | Supabase bucket name for datasets | `datasets` |

### Frontend (`frontend/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API URL | `http://localhost:8000` |
| `VITE_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key | `eyJhbGci...` |
| `VITE_MAX_UPLOAD_SIZE_MB` | Frontend file size limit | `100` |

---

## 19. Deployment Architecture

### Development Setup

```
Terminal 1 (Backend):
  cd backend
  .\venv\Scripts\Activate.ps1
  python main.py                    → http://localhost:8000

Terminal 2 (Frontend):
  cd frontend
  npm run dev                       → http://localhost:8080

Supabase:
  Cloud instance                    → https://xxx.supabase.co
  Edge Functions (AI Chat)          → Deployed via supabase functions deploy
```

### Production Deployment

| Component | Platform | Details |
|-----------|----------|---------|
| Frontend | Vercel / Lovable.dev | Static build, CDN distribution |
| Backend | Render / Railway | Auto-scaling, health checks |
| Database | Supabase Cloud | Auto backups, point-in-time recovery |
| Storage | Supabase Storage | CDN, access control |
| Edge Functions | Supabase Edge | AI Mentor chat (Deno runtime) |
| Monitoring | `/api/health` | Backend health check endpoint |

---

## 20. Glossary

| Term | Definition |
|------|-----------|
| **SMCP** | Standardized Model Comparison Pipeline — the core engine that produces EvalScore |
| **EvalScore** | Unified 0–100 metric enabling cross-domain model comparison |
| **MetaEvaluator** | The Hybrid Trust Framework that computes trust scores beyond raw metrics |
| **Trust Score** | 0–100 measure of how much a model's performance can be trusted |
| **DII** | Data Instability Index — measures how trustworthy the dataset is [0, 1] |
| **Lambda (λ)** | Blending parameter between automatic and user-defined weights |
| **Non-Compensatory Guard** | Safety mechanism that flags models when ANY component is critically weak |
| **Component Scores** | P (Performance), H (Health), F (Fairness), R (Robustness) — the four pillars |
| **Risk Values** | `r_i = 1 − score_i` — how much risk each component carries |
| **Hybrid Weights** | `β_i = λ·auto + (1−λ)·user` — the final weight for each component |
| **Balanced Mode** | Proportional risk weighting, additive DII, guard threshold 0.30 |
| **Strict Mode** | Convex amplification (γ=1.5), multiplicative DII, threshold 0.40, global penalty |
| **Demographic Parity** | Fairness metric — are positive predictions equally distributed across groups? |
| **SHAP** | SHapley Additive exPlanations — game-theoretic feature importance |
| **LIME** | Local Interpretable Model-agnostic Explanations — local surrogate models |
| **RLS** | Row-Level Security — PostgreSQL policy ensuring users can only access their own data |
| **ONNX** | Open Neural Network Exchange — framework-agnostic model format |
| **ONNXModelWrapper** | Adapter class giving ONNX models a sklearn-compatible interface |

---

**Document Version:** 2.0  
**Last Updated:** March 2026  
**Coverage:** Full platform — architecture, methodology, UI, APIs, formulas, workflows  
**Word Count:** ~6,000+
