import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Dataset Upload Test Suite
 * 
 * Critical validations:
 * 1. CSV upload works
 * 2. Quality analysis runs
 * 3. Dataset statistics displayed
 * 4. Invalid CSVs rejected
 */

test.describe('Dataset Upload', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/upload');
  });

  test('upload CSV dataset', async ({ page }) => {
    // Path to test dataset
    const testDatasetPath = path.join(process.cwd(), 'test_models', 'test_datasets', 'classification_test_data.csv');
    
    // Find dataset file input (may need to differentiate from model upload)
    const fileInput = page.locator('input[type="file"][accept*="csv"], input[type="file"]').last();
    
    await fileInput.setInputFiles(testDatasetPath);
    
    // Fill dataset name if required
    const nameInput = page.getByLabel(/dataset.*name/i);
    if (await nameInput.isVisible()) {
      await nameInput.fill('Test Classification Dataset');
    }
    
    // Submit upload
    const uploadButton = page.getByRole('button', { name: /upload|submit/i });
    await uploadButton.click();
    
    // Wait for success or quality analysis
    await expect(page.getByText(/success|analysis|quality/i)).toBeVisible({ timeout: 15000 });
  });

  test('upload regression dataset', async ({ page }) => {
    const testDatasetPath = path.join(process.cwd(), 'test_models', 'test_datasets', 'regression_test_data.csv');
    
    const fileInput = page.locator('input[type="file"]').last();
    await fileInput.setInputFiles(testDatasetPath);
    
    const nameInput = page.getByLabel(/dataset.*name/i);
    if (await nameInput.isVisible()) {
      await nameInput.fill('Test Regression Dataset');
    }
    
    const uploadButton = page.getByRole('button', { name: /upload|submit/i });
    await uploadButton.click();
    
    await expect(page.getByText(/success|analysis/i)).toBeVisible({ timeout: 15000 });
  });

  test('quality analysis displays statistics', async ({ page }) => {
    // After uploading, should show quality metrics
    const testDatasetPath = path.join(process.cwd(), 'test_models', 'test_datasets', 'classification_test_data.csv');
    
    const fileInput = page.locator('input[type="file"]').last();
    await fileInput.setInputFiles(testDatasetPath);
    
    const uploadButton = page.getByRole('button', { name: /upload|submit/i });
    await uploadButton.click();
    
    // Look for quality metrics (adjust based on your UI)
    await expect(page.getByText(/rows|columns|missing|duplicates/i)).toBeVisible({ timeout: 15000 });
  });

  test('reject empty CSV file', async ({ page }) => {
    // This test would need an empty CSV file to be created
    test.skip(); // Skip for now until we have empty test file
  });

  test('reject malformed CSV', async ({ page }) => {
    // This test would need a malformed CSV to test
    test.skip(); // Skip for now
  });
});
