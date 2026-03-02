# Playwright E2E Testing

This directory contains end-to-end tests for EvalModel using [Playwright](https://playwright.dev/).

## Test Structure

```
tests/
├── homepage.spec.ts          # Homepage and basic navigation
├── auth.spec.ts              # Authentication flows
├── model-upload.spec.ts      # Model file uploads (.pkl, .joblib, .onnx)
├── dataset-upload.spec.ts    # Dataset CSV uploads
├── evaluation.spec.ts        # Complete evaluation workflow
└── insights-chat.spec.ts     # AI chat functionality
```

## Running Tests

### Prerequisites

1. **Install Playwright:**
   ```bash
   npm install
   npx playwright install chromium
   ```

2. **Create test user:**
   ```bash
   # Make sure backend is running first!
   cd backend
   uvicorn app.main:app --reload
   
   # In another terminal:
   node tests/scripts/create-test-user.js
   ```
   
   This creates a test user:
   - Email: `e2etest@evalmodel.com`
   - Password: `Test123456`

3. **Start backend server:**
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```
   
   The frontend will auto-start when you run tests.

### Run Commands

```bash
# Run all tests (headless)
npm run test:e2e

# Run with browser visible
npm run test:e2e:headed

# Debug mode (step through tests)
npm run test:e2e:debug

# UI mode (interactive test runner)
npm run test:e2e:ui

# View last test report
npm run test:e2e:report
```

### Run specific test file

```bash
npx playwright test tests/evaluation.spec.ts
```

### Run single test

```bash
npx playwright test tests/evaluation.spec.ts -g "complete evaluation flow"
```

## Test Philosophy

These tests follow the **full-stack validation** approach:
- Tests validate **actual user journeys** not individual components
- Each test covers **UI + API + Database** together
- Focus on **risk points**: uploads, evaluations, critical paths
- Avoid testing trivial things (colors, CSS, simple text)

### What We Test

✅ **Critical Paths:**
- Model upload → Registry → Evaluation → Results
- Dataset upload → Quality analysis → Insights
- Authentication → Protected routes
- AI chat → Backend API → Response rendering

❌ **What We Don't Test:**
- Individual CSS properties
- Button colors or animations
- Static text content
- Trivial UI elements

## CI/CD Integration

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests

See [`../../.github/workflows/playwright.yml`](../../.github/workflows/playwright.yml) for CI configuration.

### GitHub Actions Setup

Required secrets in GitHub repository settings:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL` (backend)
- `SUPABASE_SERVICE_KEY` (backend)

## Writing New Tests

### Best Practices

1. **Test real user flows:**
   ```typescript
   // ✅ Good - tests complete journey
   test('user uploads model and sees it in registry', async ({ page }) => {
     await page.goto('/upload');
     await uploadModel(page, 'model.pkl');
     await page.goto('/models');
     await expect(page.getByText('model.pkl')).toBeVisible();
   });
   
   // ❌ Bad - tests trivial detail
   test('upload button is blue', async ({ page }) => {
     const button = page.getByRole('button', { name: /upload/i });
     expect(await button.evaluate(el => getComputedStyle(el).color)).toBe('blue');
   });
   ```

2. **Use semantic selectors:**
   ```typescript
   // ✅ Good - resilient to UI changes
   await page.getByRole('button', { name: /upload/i }).click();
   
   // ❌ Bad - brittle, breaks easily
   await page.locator('.btn-primary-upload-submit').click();
   ```

3. **Wait for actual outcomes:**
   ```typescript
   // ✅ Good - waits for real result
   await expect(page.getByText(/success|uploaded/i)).toBeVisible({ timeout: 10000 });
   
   // ❌ Bad - arbitrary delay
   await page.waitForTimeout(5000);
   ```

4. **Handle async operations properly:**
   ```typescript
   // ✅ Good - waits for API response
   await page.waitForResponse(resp => resp.url().includes('/api/evaluate') && resp.status() === 200);
   
   // ❌ Bad - assumes timing
   await page.waitForTimeout(3000); // Maybe API is slow?
   ```

## Debugging Failed Tests

### View trace

```bash
npx playwright show-trace test-results/path-to-trace.zip
```

### Run with headed browser

```bash
npm run test:e2e:headed
```

### Debug specific test

```bash
npx playwright test tests/evaluation.spec.ts --debug
```

### Generate tests (record actions)

```bash
npx playwright codegen http://localhost:8080
```

## Test Data

Test models and datasets are in `test_models/`:
- `test_models/model.pkl` - Scikit-learn classification model
- `test_models/model.joblib` - Joblib serialized model
- `test_models/model.onnx` - ONNX format model
- `test_datasets/classification_test_data.csv`
- `test_datasets/regression_test_data.csv`

## Known Issues

### Tests failing in CI but passing locally?
- Check environment variables are set in GitHub secrets
- Verify backend is starting correctly (check workflow logs)
- Ensure timeouts are sufficient for slower CI environments

### File upload tests failing?
- Verify test model files exist in `test_models/` directory
- Check file paths are correct (use `path.join()`)
- Ensure proper CORS settings for local development

### Authentication tests failing?
- Create test user in Supabase first
- Set `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` in environment
- Check Supabase RLS policies allow test operations

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Test Recorder](https://playwright.dev/docs/codegen)
- [Debugging Guide](https://playwright.dev/docs/debug)
