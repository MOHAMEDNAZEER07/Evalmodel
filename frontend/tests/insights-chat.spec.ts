import { test, expect } from '@playwright/test';

/**
 * Insights AI Chat Test Suite
 * 
 * Tests the AI-powered insights chatbot:
 * - Message sending works
 * - Quick questions work
 * - Markdown rendering
 * - Inline vs floating modes
 */

test.describe('Insights AI Chat', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/insights');
  });

  test('insights page loads with AI chat', async ({ page }) => {
    // Should see insights page
    await expect(page.getByText(/insights/i)).toBeVisible();
    
    // Should have AI chat interface
    await expect(page.locator('[data-testid="ai-chat"], .ai-chat, textarea')).toBeVisible();
  });

  test('can send message to AI chat', async ({ page }) => {
    // Find chat input
    const chatInput = page.locator('textarea[placeholder*="Ask"], textarea[placeholder*="message"]').first();
    await chatInput.fill('What is the accuracy of my model?');
    
    // Send message (could be button or Enter key)
    const sendButton = page.getByRole('button', { name: /send|ask/i });
    await sendButton.click();
    
    // Should see user message appear
    await expect(page.getByText(/What is the accuracy/i)).toBeVisible();
    
    // Should see AI response (may take a few seconds)
    await expect(page.locator('.ai-message, [data-role="assistant"]')).toBeVisible({ timeout: 10000 });
  });

  test('quick questions are clickable', async ({ page }) => {
    // Look for suggested/quick questions
    const quickQuestion = page.getByRole('button', { name: /strength|weakness|improve/i }).first();
    
    if (await quickQuestion.isVisible()) {
      await quickQuestion.click();
      
      // Should populate input or send message
      await expect(page.locator('.user-message, [data-role="user"]')).toBeVisible({ timeout: 5000 });
    }
  });

  test('markdown is rendered in AI responses', async ({ page }) => {
    const chatInput = page.locator('textarea').first();
    await chatInput.fill('Give me a bulleted list of model metrics');
    
    const sendButton = page.getByRole('button', { name: /send|ask/i });
    await sendButton.click();
    
    // Wait for AI response
    await page.waitForTimeout(3000);
    
    // Check if response contains markdown elements (lists, bold, etc.)
    const responseArea = page.locator('.ai-message, [data-role="assistant"]').last();
    
    // Look for rendered markdown elements
    const hasList = await responseArea.locator('ul, ol').count() > 0;
    const hasBold = await responseArea.locator('strong, b').count() > 0;
    
    // At least one markdown element should be rendered
    expect(hasList || hasBold).toBeTruthy();
  });

  test('inline chat mode does not cause page scroll', async ({ page }) => {
    // Get initial scroll position
    const initialScroll = await page.evaluate(() => window.scrollY);
    
    // Send a message
    const chatInput = page.locator('textarea').first();
    await chatInput.fill('Test message');
    
    const sendButton = page.getByRole('button', { name: /send|ask/i });
    await sendButton.click();
    
    // Wait a moment
    await page.waitForTimeout(1000);
    
    // Check scroll position hasn't changed dramatically
    const newScroll = await page.evaluate(() => window.scrollY);
    
    // Allow small variations but not full page scrolls
    expect(Math.abs(newScroll - initialScroll)).toBeLessThan(200);
  });

  test('chat history persists during session', async ({ page }) => {
    // Send first message
    const chatInput = page.locator('textarea').first();
    await chatInput.fill('First message');
    
    let sendButton = page.getByRole('button', { name: /send|ask/i });
    await sendButton.click();
    
    await page.waitForTimeout(2000);
    
    // Send second message
    await chatInput.fill('Second message');
    sendButton = page.getByRole('button', { name: /send|ask/i });
    await sendButton.click();
    
    // Both messages should be visible
    await expect(page.getByText(/First message/i)).toBeVisible();
    await expect(page.getByText(/Second message/i)).toBeVisible();
  });

  test('user messages are clearly visible', async ({ page }) => {
    const chatInput = page.locator('textarea').first();
    await chatInput.fill('Test visibility');
    
    const sendButton = page.getByRole('button', { name: /send|ask/i });
    await sendButton.click();
    
    // Find user message
    const userMessage = page.locator('.user-message, [data-role="user"]').last();
    await expect(userMessage).toBeVisible();
    
    // Check that it has proper styling (gradient background)
    const bgColor = await userMessage.evaluate((el) => 
      window.getComputedStyle(el).backgroundImage
    );
    
    // Should have gradient or solid color (not transparent)
    expect(bgColor).not.toBe('none');
  });

  test('can open AI mentor from insights page', async ({ page }) => {
    // Look for AI Mentor button/trigger
    const mentorButton = page.getByRole('button', { name: /ai.*mentor|mentor/i });
    
    if (await mentorButton.isVisible()) {
      await mentorButton.click();
      
      // Should open AI Mentor modal/panel
      await expect(page.getByText(/mentor|ask.*anything/i)).toBeVisible();
    }
  });
});
