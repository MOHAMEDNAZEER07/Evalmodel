# 🚀 Quick Start Guide - EvalModel

Get your EvalModel platform running in **5 minutes**!

---

## ⚡ Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] Python 3.10+ installed
- [ ] Supabase account (free at https://supabase.com)
- [ ] Code editor (VS Code recommended)

---

## 📋 Step-by-Step Setup

### 1️⃣ Setup Supabase (3 minutes)

1. **Create a Supabase project**:
   - Go to https://supabase.com
   - Click "New Project"
   - Name it "evalmodel"
   - Choose a region close to you
   - Wait for database to initialize (~2 minutes)

2. **Run database schema**:
   - In Supabase dashboard, go to **SQL Editor**
   - Click "New Query"
   - Copy entire contents of `backend/database_schema.sql`
   - Paste and click "Run"
   - Wait for "Success" message

3. **Create storage buckets**:
   - Go to **Storage** in left sidebar
   - Click "New bucket"
   - Name: `models`, Public: No → Create
   - Repeat for `datasets` bucket

4. **Get your credentials**:
   - Go to **Settings** > **API**
   - Copy:
     - `Project URL` (looks like: `https://xxx.supabase.co`)
     - `anon/public key` (starts with `eyJ...`)
     - `service_role key` (starts with `eyJ...`, keep secret!)

---

### 2️⃣ Setup Backend (5 minutes)

```powershell
# Navigate to backend folder
cd backend

# Create virtual environment
python -m venv venv

# Activate it
.\venv\Scripts\Activate.ps1

# Install dependencies (this takes ~3 minutes)
pip install -r requirements.txt

# Create .env file
Copy-Item .env.example .env

# Edit .env with your editor
notepad .env
```

**Paste your Supabase credentials in `.env`**:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=True
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
MAX_UPLOAD_SIZE_MB=1024
STORAGE_BUCKET_MODELS=models
STORAGE_BUCKET_DATASETS=datasets
```

**Start the backend**:
```powershell
python main.py
```

✅ You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Test it**: Open http://localhost:8000/api/docs in your browser

---

### 3️⃣ Setup Frontend (2 minutes)

**Open a NEW terminal** (keep backend running!)

```powershell
# From project root
npm install

# Verify .env file exists
# It should already have VITE_API_BASE_URL=http://localhost:8000

# Start dev server
npm run dev
```

✅ You should see:
```
VITE v5.x ready in xxx ms

➜  Local:   http://localhost:5173/
```

**Open**: http://localhost:5173

---

## 🎯 First Test - Upload a Model

### Option A: Use a Sample scikit-learn Model

Create a test model:

```powershell
# In a NEW terminal, activate backend venv
cd backend
.\venv\Scripts\Activate.ps1

# Run Python
python
```

```python
from sklearn.ensemble import RandomForestClassifier
import pickle

# Create a simple model
model = RandomForestClassifier(n_estimators=10)

# Save it
with open('../test_model.pkl', 'wb') as f:
    pickle.dump(model, f)

print("Model saved: test_model.pkl")
exit()
```

### Option B: Use Your Own Model

Just make sure it's one of:
- `.pkl` (scikit-learn)
- `.pt` or `.pth` (PyTorch)
- `.h5` (TensorFlow/Keras)
- `.onnx` (ONNX)

### Upload via UI

1. Go to http://localhost:5173
2. Click **Upload** in sidebar
3. Select **Upload Model** tab
4. Drag your `test_model.pkl` file (or browse)
5. Fill in:
   - Name: "Test RF Classifier"
   - Type: Classification
   - Framework: scikit-learn
6. Click **Upload Model**

**🎉 Success!** You should see a green success toast.

---

## 🎯 First Test - Upload a Dataset

### Create a Test Dataset

```powershell
# In backend venv Python
python
```

```python
import pandas as pd
import numpy as np

# Create sample classification dataset
np.random.seed(42)
data = {
    'feature1': np.random.randn(100),
    'feature2': np.random.randn(100),
    'feature3': np.random.randn(100),
    'target': np.random.choice([0, 1], 100)
}

df = pd.DataFrame(data)
df.to_csv('../test_dataset.csv', index=False)
print("Dataset saved: test_dataset.csv")
exit()
```

### Upload via UI

1. Switch to **Upload Dataset** tab
2. Drag `test_dataset.csv`
3. Name: "Test Classification Data"
4. Click **Upload Dataset**

---

## 🧪 Test the API Directly

### Using Swagger UI

1. Go to http://localhost:8000/api/docs
2. Try the **Health Check**:
   - Click `GET /health`
   - Click "Try it out"
   - Click "Execute"
   - Should return `{"status": "healthy"}`

### Test Model Upload via API

```powershell
# Get a Supabase session token first
# (For now, you'll need to authenticate via frontend)
```

---

## ❓ Troubleshooting

### Backend won't start

**Error**: `ModuleNotFoundError`
- Solution: Make sure venv is activated and run `pip install -r requirements.txt`

**Error**: `SUPABASE_URL not set`
- Solution: Check `.env` file exists in `backend/` folder

### Frontend won't start

**Error**: `VITE_SUPABASE_URL is not defined`
- Solution: Check `.env` file in project root

**Error**: `Cannot connect to backend`
- Solution: Make sure backend is running on port 8000

### Upload fails

**Error**: `Authentication required`
- Solution: You need to implement auth first (see next steps)

**Error**: `Storage bucket not found`
- Solution: Create `models` and `datasets` buckets in Supabase Storage

---

## ✅ Quick Health Check

Run these URLs and verify responses:

| URL | Expected |
|-----|----------|
| http://localhost:8000 | `{"message": "EvalModel API", ...}` |
| http://localhost:8000/health | `{"status": "healthy"}` |
| http://localhost:8000/api/docs | Swagger UI page |
| http://localhost:5173 | EvalModel Dashboard |

---

## 🎯 Next Steps

1. **Add Authentication** - Set up Supabase Auth (see `PROJECT_STATUS.md`)
2. **Build Evaluate Page** - Connect model evaluation UI to backend
3. **Build Compare Page** - Multi-model comparison interface
4. **Test SMCP Pipeline** - Run a full evaluation cycle

---

## 📚 Additional Resources

- **Full Docs**: See `README.md`
- **Backend API**: See `backend/README.md`
- **Project Status**: See `PROJECT_STATUS.md`
- **Database Schema**: See `backend/database_schema.sql`

---

## 🆘 Getting Help

If you're stuck:
1. Check the error logs in terminal
2. Review `PROJECT_STATUS.md` for known issues
3. Visit API docs at http://localhost:8000/api/docs
4. Check Supabase dashboard for storage/database issues

---

**🎉 Congratulations!** Your EvalModel platform is now running locally.

Next: Implement authentication and start evaluating models!
