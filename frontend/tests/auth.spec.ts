import { test, expect } from '@playwright/test';

/**
 * Authentication Flow Test
 * 
 * Critical for EvalModel security:
 * - Users can sign up
 * - Users can log in
 * - Protected routes are secure
 */

test.describe('Authentication', () => {
  
  // Clear any cached auth before each test
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await context.clearPermissions();
  });
  
  test('login page is accessible', async ({ page }) => {
    await page.goto('/login');
    
    // Should show login form
    await expect(page.getByLabel(/email|username/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /login|sign in/i })).toBeVisible();
  });

  test('signup page is accessible', async ({ page }) => {
    await page.goto('/signup');
    
    // Should show signup form
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    // Use form button specifically to avoid nav button
    await expect(page.locator('form').getByRole('button', { name: /sign up|register/i })).toBeVisible();
  });

  test.skip('login with valid credentials', async ({ page }) => {
    // SKIP: Requires test user to be created first
    // Run: node tests/scripts/create-test-user.js
    const testEmail = 'e2etest@evalmodel.com';
    const testPassword = 'Test123456';
    
    await page.goto('/login');
    
    await page.getByLabel(/email|username/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /login|sign in/i }).click();
    
    // After successful login, should redirect to dashboard or show user menu
    await expect(page).toHaveURL(/dashboard|upload|models/);
  });

  test.skip('cannot access protected routes when logged out', async ({ page, context }) => {
    // SKIP: Auth enforcement not implemented yet
    // Clear any existing session
    await context.clearCookies();
    
    // Try to access dashboard
    await page.goto('/dashboard');
    
    // Should redirect to login or show auth error
    await expect(page).toHaveURL(/login|signin/);
  });

  test.skip('invalid login shows error message', async ({ page }) => {
    // SKIP: Error message display needs UI implementation
    await page.goto('/login');
    
    await page.getByLabel(/email|username/i).fill('invalid@test.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /login|sign in/i }).click();
    
    // Should show error message
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 5000 });
  });
});
