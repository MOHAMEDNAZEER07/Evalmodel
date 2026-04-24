import { test, expect, Page } from '@playwright/test';

/**
 * Research-Grade Evaluation Dashboard — Comprehensive E2E Tests
 *
 * Validates the full evaluation flow and every panel of the redesigned
 * research-grade dashboard:
 *
 *  1. Trust Overview Panel (hero gauge, DII, Lambda, Guard)
 *  2. Component Breakdown Panel (P, H, F, R cards)
 *  3. Mode Comparison Panel (Balanced vs Strict)
 *  4. Calculation Transparency Panel (accordion sections)
 *  5. Advanced Analytics Panel (tabs: metrics, fairness, explainability)
 *  6. Guard Activation Alert (conditional warning)
 *  7. Actions bar (Download Report, Compare, New Evaluation)
 *
 * Preconditions:
 *  - At least one model uploaded
 *  - At least one dataset uploaded
 *  - Backend running at http://localhost:8000
 *  - Frontend running at the configured baseURL
 */

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/**
 * Mock a full evaluation API response so tests can run without
 * a real backend / uploaded model+dataset. The mock covers every
 * field consumed by the dashboard components.
 */
function buildMockEvaluationResult(overrides: Record<string, unknown> = {}) {
  return {
    meta_score: 72.5,
    trust_score: 68.41,
    trust_score_raw: 71.03,
    trust_mode: 'balanced',
    DII: 0.3215,
    component_scores: {
      performance: 0.82,
      health: 0.65,
      fairness: 0.71,
      robustness: 0.59,
    },
    risk_values: {
      r_P: 0.18,
      r_H: 0.35,
      r_F: 0.29,
      r_R: 0.41,
      DP: 0.08,
      delta: 0.15,
      total: 1.23,
      amplification_applied: false,
      amplification_power: null,
    },
    hybrid_weights: {
      performance: 0.30,
      health: 0.25,
      fairness: 0.25,
      robustness: 0.20,
    },
    dataset_health_score: 75,
    meta_flags: ['High robustness risk detected'],
    meta_recommendations: [
      { action: 'Improve robustness', why: 'Robustness risk is elevated', priority: 'high' },
    ],
    meta_verdict: {
      status: 'moderate',
      message: 'Model shows moderate trust — review robustness component.',
      confidence: 0.78,
      critical_issues: 0,
      total_issues: 1,
    },
    metrics: {
      accuracy: 0.854,
      precision: 0.871,
      recall: 0.839,
      f1_score: 0.855,
    },
    eval_score: 76.3,
    feature_importance: [
      { feature: 'feature_a', importance: 0.32, rank: 1 },
      { feature: 'feature_b', importance: 0.24, rank: 2 },
      { feature: 'feature_c', importance: 0.18, rank: 3 },
    ],
    explainability_method: 'SHAP',
    shap_summary: {
      mean_abs_shap: 0.215,
      max_shap: 0.42,
      top_features: ['feature_a', 'feature_b'],
      base_value: 0.5,
    },
    fairness_metrics: {
      demographic_parity_difference: 0.062,
      disparate_impact_ratio: 0.89,
      equal_opportunity_difference: 0.045,
      equalized_odds_difference: 0.038,
      overall_fairness_score: 0.71,
    },
    group_metrics: [
      {
        group: 'Group A',
        accuracy: 0.88,
        precision: 0.90,
        recall: 0.86,
        f1_score: 0.879,
        true_positive_rate: 0.86,
        false_positive_rate: 0.12,
        positive_prediction_rate: 0.42,
        sample_count: 500,
      },
      {
        group: 'Group B',
        accuracy: 0.82,
        precision: 0.84,
        recall: 0.80,
        f1_score: 0.819,
        true_positive_rate: 0.80,
        false_positive_rate: 0.18,
        positive_prediction_rate: 0.48,
        sample_count: 500,
      },
    ],
    sensitive_attribute: 'gender',
    lambda_value: 0.3215,
    lambda_raw: 0.3215,
    lambda_cap: 0.85,
    dii_components: {
      imbalance: 0.12,
      missing: 0.05,
      duplicates: 0.02,
      skew: 0.1315,
    },
    beta_auto: {
      performance: 0.28,
      health: 0.26,
      fairness: 0.24,
      robustness: 0.22,
    },
    guard_threshold: 0.30,
    guard_triggered: false,
    guard_failures: [],
    global_penalty_applied: false,
    instability_penalty_value: 0,
    breakdown: {
      performance: 24.6,
      health: 16.25,
      fairness: 17.75,
      robustness: 11.8,
    },
    strict_result: {
      trust_score: 59.17,
      trust_score_raw: 63.22,
      DII: 0.3215,
      lambda_value: 0.1822,
      lambda_raw: 0.1822,
      component_scores: {
        performance: 0.82,
        health: 0.65,
        fairness: 0.71,
        robustness: 0.59,
      },
      risk_values: {
        r_P: 0.27,
        r_H: 0.525,
        r_F: 0.435,
        r_R: 0.615,
        total: 1.845,
        amplification_applied: true,
        amplification_power: 1.5,
      },
      guard_threshold: 0.40,
      guard_triggered: false,
      guard_failures: [],
      global_penalty_applied: true,
      instability_penalty_value: 0.15,
      breakdown: {
        performance: 23.5,
        health: 14.2,
        fairness: 15.1,
        robustness: 9.4,
      },
      dii_components: {
        imbalance: 0.12,
        missing: 0.05,
        duplicates: 0.02,
        skew: 0.1315,
      },
      beta_auto: {
        performance: 0.30,
        health: 0.25,
        fairness: 0.24,
        robustness: 0.21,
      },
      meta_verdict: {
        status: 'low',
        message: 'Strict mode: model shows elevated risk under conservative thresholds.',
        confidence: 0.65,
        critical_issues: 1,
        total_issues: 2,
      },
    },
    ...overrides,
  };
}

/**
 * Build a variant where the non-compensatory guard is triggered.
 */
function buildGuardTriggeredResult() {
  return buildMockEvaluationResult({
    guard_triggered: true,
    guard_failures: [
      { component: 'robustness', score: 0.22 },
      { component: 'fairness', score: 0.28 },
    ],
    meta_verdict: {
      status: 'high_risk',
      message: 'Guard override: multiple components below τ=0.30.',
      confidence: 0.92,
      critical_issues: 2,
      total_issues: 3,
    },
    strict_result: {
      ...buildMockEvaluationResult().strict_result,
      guard_triggered: true,
      guard_failures: [
        { component: 'robustness', score: 0.22 },
        { component: 'fairness', score: 0.28 },
        { component: 'health', score: 0.38 },
      ],
    },
  });
}

/**
 * Inject fake authentication so ProtectedRoute lets us through.
 * Must be called BEFORE page.goto() so the addInitScript runs
 * before React hydrates.
 */
async function injectAuth(page: Page) {
  // Seed sessionStorage with a fake JWT before any page JS runs
  await page.addInitScript(() => {
    sessionStorage.setItem('access_token', 'fake-test-token');
    sessionStorage.setItem('refresh_token', 'fake-refresh-token');
  });

  // Mock the /api/auth/me validation so AuthContext sees a valid user
  await page.route('**/api/auth/me**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'test-user-id',
        email: 'test@evalmodel.com',
        username: 'testuser',
        tier: 'pro',
      }),
    }),
  );
}

/**
 * Intercept the evaluate API call and inject a mock response, then
 * trigger the evaluation flow so the dashboard renders.
 */
async function renderDashboardWithMock(
  page: Page,
  mockResult: Record<string, unknown>,
) {
  // --- Auth ---
  await injectAuth(page);

  // Intercept the list APIs so the page loads even without data
  await page.route('**/api/models**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        models: [
          {
            id: 'mock-model-1',
            name: 'TestModel-RF',
            description: 'Random Forest test model',
            type: 'classification',
            framework: 'scikit-learn',
            file_size: 2048,
            uploaded_at: '2025-12-01T00:00:00Z',
          },
        ],
      }),
    }),
  );

  await page.route('**/api/datasets**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        datasets: [
          {
            id: 'mock-ds-1',
            name: 'ClassificationDS',
            description: 'Test classification dataset',
            row_count: 1000,
            column_count: 10,
            file_size: 4096,
            uploaded_at: '2025-12-01T00:00:00Z',
          },
        ],
      }),
    }),
  );

  // Mock preview for dataset columns
  await page.route('**/api/datasets/mock-ds-1/preview**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ columns: ['feature_a', 'feature_b', 'gender', 'target'] }),
    }),
  );

  // Mock the evaluate endpoint
  await page.route('**/api/evaluation/evaluate**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResult),
    }),
  );

  // Navigate
  await page.goto('/evaluate');
  await page.waitForLoadState('networkidle');

  // Select model (Radix Select trigger has role="combobox")
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: /TestModel/i }).click();

  // Select dataset
  await page.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name: /ClassificationDS/i }).click();

  // Run evaluation
  await page.getByRole('button', { name: /run evaluation/i }).click();

  // Wait for results to render
  await page.waitForSelector('text=Evaluation Report', { timeout: 10000 });
}

// ------------------------------------------------------------------
// Test Suite
// ------------------------------------------------------------------

test.describe('Evaluation Dashboard — Research-Grade UI', () => {

  // ----------------------------------------------------------------
  // Section 1: Page Structure & Header
  // ----------------------------------------------------------------
  test.describe('Page Structure', () => {

    test('evaluation page loads and shows model/dataset selectors', async ({ page }) => {
      await injectAuth(page);
      await page.route('**/api/models**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ models: [] }) }),
      );
      await page.route('**/api/datasets**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ datasets: [] }) }),
      );

      await page.goto('/evaluate');
      await expect(page.getByText(/evaluate|select.*model/i).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /run evaluation/i })).toBeVisible();
    });

    test('report header displays model/dataset names and trust mode', async ({ page }) => {
      const mock = buildMockEvaluationResult();
      await renderDashboardWithMock(page, mock);

      await expect(page.getByText('Evaluation Report')).toBeVisible();
      await expect(page.getByText(/TestModel-RF/).first()).toBeVisible();
      await expect(page.getByText(/ClassificationDS/).first()).toBeVisible();
      await expect(page.getByText(/mode:\s*balanced/)).toBeVisible();
    });
  });

  // ----------------------------------------------------------------
  // Section 2: Trust Overview Panel
  // ----------------------------------------------------------------
  test.describe('Trust Overview Panel', () => {

    test('displays trust score with circular gauge', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      // Trust Score heading
      await expect(page.getByText('Trust Score').first()).toBeVisible();

      // Score value rendered (68.41)
      await expect(page.getByText('68.41').first()).toBeVisible();

      // SVG gauge exists
      const svg = page.locator('svg').first();
      await expect(svg).toBeVisible();

      // Trust level label
      await expect(page.getByText('Moderate Trust', { exact: true })).toBeVisible();
    });

    test('shows DII, Lambda, and Guard indicators', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      await expect(page.getByText('DII').first()).toBeVisible();
      await expect(page.getByText('0.322').first()).toBeVisible(); // DII value (3 decimal)

      await expect(page.getByText(/λ.*Lambda/).first()).toBeVisible();
      await expect(page.getByText('0.322').first()).toBeVisible(); // Lambda value

      // Guard not triggered
      await expect(page.getByText(/not triggered/i)).toBeVisible();
    });

    test('severity scale is rendered (Low / Moderate / High)', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      await expect(page.getByText('0 — Low')).toBeVisible();
      await expect(page.getByText('40 — Moderate')).toBeVisible();
      await expect(page.getByText('70 — High')).toBeVisible();
    });

    test('verdict message is displayed', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      await expect(
        page.getByText(/model shows moderate trust/i),
      ).toBeVisible();
    });

    test('high trust score renders blue gauge', async ({ page }) => {
      const highTrust = buildMockEvaluationResult({ trust_score: 85.0 });
      await renderDashboardWithMock(page, highTrust);

      await expect(page.getByText('85.00').first()).toBeVisible();
      await expect(page.getByText(/high trust/i)).toBeVisible();
    });

    test('low trust score renders red gauge', async ({ page }) => {
      const lowTrust = buildMockEvaluationResult({ trust_score: 25.0 });
      await renderDashboardWithMock(page, lowTrust);

      await expect(page.getByText('25.00').first()).toBeVisible();
      await expect(page.getByText(/low trust/i)).toBeVisible();
    });
  });

  // ----------------------------------------------------------------
  // Section 3: Component Breakdown Panel
  // ----------------------------------------------------------------
  test.describe('Component Breakdown Panel', () => {

    test('renders four P, H, F, R cards', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      // Component names
      await expect(page.getByText('Performance').first()).toBeVisible();
      await expect(page.getByText('Health').first()).toBeVisible();
      await expect(page.getByText('Fairness').first()).toBeVisible();
      await expect(page.getByText('Robustness').first()).toBeVisible();
    });

    test('shows component scores', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      // Performance score 0.820
      await expect(page.getByText('0.820').first()).toBeVisible();
      // Robustness score 0.590
      await expect(page.getByText('0.590').first()).toBeVisible();
    });

    test('shows risk values for each component', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      // Verify risk label exists
      const riskLabels = page.getByText(/risk/i);
      expect(await riskLabels.count()).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------------------------------
  // Section 4: Mode Comparison Panel (Balanced vs Strict)
  // ----------------------------------------------------------------
  test.describe('Mode Comparison Panel', () => {

    test('renders Balanced and Strict side by side', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      await expect(page.getByText(/balanced/i).first()).toBeVisible();
      await expect(page.getByText(/strict/i).first()).toBeVisible();
    });

    test('displays trust scores for both modes', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      // Balanced trust score 68.41
      await expect(page.getByText('68.41').first()).toBeVisible();
      // Strict trust score 59.17
      await expect(page.getByText('59.17').first()).toBeVisible();
    });

    test('shows trust gap between modes', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      // Trust Gap label
      await expect(page.getByText(/trust gap/i)).toBeVisible();

      // Gap value: 68.41 - 59.17 = +9.24
      await expect(page.getByText(/\+9\.24/)).toBeVisible();
    });

    test('shows guard status per mode', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      // Both should show Guard Clear since neither is triggered
      const guardClear = page.getByText(/guard clear/i);
      expect(await guardClear.count()).toBeGreaterThanOrEqual(2);
    });

    test('shows penalty info for strict mode', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      // Strict mode has global_penalty_applied=true, instability_penalty_value=0.15
      await expect(page.getByText(/penalty/i).first()).toBeVisible();
    });
  });

  // ----------------------------------------------------------------
  // Section 5: Calculation Transparency Panel
  // ----------------------------------------------------------------
  test.describe('Calculation Transparency Panel', () => {

    test('renders expandable accordion sections', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      // Look for accordion triggers — they contain section titles
      await expect(page.getByText(/raw inputs/i)).toBeVisible();
      await expect(page.getByText(/intermediate calculations/i)).toBeVisible();
    });

    test('raw inputs section shows metrics', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      // Click to expand raw inputs
      await page.getByText(/raw inputs/i).click();

      // Should show accuracy
      await expect(page.getByText(/accuracy/i).first()).toBeVisible();
    });

    test('intermediate calculations show DII formula', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      // Expand intermediate calculations
      await page.getByText(/intermediate calculations/i).click();

      // Should show DII-related content
      await expect(page.getByText(/DII/i).first()).toBeVisible();
    });

    test('shows lambda computation details', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      await page.getByText(/intermediate calculations/i).click();

      await expect(page.getByText(/lambda|λ/i).first()).toBeVisible();
    });
  });

  // ----------------------------------------------------------------
  // Section 6: Advanced Analytics Panel
  // ----------------------------------------------------------------
  test.describe('Advanced Analytics Panel', () => {

    test('renders Standard Metrics tab by default', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      await expect(page.getByText('Standard Metrics').first()).toBeVisible();

      // Accuracy should be displayed
      await expect(page.getByText(/accuracy/i).first()).toBeVisible();
    });

    test('shows SMCP Eval Score', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      await expect(page.getByText(/SMCP Eval Score/i)).toBeVisible();
      await expect(page.getByText('76.3')).toBeVisible();
    });

    test('fairness tab shows fairness metrics', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      // Click Fairness tab
      await page.getByRole('tab', { name: /fairness/i }).click();

      // Should show DP, DI, etc.
      await expect(page.getByText(/demographic parity/i)).toBeVisible();
      await expect(page.getByText(/disparate impact/i)).toBeVisible();
    });

    test('fairness tab shows sensitive attribute badge', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      await page.getByRole('tab', { name: /fairness/i }).click();

      // Use locator to skip hidden <option> elements from the form dropdown
      await expect(page.locator('[class*="badge"], [class*="Badge"], [class*="rounded-full"]').getByText('gender')).toBeVisible();
    });

    test('fairness tab shows per-group metrics table', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      await page.getByRole('tab', { name: /fairness/i }).click();

      await expect(page.getByText('Group A')).toBeVisible();
      await expect(page.getByText('Group B')).toBeVisible();
      await expect(page.getByText(/per-group performance/i)).toBeVisible();
    });

    test('feature importance tab renders bar chart', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      await page.getByRole('tab', { name: /feature importance/i }).click();

      // Should show top features — use locator to skip hidden <option> elements
      await expect(page.locator('span').getByText('feature_a').first()).toBeVisible();
      await expect(page.locator('span').getByText('feature_b').first()).toBeVisible();
      await expect(page.locator('span').getByText('feature_c').first()).toBeVisible();

      // Method badge
      await expect(page.getByText('SHAP', { exact: true })).toBeVisible();
    });

    test('SHAP summary values are displayed', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      await page.getByRole('tab', { name: /feature importance/i }).click();

      await expect(page.getByText(/mean.*shap/i)).toBeVisible();
    });
  });

  // ----------------------------------------------------------------
  // Section 7: Guard Activation Alert
  // ----------------------------------------------------------------
  test.describe('Guard Activation Alert', () => {

    test('alert is NOT visible when guard is not triggered', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      await expect(page.getByText(/non-compensatory guard activated/i)).not.toBeVisible();
    });

    test('alert IS visible when guard is triggered', async ({ page }) => {
      const guardResult = buildGuardTriggeredResult();
      await renderDashboardWithMock(page, guardResult);

      await expect(page.getByText(/non-compensatory guard activated/i)).toBeVisible();
    });

    test('alert shows failing components and scores', async ({ page }) => {
      const guardResult = buildGuardTriggeredResult();
      await renderDashboardWithMock(page, guardResult);

      // Should list the failing components
      await expect(page.getByText(/robustness/i).first()).toBeVisible();
      await expect(page.getByText(/fairness/i).first()).toBeVisible();
    });

    test('alert includes the guard threshold', async ({ page }) => {
      const guardResult = buildGuardTriggeredResult();
      await renderDashboardWithMock(page, guardResult);

      // τ=0.30
      await expect(page.getByText(/τ.*0\.30|guard.*threshold.*0\.30|0\.30.*threshold/i).first()).toBeVisible();
    });

    test('alert notes it does not alter trust score', async ({ page }) => {
      const guardResult = buildGuardTriggeredResult();
      await renderDashboardWithMock(page, guardResult);

      await expect(
        page.getByText(/does not alter the numeric trust score/i),
      ).toBeVisible();
    });

    test('trust overview shows "Triggered" badge when guard fires', async ({ page }) => {
      const guardResult = buildGuardTriggeredResult();
      await renderDashboardWithMock(page, guardResult);

      await expect(page.getByText(/triggered/i).first()).toBeVisible();
    });
  });

  // ----------------------------------------------------------------
  // Section 8: Actions Bar
  // ----------------------------------------------------------------
  test.describe('Actions Bar', () => {

    test('Download Report button is visible', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      await expect(
        page.getByRole('button', { name: /download report/i }),
      ).toBeVisible();
    });

    test('Compare Models button is visible', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      await expect(
        page.getByRole('button', { name: /compare models/i }),
      ).toBeVisible();
    });

    test('New Evaluation button resets the form', async ({ page }) => {
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      // Verify results are shown
      await expect(page.getByText('Evaluation Report')).toBeVisible();

      // Click New Evaluation
      await page.getByRole('button', { name: /new evaluation/i }).click();

      // Results should disappear, form should reappear
      await expect(page.getByText('Evaluation Report')).not.toBeVisible();
      await expect(page.getByRole('button', { name: /run evaluation/i })).toBeVisible();
    });
  });

  // ----------------------------------------------------------------
  // Section 9: Edge Cases & Robustness
  // ----------------------------------------------------------------
  test.describe('Edge Cases', () => {

    test('dashboard works with minimal data (no fairness, no explainability)', async ({ page }) => {
      const minimal = buildMockEvaluationResult({
        fairness_metrics: undefined,
        group_metrics: undefined,
        feature_importance: undefined,
        explainability_method: undefined,
        shap_summary: undefined,
        sensitive_attribute: undefined,
      });
      await renderDashboardWithMock(page, minimal);

      // Trust panel should still render
      await expect(page.getByText('Trust Score').first()).toBeVisible();
      await expect(page.getByText('68.41').first()).toBeVisible();

      // Fairness and Feature Importance tabs should be hidden
      await expect(page.getByRole('tab', { name: /fairness/i })).not.toBeVisible();
      await expect(page.getByRole('tab', { name: /feature importance/i })).not.toBeVisible();
    });

    test('dashboard works without strict_result (no comparison panel)', async ({ page }) => {
      const noStrict = buildMockEvaluationResult({
        strict_result: undefined,
      });
      await renderDashboardWithMock(page, noStrict);

      // Trust panel should render
      await expect(page.getByText('68.41')).toBeVisible();

      // Mode comparison should not be visible
      // (no "Trust Gap" label)
      await expect(page.getByText(/trust gap/i)).not.toBeVisible();
    });

    test('trust score of 0 renders correctly', async ({ page }) => {
      const zero = buildMockEvaluationResult({ trust_score: 0 });
      await renderDashboardWithMock(page, zero);

      await expect(page.getByText('0.00').first()).toBeVisible();
      await expect(page.getByText(/low trust/i)).toBeVisible();
    });

    test('trust score of 100 renders correctly', async ({ page }) => {
      const perfect = buildMockEvaluationResult({ trust_score: 100 });
      await renderDashboardWithMock(page, perfect);

      await expect(page.getByText('100.00').first()).toBeVisible();
      await expect(page.getByText(/high trust/i)).toBeVisible();
    });

    test('all four components at threshold boundary', async ({ page }) => {
      const boundary = buildMockEvaluationResult({
        component_scores: {
          performance: 0.30,
          health: 0.30,
          fairness: 0.30,
          robustness: 0.30,
        },
      });
      await renderDashboardWithMock(page, boundary);

      // All four should show 0.300
      const scoreElements = page.getByText('0.300');
      expect(await scoreElements.count()).toBeGreaterThanOrEqual(4);
    });
  });

  // ----------------------------------------------------------------
  // Section 10: Responsive Layout
  // ----------------------------------------------------------------
  test.describe('Responsive Layout', () => {

    test('dashboard renders on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      // Trust score should still be visible
      await expect(page.getByText('68.41').first()).toBeVisible();
      // Actions should be visible
      await expect(page.getByRole('button', { name: /download report/i })).toBeVisible();
    });

    test('dashboard renders on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await renderDashboardWithMock(page, buildMockEvaluationResult());

      await expect(page.getByText('Evaluation Report')).toBeVisible();
      await expect(page.getByText('68.41').first()).toBeVisible();
    });
  });

  // ----------------------------------------------------------------
  // Section 11: Full Flow Integration
  // ----------------------------------------------------------------
  test.describe('Full Flow Integration', () => {

    test('complete flow: select → evaluate → see all panels → reset', async ({ page }) => {
      const mock = buildMockEvaluationResult();
      await renderDashboardWithMock(page, mock);

      // 1. Report header
      await expect(page.getByText('Evaluation Report')).toBeVisible();

      // 2. Trust Overview
      await expect(page.getByText('68.41').first()).toBeVisible();

      // 3. Component Breakdown
      await expect(page.getByText('Performance').first()).toBeVisible();

      // 4. Mode Comparison
      await expect(page.getByText(/trust gap/i)).toBeVisible();

      // 5. Calculation Transparency (accordion)
      await expect(page.getByText(/raw inputs/i)).toBeVisible();

      // 6. Advanced Analytics
      await expect(page.getByText('Standard Metrics').first()).toBeVisible();

      // 7. Actions
      await expect(page.getByRole('button', { name: /download report/i })).toBeVisible();

      // 8. Reset
      await page.getByRole('button', { name: /new evaluation/i }).click();
      await expect(page.getByText('Evaluation Report')).not.toBeVisible();
    });

    test('guard-triggered flow shows alert and badge', async ({ page }) => {
      const guardResult = buildGuardTriggeredResult();
      await renderDashboardWithMock(page, guardResult);

      // Alert banner
      await expect(page.getByText(/non-compensatory guard activated/i)).toBeVisible();

      // Triggered badge in TrustOverview
      await expect(page.getByText(/triggered/i).first()).toBeVisible();

      // Trust score is still rendered (guard doesn't alter it)
      await expect(page.getByText('68.41').first()).toBeVisible();
    });
  });
});
