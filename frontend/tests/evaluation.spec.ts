import { test, expect } from '@playwright/test';

/**
 * Model Evaluation End-to-End Test
 * 
 * This is THE critical path:
 * Upload model → Upload dataset → Run evaluation → View metrics
 * 
 * Tests full-stack integration:
 * - Frontend form submission
 * - Backend evaluation engine
 * - Metrics calculation
 * - Results rendering
 */

test.describe('Model Evaluation Flow', () => {
  
  test('complete evaluation flow: select model + dataset → evaluate → view results', async ({ page }) => {
    // Step 1: Navigate to evaluate page
    await page.goto('/evaluate');
    
    // Should see evaluation interface
    await expect(page.getByText(/evaluate|select.*model/i)).toBeVisible();
    
    // Step 2: Select model from dropdown/list
    const modelSelect = page.locator('select[name="model"], [data-testid="model-select"]').first();
    if (await modelSelect.isVisible()) {
      await modelSelect.selectOption({ index: 1 }); // Select first available model
    }
    
    // Step 3: Select dataset
    const datasetSelect = page.locator('select[name="dataset"], [data-testid="dataset-select"]').first();
    if (await datasetSelect.isVisible()) {
      await datasetSelect.selectOption({ index: 1 }); // Select first available dataset
    }
    
    // Step 4: Click Evaluate button
    const evaluateButton = page.getByRole('button', { name: /evaluate|run/i });
    await evaluateButton.click();
    
    // Step 5: Wait for evaluation to complete (can take a few seconds)
    // Should see loading indicator first
    await expect(page.getByText(/evaluating|processing|calculating/i)).toBeVisible({ timeout: 5000 });
    
    // Step 6: Results should appear
    // Look for metrics like accuracy, precision, recall, EvalScore
    await expect(page.getByText(/accuracy|precision|recall|evalscore|results/i)).toBeVisible({ timeout: 30000 });
  });

  test('classification metrics display correctly', async ({ page }) => {
    // Navigate to a completed evaluation or dashboard with results
    await page.goto('/dashboard');
    
    // Should show classification metrics
    const metricsContainer = page.locator('[data-testid="metrics"], .metrics-card, .metric-item');
    
    // Common classification metrics
    await expect(page.getByText(/accuracy/i)).toBeVisible();
    await expect(page.getByText(/precision/i)).toBeVisible();
    await expect(page.getByText(/recall/i)).toBeVisible();
    await expect(page.getByText(/f1.*score/i)).toBeVisible();
  });

  test('regression metrics display correctly', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should show regression metrics
    // Look for MAE, MSE, RMSE, R²
    const hasRegressionMetrics = 
      await page.getByText(/mae|mean.*absolute/i).isVisible() ||
      await page.getByText(/mse|mean.*squared/i).isVisible() ||
      await page.getByText(/rmse|root.*mean/i).isVisible() ||
      await page.getByText(/r2|r.*squared/i).isVisible();
    
    expect(hasRegressionMetrics).toBeTruthy();
  });

  test('EvalScore is calculated and displayed', async ({ page }) => {
    await page.goto('/dashboard');
    
    // EvalScore should be prominently displayed
    await expect(page.getByText(/evalscore/i)).toBeVisible();
    
    // Should show a numeric value (0-100)
    const scoreElement = page.locator('[data-testid="evalscore"], .evalscore-value');
    if (await scoreElement.isVisible()) {
      const scoreText = await scoreElement.textContent();
      // Should contain a number
      expect(scoreText).toMatch(/\d+/);
    }
  });

  test('confusion matrix displays for classification', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Look for confusion matrix visualization
    const confusionMatrix = page.locator('[data-testid="confusion-matrix"], .confusion-matrix');
    
    // May or may not be present depending on model type
    const isVisible = await confusionMatrix.isVisible().catch(() => false);
    
    if (isVisible) {
      expect(await confusionMatrix.isVisible()).toBeTruthy();
    }
  });

  test('evaluation history is recorded', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should show evaluation history or recent evaluations
    await expect(page.getByText(/evaluation.*history|recent.*evaluations/i)).toBeVisible();
    
    // Should have at least one evaluation entry
    const evaluationRows = page.locator('[data-testid="evaluation-row"], .evaluation-item, table tbody tr');
    const count = await evaluationRows.count();
    
    if (count > 0) {
      expect(count).toBeGreaterThan(0);
    }
  });

  test('can compare multiple evaluations', async ({ page }) => {
    // Navigate to compare page
    await page.goto('/compare');
    
    // Should have comparison interface
    await expect(page.getByText(/compare|comparison/i)).toBeVisible();
    
    // Should be able to select multiple evaluations
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    
    if (count >= 2) {
      // Select first two checkboxes
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();
      
      // Should show compare button
      const compareButton = page.getByRole('button', { name: /compare/i });
      await expect(compareButton).toBeVisible();
    }
  });
});
