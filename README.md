# 🧠 EvalModel – Universal AI Model Evaluation & Comparison Platform

> **A full-stack platform for uploading, evaluating, and comparing machine learning models across multiple domains using the Standardized Model Comparison Pipeline (SMCP).**

[![React](https://img.shields.io/badge/React-18.3-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green)](https://fastapi.tiangolo.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 🎯 Overview

EvalModel is an **AI-powered model evaluation and comparison system** featuring a novel **SMCP (Standardized Model Comparison Pipeline)** that standardizes evaluation across any ML domain.

Perfect for:
- 🧑‍🔬 **ML Engineers** - Quick model performance benchmarking
- 🔬 **Researchers** - Cross-model comparison with unified metrics
- 👨‍🏫 **Educators** - Teaching model evaluation best practices

---

## ✨ Key Features

### 🔬 Core Capabilities

- **📊 SMCP Pipeline**: Automatically detects model type and computes domain-specific metrics
- **🎯 Universal Evaluation**: Support for Classification, Regression, NLP, and Computer Vision
- **🔀 Multi-Framework**: Works with scikit-learn, PyTorch, TensorFlow, Keras, and ONNX
- **📈 EvalScore**: Unified 0-100 score for cross-domain model ranking
- **⚖️ Model Comparison**: Side-by-side comparison with radar charts and leaderboards
- **📦 Easy Upload**: Drag-and-drop interface for models (.pkl, .pt, .h5, .onnx) and datasets (CSV)

### 💼 Platform Features

- **🔐 Authentication**: GitHub OAuth integration via Supabase
- **👤 User Profiles**: Role-based access (Free/Pro/Enterprise)
- **📁 Storage**: Secure model and dataset storage with Supabase
- **📊 Visualizations**: Interactive charts and performance dashboards
- **📄 Reports**: Downloadable evaluation reports (PDF/CSV)

---

## 🏗️ Architecture

### Tech Stack

**Frontend**
- React 18 + Vite
- TypeScript
- Tailwind CSS + shadcn/ui components
- Recharts for visualizations
- React Query for state management

**Backend**
- FastAPI (Python)
- Supabase (PostgreSQL + Storage + Auth)
- ML Libraries: scikit-learn, PyTorch, TensorFlow, Transformers

**Deployment**
- Frontend: Vercel / Lovable.dev
- Backend: Render / Railway
- Database: Supabase Cloud

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (for frontend)
- Python 3.10+ (for backend)
- Supabase account (free tier works)

### 1. Frontend Setup

```bash
# Install dependencies
npm install

# Create .env file (use your Supabase credentials)
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
# VITE_API_BASE_URL=http://localhost:8000

# Start dev server
npm run dev
```

Frontend runs at: http://localhost:5173

### 2. Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Create .env file (see backend/.env.example)

# Setup Supabase database
# 1. Go to Supabase SQL Editor
# 2. Run database_schema.sql
# 3. Create storage buckets: 'models' and 'datasets'

# Start server
python main.py
```

Backend API runs at: http://localhost:8000  
API Docs: http://localhost:8000/api/docs

---

## 📖 Documentation

- **[Backend API Documentation](backend/README.md)** - Complete FastAPI setup guide
- **[Project Status](PROJECT_STATUS.md)** - Current implementation status
- **[Database Schema](backend/database_schema.sql)** - PostgreSQL schema

---

## 🎮 Usage

### 1. Upload a Model

1. Navigate to **Upload** page
2. Select **Upload Model** tab
3. Drag & drop your model file (`.pkl`, `.pt`, `.h5`, `.onnx`)
4. Fill in metadata:
   - Model Name
   - Model Type (Classification/Regression/NLP/CV)
   - Framework (sklearn/PyTorch/TensorFlow/Keras/ONNX)
5. Click **Upload Model**

### 2. Upload a Dataset

1. Select **Upload Dataset** tab
2. Drag & drop CSV file
3. Enter dataset name and description
4. Click **Upload Dataset**

### 3. Evaluate a Model

1. Go to **Evaluate** page
2. Select a model and dataset
3. Click **Run Evaluation**
4. View metrics:
   - **Classification**: Accuracy, Precision, Recall, F1
   - **Regression**: MAE, MSE, RMSE, R²
   - **NLP**: BLEU, ROUGE, Perplexity
   - **CV**: IoU, Dice Coefficient, Pixel Accuracy
5. See your **EvalScore** (0-100)

### 4. Compare Models

1. Go to **Compare** page
2. Select multiple models
3. Choose a dataset
4. View:
   - Radar chart with normalized metrics
   - Leaderboard ranked by EvalScore
   - Side-by-side metric comparison

---

## 🧩 SMCP Pipeline Explained

The **Standardized Model Comparison Pipeline** (SMCP) is the core innovation:

### How It Works

1. **Auto-Detection**: Identifies model type from file extension
2. **Loading**: Loads model using appropriate framework
3. **Inference**: Runs predictions on test dataset
4. **Metrics Computation**: Calculates domain-specific metrics
5. **Normalization**: Converts metrics to 0-1 scale
6. **Weighting**: Applies importance weights per domain
7. **EvalScore**: Produces unified 0-100 score

### Metric Weights

```python
CLASSIFICATION: {
  "accuracy": 0.25,
  "precision": 0.25,
  "recall": 0.25,
  "f1_score": 0.25
}

REGRESSION: {
  "r2_score": 0.4,
  "mae": 0.3,      # Inverted (lower is better)
  "rmse": 0.3      # Inverted (lower is better)
}
```

### Example EvalScore

```
Model A (Classification):
- Accuracy: 0.95 → normalized: 0.95
- Precision: 0.92 → normalized: 0.92
- Recall: 0.88 → normalized: 0.88
- F1: 0.90 → normalized: 0.90

EvalScore = (0.95 + 0.92 + 0.88 + 0.90) / 4 * 100 = 91.25
```

---

## 📊 Supported Model Types

| Type | Frameworks | Metrics | File Formats |
|------|-----------|---------|--------------|
| Classification | All | Accuracy, Precision, Recall, F1 | .pkl, .pt, .h5, .onnx |
| Regression | All | MAE, MSE, RMSE, R² | .pkl, .pt, .h5, .onnx |
| NLP | PyTorch, TF | BLEU, ROUGE, Perplexity | .pt, .h5 |
| Computer Vision | PyTorch, TF | IoU, Dice, Pixel Accuracy | .pt, .h5 |

---

## 💳 Pricing Tiers

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Models | 2 | 10 | Unlimited |
| Datasets | 5 | 50 | Unlimited |
| Evaluations | 10/month | Unlimited | Unlimited |
| SMCP Access | ✅ Basic | ✅ Full | ✅ Full |
| PDF Export | ❌ | ✅ | ✅ |
| API Access | ❌ | ❌ | ✅ |
| Priority Support | ❌ | ❌ | ✅ |

---

## 🛠️ Development

### Project Structure

```
evalmodel/
├── frontend/
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── pages/           # Route pages
│   │   ├── lib/             # API client, utils
│   │   └── integrations/    # Supabase client
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── app/
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # SMCP engine
│   │   ├── models/          # Pydantic schemas
│   │   └── core/            # Config, DB client
│   ├── main.py
│   ├── requirements.txt
│   └── database_schema.sql
└── README.md
```

### Running Tests

```bash
# Frontend tests
npm run test

# Backend tests
cd backend
pytest
```

### Building for Production

```bash
# Frontend
npm run build

# Backend
pip install gunicorn
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker
```

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

---

## 🙏 Acknowledgments

- Built with [Lovable.dev](https://lovable.dev)
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Backend powered by [FastAPI](https://fastapi.tiangolo.com)
- Database & Auth by [Supabase](https://supabase.com)

---

## 📞 Support

- **Documentation**: See `PROJECT_STATUS.md` and `backend/README.md`
- **Issues**: Open a GitHub issue
- **Questions**: Check API docs at `/api/docs`

---

**Project URL**: https://lovable.dev/projects/c4c1ac4e-e75c-46a0-bf77-638ec4ce8c72

Made with ❤️ for the ML community
