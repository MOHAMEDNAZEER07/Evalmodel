import { test, expect } from '@playwright/test';

/**
 * Critical Path Test: Homepage & Navigation
 * 
 * This validates:
 * - App loads successfully
 * - Core navigation works
 * - Auth state is handled
 */

test.describe('EvalModel Homepage', () => {
  
  test('homepage loads and displays branding', async ({ page }) => {
    await page.goto('/');
    
    // Should show EvalModel branding
    await expect(page.getByText(/EvalModel/i)).toBeVisible();
    
    // Should have login/signup options for unauthenticated users
    const loginButton = page.getByRole('link', { name: /login|sign in/i });
    await expect(loginButton).toBeVisible();
  });

  test('navigation menu renders correctly', async ({ page }) => {
    await page.goto('/');
    
    // Check for main navigation links
    const navigation = page.locator('nav, header');
    await expect(navigation).toBeVisible();
  });

  test('responsive design works on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Should still be usable
    await expect(page.getByText(/EvalModel/i)).toBeVisible();
  });
});
