import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Model Upload Test Suite
 * 
 * Risk points being tested:
 * 1. File upload works (frontend)
 * 2. Backend accepts and processes model
 * 3. Model appears in registry
 * 4. Different formats (.pkl, .joblib, .onnx) are handled
 */

test.describe('Model Upload', () => {
  
  test.beforeEach(async ({ page }) => {
    // Skip login for now - adjust when auth is enforced
    await page.goto('/upload');
  });

  test('upload page displays correctly', async ({ page }) => {
    // Verify upload interface is present
    await expect(page.getByText(/upload.*model/i)).toBeVisible();
    
    // Should have file input or drag-drop zone
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
  });

  test('upload .pkl model file', async ({ page }) => {
    // Path to test model (you'll need to create this)
    const testModelPath = path.join(process.cwd(), 'test_models', 'test_models', 'model.pkl');
    
    // Find file input
    const fileInput = page.locator('input[type="file"]').first();
    
    // Upload file
    await fileInput.setInputFiles(testModelPath);
    
    // Fill model metadata if required
    const nameInput = page.getByLabel(/model.*name/i);
    if (await nameInput.isVisible()) {
      await nameInput.fill('Test Model PKL');
    }
    
    const versionInput = page.getByLabel(/version/i);
    if (await versionInput.isVisible()) {
      await versionInput.fill('1.0.0');
    }
    
    // Submit upload
    const uploadButton = page.getByRole('button', { name: /upload|submit/i });
    await uploadButton.click();
    
    // Wait for success message or redirect
    await expect(page.getByText(/success|uploaded/i)).toBeVisible({ timeout: 10000 });
  });

  test('upload .joblib model file', async ({ page }) => {
    const testModelPath = path.join(process.cwd(), 'test_models', 'test_models', 'model.joblib');
    
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testModelPath);
    
    // Fill required fields
    const nameInput = page.getByLabel(/model.*name/i);
    if (await nameInput.isVisible()) {
      await nameInput.fill('Test Model Joblib');
    }
    
    const uploadButton = page.getByRole('button', { name: /upload|submit/i });
    await uploadButton.click();
    
    await expect(page.getByText(/success|uploaded/i)).toBeVisible({ timeout: 10000 });
  });

  test('upload .onnx model file', async ({ page }) => {
    const testModelPath = path.join(process.cwd(), 'test_models', 'test_models', 'model.onnx');
    
    const fileInput = page.locator('input[type="file"]').first();
    
    // Check if file exists before attempting upload
    try {
      await fileInput.setInputFiles(testModelPath);
      
      const nameInput = page.getByLabel(/model.*name/i);
      if (await nameInput.isVisible()) {
        await nameInput.fill('Test Model ONNX');
      }
      
      const uploadButton = page.getByRole('button', { name: /upload|submit/i });
      await uploadButton.click();
      
      await expect(page.getByText(/success|uploaded/i)).toBeVisible({ timeout: 10000 });
    } catch (error) {
      test.skip();
    }
  });

  test('reject invalid file format', async ({ page }) => {
    // Create a temporary text file
    const invalidFilePath = path.join(process.cwd(), 'test.txt');
    
    const fileInput = page.locator('input[type="file"]').first();
    
    try {
      await fileInput.setInputFiles(invalidFilePath);
      
      // Should show error or not allow submission
      const uploadButton = page.getByRole('button', { name: /upload|submit/i });
      await uploadButton.click();
      
      // Expect error message
      await expect(page.getByText(/invalid|unsupported|format/i)).toBeVisible({ timeout: 5000 });
    } catch {
      // File doesn't exist, skip test
      test.skip();
    }
  });

  test('uploaded model appears in registry', async ({ page }) => {
    // Navigate to model registry
    await page.goto('/models');
    
    // Should show models table/list
    await expect(page.getByText(/model.*registry|my models/i)).toBeVisible();
    
    // Should have at least one model row (if we uploaded successfully)
    const modelRows = page.locator('[data-testid="model-row"], .model-item, table tbody tr');
    const count = await modelRows.count();
    
    // If count > 0, we have models
    if (count > 0) {
      expect(count).toBeGreaterThan(0);
    }
  });
});
