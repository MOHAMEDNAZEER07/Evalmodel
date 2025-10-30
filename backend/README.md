# EvalModel Backend API

FastAPI backend for the EvalModel platform - Universal AI Model Evaluation & Comparison.

## Features

- **SMCP (Standardized Model Comparison Pipeline)**: Evaluate models across different domains
- **Multi-framework support**: scikit-learn, PyTorch, TensorFlow/Keras, ONNX
- **Model types**: Classification, Regression, NLP, Computer Vision
- **Supabase integration**: Authentication, storage, and database
- **RESTful API**: Complete CRUD operations for models, datasets, and evaluations

## Prerequisites

- Python 3.10+
- Supabase account and project
- Virtual environment (recommended)

## Quick Start

### 1. Environment Setup

Create a virtual environment:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 2. Install Dependencies

```powershell
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# API Settings
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=True

# CORS Origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Storage
MAX_UPLOAD_SIZE_MB=1024
STORAGE_BUCKET_MODELS=models
STORAGE_BUCKET_DATASETS=datasets
```

### 4. Setup Supabase Database

1. Go to your Supabase SQL Editor
2. Run the SQL script from `database_schema.sql`
3. Create storage buckets:
   - Navigate to **Storage** in Supabase Dashboard
   - Create bucket named `models` (public or private based on your needs)
   - Create bucket named `datasets`

### 5. Run the Server

```powershell
# Development mode (with auto-reload)
python main.py

# Or using uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/api/docs (Swagger UI)
- **ReDoc**: http://localhost:8000/api/redoc

## API Endpoints

### Authentication
- `GET /api/auth/me` - Get current user profile
- `POST /api/auth/github-oauth` - GitHub OAuth callback

### Models
- `POST /api/models/upload` - Upload a new model
- `GET /api/models/` - List all user's models
- `GET /api/models/{model_id}` - Get specific model
- `DELETE /api/models/{model_id}` - Delete a model

### Datasets
- `POST /api/datasets/upload` - Upload a dataset (CSV)
- `GET /api/datasets/` - List all user's datasets
- `GET /api/datasets/{dataset_id}` - Get specific dataset
- `GET /api/datasets/{dataset_id}/preview` - Preview dataset rows
- `DELETE /api/datasets/{dataset_id}` - Delete a dataset

### Evaluation (SMCP)
- `POST /api/evaluation/evaluate` - Evaluate a single model
- `POST /api/evaluation/compare` - Compare multiple models
- `GET /api/evaluation/history` - Get evaluation history

## SMCP Evaluation Engine

The Standardized Model Comparison Pipeline (SMCP) automatically:

1. **Detects model type** (Classification/Regression/NLP/CV)
2. **Loads the model** based on framework
3. **Computes metrics** specific to the model type:
   - **Classification**: Accuracy, Precision, Recall, F1
   - **Regression**: MAE, MSE, RMSE, R²
   - **NLP**: BLEU, ROUGE, Perplexity
   - **CV**: IoU, Dice Coefficient, Pixel Accuracy
4. **Calculates EvalScore** (0-100): Weighted normalized score
5. **Enables comparison**: Unified ranking across different model types

### Supported File Formats

| Extension | Framework | Model Type |
|-----------|-----------|------------|
| `.pkl` | scikit-learn | Any |
| `.pt`, `.pth` | PyTorch | Any |
| `.h5` | Keras/TensorFlow | Any |
| `.onnx` | ONNX | Any |

### Dataset Format

- **Format**: CSV files only
- **Structure**: Last column assumed to be target/label
- **Size limit**: Configured via `MAX_UPLOAD_SIZE_MB` (default: 1GB)

## Architecture

```
backend/
├── app/
│   ├── core/               # Core utilities
│   │   ├── config.py       # Settings and configuration
│   │   └── supabase_client.py
│   ├── models/             # Data models and schemas
│   │   └── schemas.py      # Pydantic models
│   ├── routes/             # API endpoints
│   │   ├── auth.py         # Authentication
│   │   ├── models.py       # Model management
│   │   ├── datasets.py     # Dataset management
│   │   └── evaluation.py   # SMCP evaluation
│   └── services/           # Business logic
│       └── smcp_engine.py  # SMCP core engine
├── main.py                 # FastAPI app entry point
├── requirements.txt        # Python dependencies
└── database_schema.sql     # Supabase database schema
```

## Development

### Testing API with Swagger UI

1. Start the server
2. Navigate to http://localhost:8000/api/docs
3. Use "Authorize" button to add your Supabase JWT token
4. Test endpoints interactively

### Adding New Model Types

To add support for a new model type:

1. Add enum to `ModelType` in `app/models/schemas.py`
2. Define metrics in `MetricsResult` schema
3. Add metric weights in `SMCPEngine.METRIC_WEIGHTS`
4. Implement evaluation method in `smcp_engine.py`

### Error Handling

All endpoints return standard error responses:

```json
{
  "error": "Error type",
  "detail": "Detailed error message"
}
```

Common HTTP status codes:
- `400` - Bad Request (validation error)
- `401` - Unauthorized (auth required)
- `404` - Not Found
- `500` - Internal Server Error

## Deployment

### Production Considerations

1. Set `DEBUG=False` in production
2. Use proper CORS origins (not `*`)
3. Use Supabase Service Role Key for admin operations
4. Configure proper logging
5. Use production-grade WSGI server (Gunicorn + Uvicorn)

### Example Production Command

```bash
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## Troubleshooting

### Import Errors
- Ensure all dependencies are installed: `pip install -r requirements.txt`
- Activate virtual environment

### Supabase Connection Issues
- Verify `SUPABASE_URL` and `SUPABASE_KEY` in `.env`
- Check Supabase project is active

### Model Loading Errors
- Ensure model file format matches framework
- Check file size limits
- Verify model was trained with compatible library versions

### Storage Upload Fails
- Verify storage buckets exist in Supabase
- Check bucket permissions (public/private)
- Ensure file size within limits

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
