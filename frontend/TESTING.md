# Quick Start: Running Playwright E2E Tests

## 🚀 First Time Setup (Do Once)

### Step 1: Install Playwright
```bash
npm install
npx playwright install chromium
```

### Step 2: Create Test User
```bash
# Terminal 1: Start backend
cd backend
uvicorn app.main:app --reload

# Terminal 2: Create test user
node tests/scripts/create-test-user.js
```

This creates:
- **Email**: `e2etest@evalmodel.com`
- **Password**: `Test123456`

✅ You only need to do this once!

---

## ▶️ Running Tests (Every Time)

### Option 1: Auto-Start Frontend (Recommended)
```bash
# Terminal 1: Backend only
cd backend
uvicorn app.main:app --reload

# Terminal 2: Run tests (frontend auto-starts)
npm run test:e2e
```

### Option 2: Manual Start (More Control)
```bash
# Terminal 1: Backend
cd backend
uvicorn app.main:app --reload

# Terminal 2: Frontend
npm run dev

# Terminal 3: Tests
npm run test:e2e
```

---

## 📊 Test Commands

```bash
# Run all tests (headless)
npm run test:e2e

# See browser while testing
npm run test:e2e:headed

# Debug step-by-step
npm run test:e2e:debug

# Interactive UI mode
npm run test:e2e:ui

# View last report
npm run test:e2e:report

# Run specific test file
npx playwright test tests/auth.spec.ts

# Run single test
npx playwright test -g "homepage loads"
```

---

## 🔧 Troubleshooting

### "Connection refused" error
- Backend not running → Start with `uvicorn app.main:app --reload`

### Authentication tests failing
- Test user not created → Run `node tests/scripts/create-test-user.js`
- User exists with different password → Delete from Supabase, recreate

### "Password too long" error
- Your actual user password might be stored incorrectly
- The test user (e2etest@evalmodel.com) should work fine

### Tests timing out
- Increase timeout in `playwright.config.ts`:
  ```typescript
  timeout: 60 * 1000, // 60 seconds
  ```

---

## 🎯 What Gets Tested

✅ Authentication (login/signup)  
✅ Model uploads (.pkl, .joblib, .onnx)  
✅ Dataset uploads (CSV)  
✅ Full evaluation workflow  
✅ AI chat functionality  
✅ Results display  

---

## 🚨 Important Notes

1. **Backend MUST be running** - Tests will fail without it
2. **Frontend auto-starts** - Playwright starts it automatically
3. **Test user is separate** - Don't use your real account
4. **Clean state** - Each test runs independently

---

## 📁 Test Files

- `tests/auth.spec.ts` - Login/signup
- `tests/model-upload.spec.ts` - Model file uploads
- `tests/dataset-upload.spec.ts` - Dataset uploads
- `tests/evaluation.spec.ts` - **Critical path testing**
- `tests/insights-chat.spec.ts` - AI chat
- `tests/homepage.spec.ts` - Basic navigation

---

## 🔐 Managing Test User

### Create
```bash
node tests/scripts/create-test-user.js
```

### Delete
Go to Supabase → Table Editor → users → Delete row where email = `e2etest@evalmodel.com`

Or run SQL:
```sql
DELETE FROM users WHERE email = 'e2etest@evalmodel.com';
```

---

## ☁️ CI/CD (GitHub Actions)

Tests run automatically on:
- Push to `main`/`develop`
- Pull requests

The workflow handles:
- Installing dependencies
- Starting backend/frontend
- Running all tests
- Uploading reports

See `.github/workflows/playwright.yml`
