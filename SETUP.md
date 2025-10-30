# EvalModel - Setup Instructions

This guide will help you set up the EvalModel project on a new machine.

## Prerequisites

- **Python 3.11+** installed
- **Node.js 18+** and **npm** installed
- **Supabase Account** (for database and storage)
- **Git** (optional, for version control)

## Project Structure

```
evalmodel/
├── backend/          # FastAPI backend
├── src/              # React frontend
├── supabase/         # Supabase configuration
└── public/           # Static assets
```

---

## Step 1: Clone or Copy the Project

If using Git:
```bash
git clone <your-repository-url>
cd evalmodel
```

Or simply copy the entire `evalmodel` folder to your new machine.

---

## Step 2: Set Up Supabase

### 2.1 Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Note down:
   - Project URL (e.g., `https://xxxxx.supabase.co`)
   - `anon` (public) key
   - `service_role` (secret) key

### 2.2 Create Database Tables

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Run this SQL script:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    username TEXT,
    hashed_password TEXT NOT NULL,
    tier TEXT DEFAULT 'free',
    model_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Models table
CREATE TABLE IF NOT EXISTS models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    model_type TEXT NOT NULL,
    framework TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    is_evaluated BOOLEAN DEFAULT FALSE,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Datasets table
CREATE TABLE IF NOT EXISTS datasets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    row_count INTEGER,
    column_count INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Evaluations table
CREATE TABLE IF NOT EXISTS evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID REFERENCES models(id) ON DELETE CASCADE,
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    metrics JSONB NOT NULL,
    eval_score FLOAT NOT NULL,
    normalized_metrics JSONB,
    weight_distribution JSONB,
    evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_models_user_id ON models(user_id);
CREATE INDEX IF NOT EXISTS idx_datasets_user_id ON datasets(user_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_user_id ON evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_model_id ON evaluations(model_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_dataset_id ON evaluations(dataset_id);
```

### 2.3 Create Storage Buckets

1. Go to **Storage** in Supabase dashboard
2. Create two buckets:
   - Bucket name: `models`
   - Bucket name: `datasets`
3. Set both buckets to **Public** (or configure appropriate policies)

---

## Step 3: Backend Setup (FastAPI)

### 3.1 Navigate to Backend Directory

```bash
cd backend
```

### 3.2 Create Virtual Environment

**Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3.3 Install Dependencies

```bash
pip install -r requirements.txt
```

### 3.4 Create `.env` File

Create a file named `.env` in the `backend` directory:

```env
# Supabase Configuration
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_KEY=YOUR_SERVICE_ROLE_KEY_HERE

# Storage Buckets
STORAGE_BUCKET_MODELS=models
STORAGE_BUCKET_DATASETS=datasets

# JWT Secret (generate a random secret key)
JWT_SECRET_KEY=your_super_secret_jwt_key_here_make_it_long_and_random
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS (adjust for production)
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:5173,http://127.0.0.1:8080

# Environment
ENVIRONMENT=development
```

**Important:** 
- Replace `YOUR_PROJECT_ID` with your actual Supabase project ID
- Replace `YOUR_SERVICE_ROLE_KEY_HERE` with your service_role key from Supabase
- Generate a secure random string for `JWT_SECRET_KEY`

### 3.5 Start Backend Server

```bash
python -m uvicorn main:app --reload --port 8000
```

The backend will be available at: `http://localhost:8000`

API documentation: `http://localhost:8000/docs`

---

## Step 4: Frontend Setup (React + Vite)

### 4.1 Navigate to Project Root

```bash
cd ..
```

### 4.2 Install Dependencies

**Using npm:**
```bash
npm install
```

**Using bun (alternative):**
```bash
bun install
```

### 4.3 Create `.env` File

Create a file named `.env` in the **root** directory (not in `src`):

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```

**Important:** 
- Replace with your actual Supabase URL and anon key
- Note: We use Supabase ONLY for storage, NOT for authentication

### 4.4 Start Frontend Server

```bash
npm run dev
```

The frontend will be available at: `http://localhost:8080` (or the port shown in terminal)

---

## Step 5: Create Test Files (Optional)

To test the system, create sample model and dataset files:

### 5.1 Create Test Model

```bash
python backend\create_test_model.py
```

This creates `test_model_sklearn.pkl` in the project root.

### 5.2 Create Test Dataset

```bash
python backend\create_test_dataset.py
```

This creates `test_dataset.csv` (200 rows, 5 columns) in the project root.

---

## Step 6: Using the Application

### 6.1 Sign Up

1. Open `http://localhost:8080` in your browser
2. Click **Sign Up**
3. Enter email, password, and username
4. Submit

### 6.2 Login

1. Go to **Login** page
2. Enter your credentials
3. You'll be redirected to the Dashboard

### 6.3 Upload Files

1. Go to **Upload** page
2. Upload a model file (`.pkl`, `.pt`, `.h5`, `.pth`)
3. Upload a dataset file (`.csv`)

### 6.4 Evaluate Models

1. Go to **Evaluate** page
2. Select a model from dropdown
3. Select a dataset from dropdown
4. Click **Evaluate**
5. View results with metrics and EvalScore

### 6.5 Compare Models

1. Go to **Compare** page
2. Click **Add Pair** to add model-dataset pairs
3. Select different models and datasets for each pair
4. Add at least 2 pairs
5. Click **Compare**
6. View comprehensive comparison with charts and insights

---

## Step 7: Troubleshooting

### Backend Issues

**Problem:** `ModuleNotFoundError`
```bash
# Make sure virtual environment is activated
pip install -r requirements.txt
```

**Problem:** Supabase connection errors
- Verify `.env` file has correct credentials
- Check Supabase project is active
- Ensure service_role key is used (not anon key)

**Problem:** Port 8000 already in use
```bash
# Use a different port
python -m uvicorn main:app --reload --port 8001
# Update VITE_API_BASE_URL in frontend .env accordingly
```

### Frontend Issues

**Problem:** Module not found errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
```

**Problem:** CORS errors
- Ensure backend `.env` has correct `ALLOWED_ORIGINS`
- Restart backend server after changing `.env`

**Problem:** Blank page after comparison
- Open browser console (F12) to check for errors
- Ensure both model and dataset are uploaded
- Verify backend is running and accessible

---

## Development Notes

### Authentication Flow
- 100% FastAPI-based authentication (NO Supabase Auth)
- JWT tokens stored in localStorage
- Tokens automatically loaded on page refresh
- Access token expires after 24 hours
- Refresh token expires after 7 days

### File Structure
- Models stored in Supabase Storage bucket: `models`
- Datasets stored in Supabase Storage bucket: `datasets`
- Metadata stored in PostgreSQL tables
- File paths: `{user_id}/{filename}`

### SMCP Evaluation Pipeline
- Supports: scikit-learn, PyTorch, TensorFlow
- Task types: classification, regression
- Metrics: accuracy, precision, recall, f1, r2, mae, rmse
- EvalScore: weighted normalized metric (0-100)

---

## Production Deployment

### Backend
1. Set `ENVIRONMENT=production` in `.env`
2. Use production Supabase project
3. Update `ALLOWED_ORIGINS` with production frontend URL
4. Deploy to: Heroku, Railway, AWS, Google Cloud, etc.
5. Use proper WSGI server (Gunicorn with Uvicorn workers)

### Frontend
1. Update `.env` with production API URL
2. Build: `npm run build`
3. Deploy `dist/` folder to: Vercel, Netlify, AWS S3, etc.

---

## Support

For issues or questions:
1. Check browser console (F12) for frontend errors
2. Check backend terminal for API errors
3. Verify all `.env` files are configured correctly
4. Ensure Supabase tables and buckets are created

---

## Quick Start Checklist

- [ ] Python 3.11+ installed
- [ ] Node.js 18+ installed
- [ ] Supabase project created
- [ ] Database tables created (SQL script)
- [ ] Storage buckets created (models, datasets)
- [ ] Backend `.env` configured
- [ ] Frontend `.env` configured
- [ ] Backend dependencies installed (`pip install -r requirements.txt`)
- [ ] Frontend dependencies installed (`npm install`)
- [ ] Backend running (`python -m uvicorn main:app --reload`)
- [ ] Frontend running (`npm run dev`)
- [ ] Sign up → Login → Upload → Evaluate → Compare

**Ready to build! 🚀**
