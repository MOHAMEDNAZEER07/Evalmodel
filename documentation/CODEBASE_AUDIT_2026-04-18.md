# EvalModel Codebase Audit

Date: 2026-04-18  
Repository: `D:\projects\evalmodel`

## Scope

This audit covered the application-owned code in:

- `backend/app`
- `frontend/src`
- `supabase/functions`
- `backend/migrations`
- root documentation and build/test entry points

Verification performed:

- Backend tests: `backend\venv\Scripts\python.exe -m pytest`
- Frontend lint: `npm run lint`
- Frontend production build: `npm run build`

Limitations:

- I did not run a network-backed dependency vulnerability scan such as `npm audit` or `pip-audit`, so this report focuses on code-level and architecture-level security.
- I did not run Playwright E2E tests because no full app/runtime environment was configured in this audit pass.
- I did not inspect actual secret values from local `.env` files.

## Executive Summary

EvalModel has a promising architecture and a meaningful amount of domain work already implemented, but the current codebase is not in a healthy release state. The main problems are not style-level issues; they are correctness drift, incomplete feature wiring, test instability, and security/control-plane inconsistencies between the custom JWT backend and the direct Supabase frontend usage.

### Overall Ratings

| Area | Score | Notes |
|---|---:|---|
| Architecture | 6/10 | Clear split between frontend/backend/services, but duplicated pipelines and auth split-brain create drift. |
| Backend Quality | 5/10 | Strong ambition and typed schemas, but several correctness and operational issues are present. |
| Frontend Quality | 4/10 | Buildable, but lint debt is high and several features are partially wired or mocked. |
| Security Posture | 4/10 | Good instincts in places, but token lifecycle, direct Supabase access, and public debug surfaces need attention. |
| Test Health | 4/10 | Test suite does not pass in the current workspace. |
| Documentation | 6/10 | Broad coverage exists, but there is drift and some encoding corruption. |

### Repo Snapshot

- Approximate source files reviewed: `150`
- Approximate total source lines reviewed: `23,675`
- Largest hotspots by size:
  - `backend/app/services/meta_evaluator.py`
  - `backend/app/routes/evaluation.py`
  - `frontend/src/pages/Compare.tsx`
  - `frontend/src/pages/Fairness.tsx`
  - `frontend/src/pages/Evaluate.tsx`
  - `backend/app/services/evaluation_job_service.py`

## What Is Good

- The project has a coherent product direction and a real domain model rather than demo-only scaffolding.
- The backend uses structured schemas, separated routes/services, and a reasonable attempt at job-based async evaluation.
- The evaluation stack includes caching, trust scoring, explainability, and fairness, which is impressive for the scope.
- The frontend still builds successfully in production mode.
- The edge-function AI proxy shows operational thinking: retry, circuit breaker, metrics, and rate limiting are already present.
- Documentation volume is strong, which means the project is not starting from zero on onboarding.

## Highest-Priority Findings

### 1. Critical: evaluation pipelines likely break because downloaded model files lose their extension

The sync and async evaluation flows write downloaded models to a temp file named only `model`, but both loaders enforce an allowlist based on file extension.

Evidence:

- `backend/app/routes/evaluation.py:139-159`
- `backend/app/services/evaluation_job_service.py:220-244`
- `backend/app/services/evaluation_job_service.py:373-383`
- `backend/app/services/smcp_engine.py:56-75`

Why this matters:

- `smcp_engine` and `_load_model_object` both fail closed on extension.
- The temp path has no extension, so the allowlist sees `unknown`.
- With the current default `ALLOWED_MODEL_FORMATS="onnx"`, this is even stricter: uploads accept multiple formats, but evaluation defaults to allowing only ONNX.

Impact:

- Sync evaluation is at risk of failing for all uploaded models.
- Async evaluation is at risk of failing for all uploaded models.
- The upload UX and README claim support for `.pkl`, `.pt`, `.h5`, `.onnx`, but runtime behavior does not match that promise.

Recommendation:

- Preserve the original model extension in temp storage.
- Centralize the allowed-format logic in one place.
- Make upload validation and evaluation allowlists consistent.

### 2. High: the backend test suite is currently failing, and one route module is being collected as a test

Backend verification does not pass in the current state.

Observed results:

- First run failed during collection because `JWT_SECRET_KEY` is read at import time.
- After setting a temporary test secret, pytest produced:
  - `28 passed`
  - `11 failed`
  - `1 error`

Evidence:

- Import-time env crash: `backend/app/core/dependencies.py:19`
- Route collected as test: `backend/app/routes/test_storage.py:15-88`
- Lambda sensitivity failure: `backend/app/services/meta_evaluator.py:1516`

Key failures:

- `app/routes/test_storage.py` is named like a test module, so pytest collects it and errors on missing fixtures.
- `MetaEvaluator.evaluate_lambda_sensitivity()` expects two return values from `_calculate_fairness_score`, but the rest of the module now treats that helper as returning three values.

Impact:

- CI confidence is low.
- Research/trust features are demonstrably broken.
- Refactors in this area are unsafe until the suite is repaired.

Recommendation:

- Rename or exclude `app/routes/test_storage.py`.
- Fix the tuple mismatch in `evaluate_lambda_sensitivity`.
- Move required env access behind a settings layer or test fixture so imports do not explode during collection.

### 3. High: the frontend fairness page bypasses the backend and queries Supabase directly, which conflicts with the current auth design

The app is built around custom JWT auth in FastAPI, but the fairness page queries Supabase directly from the browser using the generated Supabase client.

Evidence:

- Direct browser query: `frontend/src/pages/Fairness.tsx:97-108`
- Browser Supabase client uses `localStorage`: `frontend/src/integrations/supabase/client.ts:11-16`
- Database schema policies depend on `auth.uid()`: `backend/database_schema.sql:76-120`
- Schema also still assumes `auth.users` lifecycle hooks: `backend/database_schema.sql:141-155`

Why this matters:

- The backend explicitly says Supabase is storage-only and uses service-role access plus app-layer filtering.
- The fairness page ignores that pattern and talks directly to Supabase.
- RLS policies based on `auth.uid()` do not naturally line up with FastAPI-issued JWTs unless Supabase Auth is also used.

Impact:

- The fairness page is likely brittle or broken depending on deployment config.
- The project currently has two competing auth models.
- This creates hard-to-debug access issues and weakens the security story.

Recommendation:

- Pick one access model and make it consistent.
- If FastAPI remains the source of truth, route fairness through the backend like the rest of the app.
- If direct Supabase access is required, adopt Supabase Auth consistently and rewrite the backend assumptions.

### 4. High: auth lifecycle controls are incomplete

Authentication works at a basic level, but the control surface is incomplete for production use.

Evidence:

- Import-time secret lookup: `backend/app/routes/auth.py:31-35`
- Password minimum is 6 chars on signup: `backend/app/routes/auth.py:44-50`
- Settings page requires 8 chars: `frontend/src/pages/Settings.tsx:25-33`
- Logout is client-side only: `backend/app/routes/auth.py:278-287`
- Forgot-password is not implemented: `backend/app/routes/auth.py:370-390`

Problems:

- No server-side token revocation or session invalidation.
- Refresh tokens appear stateless and reusable until expiry.
- Password policy is inconsistent between backend and frontend.
- Password reset exists only as a placeholder.

Impact:

- Logout does not actually revoke anything.
- Password changes do not appear to invalidate existing refresh tokens.
- UX and security expectations are mismatched.

Recommendation:

- Add token rotation/revocation or move to a managed auth provider.
- Make password rules consistent across backend and frontend.
- Either implement forgot-password fully or remove the UI affordance until ready.

## Medium-Severity Findings

### 5. Medium: route and API drift exists in the auth UI

The frontend exposes flows that are not actually routed or implemented.

Evidence:

- Login links to `/forgot-password`: `frontend/src/pages/Login.tsx:83-88`
- There is no `/forgot-password` route in the app router: `frontend/src/App.tsx:50-70`
- API client exposes `/api/auth/github-oauth`: `frontend/src/lib/api-client.ts:441-448`
- No backend auth route contains a matching GitHub OAuth implementation

Impact:

- Users can click into a dead route.
- The codebase advertises an auth capability that is not actually wired.

Recommendation:

- Remove dead links/methods, or finish the feature end-to-end.

### 6. Medium: Model Registry is only partially implemented despite backend support existing

The backend has versioning endpoints, but the UI still fabricates version data and labels registration as “coming soon”.

Evidence:

- Mock versions in UI: `frontend/src/pages/ModelRegistry.tsx:123-145`
- Registration action still shows “Feature Coming Soon”: `frontend/src/pages/ModelRegistry.tsx:160-164`
- Backend version endpoints already exist in `backend/app/routes/models.py`
- Additional unused skeleton service still exists: `backend/app/services/model_registry.py:26-35`

Impact:

- The feature appears more complete than it really is.
- Data shown in the registry is partly synthetic.
- There is redundant model-registry logic in the repo.

Recommendation:

- Either wire the UI to the real version endpoints now or hide version-management UI until it is fully functional.
- Remove the in-memory `model_registry.py` skeleton if it is no longer part of the plan.

### 7. Medium: schema drift around evaluation state is likely to create bugs

The code and migrations disagree on the column used to represent whether a model has been evaluated.

Evidence:

- Migration adds `evaluated`: `backend/migrations/0004_add_evaluated_column.sql:1-14`
- API schema expects `is_evaluated`: `backend/app/models/schemas.py:57-67`
- Dashboard logic reads `is_evaluated`: `frontend/src/hooks/use-dashboard-data.ts:96-98`
- Evaluation route writes `is_evaluated`: `backend/app/routes/evaluation.py:470`

Impact:

- Different environments may expose different columns.
- UI counters and badges may silently become wrong.
- Deployments can succeed while features disagree on runtime shape.

Recommendation:

- Standardize on one field name.
- Add a migration cleanup and enforce the field in typed API responses.

### 8. Medium: the edge-function AI proxy exposes debug behavior with permissive CORS and no auth gate

The AI proxy is thoughtfully implemented, but it still exposes a public debug echo endpoint and allows all origins.

Evidence:

- Permissive CORS: `supabase/functions/ai-mentor/config.ts:29-33`
- Public debug route: `supabase/functions/ai-mentor/router.ts:28-30`
- Debug handler returns request headers/body: `supabase/functions/ai-mentor/handlers.ts:42-55`

Impact:

- Public debugging endpoints increase the attack surface.
- Open CORS makes cross-origin access trivial.
- The in-memory rate limiter is per-instance and easy to bypass at scale.

Recommendation:

- Disable `/debug/echo` outside local/dev environments.
- Restrict CORS to allowed origins.
- Add auth or signed access for the proxy if it is not intended to be public.

### 9. Medium: NLP evaluation is explicitly a placeholder, but the platform markets it as a supported core capability

Evidence:

- Upload supports multiple frameworks and README markets broad support.
- README advertises upload/evaluation of multiple model types: `README.md:137-144`
- NLP evaluation is explicitly placeholder logic: `backend/app/services/smcp_engine.py:439-447`

Impact:

- Product claims are ahead of runtime reliability.
- Users may upload models that do not have realistic evaluation behavior.

Recommendation:

- Mark NLP/CV support as experimental until real task-specific evaluators exist.
- Narrow the public feature claims or add stronger validation up front.

## Code Quality Findings

### Frontend lint health is poor

`npm run lint` failed with:

- `88 errors`
- `16 warnings`

Main themes:

- Widespread `any` usage
- Missing hook dependencies
- some empty interface anti-patterns
- mixed component/module export patterns that upset fast-refresh

This is not just cosmetic. The number of `any` usages is large enough to weaken the project’s TypeScript value proposition.

### Build passes, but bundle size is large

`npm run build` succeeded, but Vite reported a large output bundle:

- `dist/assets/index-aFZU-hni.js` ≈ `1.396 MB`
- gzip ≈ `389 KB`

This is a real performance smell, especially for first load on lower-end devices.

Likely contributors:

- many page-level features bundled together
- large charting/UI surface
- absence of route-level code splitting

### Large files are doing too much

The following files are especially large and likely deserve decomposition:

- `backend/app/services/meta_evaluator.py`
- `backend/app/routes/evaluation.py`
- `backend/app/services/evaluation_job_service.py`
- `backend/app/services/smcp_engine.py`
- `frontend/src/pages/Compare.tsx`
- `frontend/src/pages/Fairness.tsx`
- `frontend/src/pages/Evaluate.tsx`
- `frontend/src/pages/ModelRegistry.tsx`

These are maintenance hotspots and likely sources of regression.

### Debug logging remains in user-facing frontend flows

Evidence:

- `frontend/src/components/InsightsAIChat.tsx:254-261`
- multiple additional `console.log` / `console.error` uses across pages and hooks

Impact:

- noisy production console
- accidental leakage of contextual data during debugging

Recommendation:

- gate debug logging behind a development flag or remove it from production paths

## Unwanted / Partial / Dead Work

Items that look incomplete, redundant, or misleading:

- `backend/app/routes/test_storage.py`
  - debug endpoint living in production code path
  - also breaks pytest collection because of its filename
- `backend/app/services/model_registry.py`
  - unused in-memory skeleton with TODOs
- `frontend/src/pages/ModelRegistry.tsx`
  - still depends on fake version data for display
- `frontend/src/lib/api-client.ts`
  - exposes `githubOAuth()` without a matching backend route
- `frontend/src/pages/Login.tsx`
  - links to a missing route
- `backend/app/routes/auth.py`
  - forgot-password is placeholder only
- `README.md`
  - contains visible mojibake/encoding corruption in headings and emoji text

## Security Review

### Positive notes

- The backend does scope most resource queries by `user_id`.
- The system clearly tries to fail closed on model format loading.
- Tokens are stored in `sessionStorage` for the main custom-JWT path rather than `localStorage`.

### Main security concerns

1. Auth split-brain between backend JWTs and direct Supabase frontend access.
2. No true server-side logout/session revocation.
3. Public debug echo endpoint in the AI proxy.
4. Service-role access is used broadly, so app-layer filtering must remain perfect.
5. Password reset is incomplete.
6. Import-time secret reads make operations and testing brittle.

### What I would fix first

1. Remove public debug exposure in `ai-mentor`.
2. Unify auth access paths so the browser is not half-using Supabase Auth assumptions and half-using FastAPI JWTs.
3. Add token rotation/revocation or move to managed auth.
4. Make env/config loading resilient and explicit.

## Verification Results

### Backend tests

Result:

- Initial run failed during collection because `JWT_SECRET_KEY` was missing.
- After setting a temporary secret:
  - `28 passed`
  - `11 failed`
  - `1 error`

Main failures:

- `app/routes/test_storage.py` collected as a test module
- `MetaEvaluator.evaluate_lambda_sensitivity()` fairness tuple mismatch

### Frontend lint

Result:

- Failed
- `104 problems` total
- `88 errors`, `16 warnings`

### Frontend build

Result:

- Passed
- Large bundle warning emitted

## Recommended Cleanup Plan

### Immediate

1. Fix the evaluation temp-file extension bug.
2. Fix `evaluate_lambda_sensitivity()` and restore a green backend test suite.
3. Rename or exclude `test_storage.py` from pytest collection.
4. Remove dead auth flows: missing route and missing OAuth backend endpoint.
5. Decide whether fairness data should come through FastAPI or direct Supabase, then standardize.

### Next

1. Standardize schema naming around `is_evaluated` vs `evaluated`.
2. Replace Model Registry mock data with real backend data.
3. Remove or archive unused skeleton services.
4. Clean up debug logging in frontend production paths.
5. Introduce route-level code splitting to reduce initial bundle size.

### After stabilization

1. Reduce `any` usage and make lint a required quality gate.
2. Split oversized files by responsibility.
3. Add integration tests for auth, fairness retrieval, and evaluation job lifecycle.
4. Review docs for drift and fix README encoding issues.

## Bottom Line

This project is real and substantial, not throwaway code, but it is currently in a “feature-rich but unstable” state. The biggest risks are correctness drift and inconsistent platform boundaries, not lack of ambition.

If you address the evaluation-pipeline bug, restore test health, and choose one consistent auth/data-access model, the project quality will improve quickly. Right now the codebase feels about **5/10 overall**: strong ideas and decent structure, but too much partial wiring and operational inconsistency for a clean production handoff.

## 5/10 -> 10/10 Master TODO Roadmap

This is an execution-grade checklist to move the codebase from unstable to production-ready. Complete in order.

### Success Criteria (What 10/10 Means)

- All backend tests pass reliably in CI and locally with one command.
- Frontend lint and type checks pass with zero errors and zero warnings in CI.
- Security baseline is hardened (no public debug surfaces, consistent auth model, no unsafe deserialization in untrusted context).
- Product claims in docs match actual behavior and supported model types.
- Release process is repeatable with quality gates and rollback strategy.

---

### Phase 0: Program Setup (Day 0)

1. Create a single engineering board with milestones for Phase 1-8.
2. Assign owners for backend, frontend, security, and docs.
3. Freeze feature development until Phase 3 is complete.
4. Define quality gates that block merges:
  - backend tests green
  - frontend lint/type/build green
  - no high-severity security findings
5. Add mandatory PR template with risk/test checklist.

Definition of done:

- Milestones and owners visible.
- Branch protection requires checks.

---

### Phase 1: Correctness and Test Health (Critical)

1. Fix evaluation temp model file extension handling in sync and async pipelines.
2. Fix `MetaEvaluator.evaluate_lambda_sensitivity()` tuple/return mismatch.
3. Rename or exclude `app/routes/test_storage.py` from pytest collection.
4. Remove import-time env hard crashes (`JWT_SECRET_KEY` access at import time).
5. Add a deterministic test bootstrap:
  - `.env.test`
  - pytest fixture to inject required env
  - clear test README command
6. Add regression tests for:
  - extension-preserving evaluation download paths
  - lambda sensitivity fair-score contract
  - endpoint import safety without prod env

Definition of done:

- `pytest` passes 100 percent in CI and local clean clone.
- No route module is accidentally collected as a test.

---

### Phase 2: Security Hardening (Critical)

1. Decide and enforce one auth/data-access architecture:
  - Option A: FastAPI-only data access (recommended for current design).
  - Option B: Supabase Auth end-to-end with aligned backend verification.
2. Remove split-brain access by routing fairness page through the same model as other pages.
3. Eliminate raw exception leakage in API responses.
4. Replace public debug endpoint behavior in AI proxy:
  - disable in non-dev
  - restrict CORS to trusted origins
5. Add server-side session lifecycle controls:
  - refresh token rotation/revocation
  - token invalidation on password change
6. Implement real forgot-password flow or remove from UI.
7. Add per-endpoint rate limiting and abuse controls for auth/upload/evaluation.
8. Define model execution safety policy:
  - sandbox untrusted model loading
  - separate trusted ONNX path from legacy pickle/joblib path

Definition of done:

- Threat model document approved.
- Security smoke tests pass.
- No public debug surface in production profile.

---

### Phase 3: Backend Consistency and Cleanup

1. Remove duplicate entrypoint drift by keeping one canonical backend entrypoint.
2. Resolve schema drift (`evaluated` vs `is_evaluated`) with migration and typed response alignment.
3. Remove or archive unused in-memory model registry skeleton.
4. Consolidate format allowlist logic in one backend module used by upload and evaluation.
5. Refactor oversized services into focused modules:
  - scoring
  - fairness
  - explainability
  - job orchestration
6. Add structured error codes and correlation IDs.

Definition of done:

- No duplicate source-of-truth modules for startup/schema flags.
- All API fields and DB columns consistent and documented.

---

### Phase 4: Frontend Quality Upgrade

1. Drive lint to zero:
  - remove all `any` in hot paths first (`Evaluate`, `Compare`, `Fairness`, auth context, API client)
  - fix hook dependency warnings
  - remove empty interface anti-patterns
2. Enforce strict TypeScript gradually:
  - enable `strict` in staged PRs
  - clean tsconfig deprecated settings
3. Remove or gate debug logs in production builds.
4. Remove dead links/routes or finish features end-to-end.
5. Replace mocked Model Registry data with real backend endpoints.
6. Improve bundle performance:
  - route-level lazy loading
  - manual chunking for heavy modules

Definition of done:

- Frontend lint/type/build all green in CI.
- Initial bundle reduced and under agreed budget.

---

### Phase 5: Product Integrity (Claims vs Reality)

1. Mark NLP/CV as experimental until evaluators are production-grade.
2. Align README and docs with actual runtime support matrix.
3. Add capability flags in UI so unsupported features are clearly labeled.
4. Remove "coming soon" behaviors from production routes unless clearly scoped as beta.

Definition of done:

- No user-facing claim is ahead of implemented behavior.

---

### Phase 6: Observability and Operations

1. Add structured telemetry:
  - request IDs
  - evaluation job IDs
  - error codes
2. Add metrics dashboards:
  - API latency/error rate
  - evaluation success rate
  - queue time and throughput
3. Add SLOs and alerts for critical paths.
4. Add runbooks:
  - auth failure recovery
  - job queue stalls
  - storage/download failures

Definition of done:

- On-call can diagnose major failures using dashboards and runbooks.

---

### Phase 7: CI/CD and Release Governance

1. CI pipeline stages:
  - backend tests
  - frontend lint/type/build
  - security scanning (`npm audit`, `pip-audit`, secret scan)
2. Add preview environments for PR validation.
3. Add versioned migrations checks and rollback safety.
4. Require changelog entries for behavior/security changes.
5. Add deployment checklist with go/no-go criteria.

Definition of done:

- Every release is reproducible and policy-gated.

---

### Phase 8: Final 10/10 Certification Sprint

1. Run full end-to-end regression including Playwright flows.
2. Conduct security review and close remaining high/medium risks.
3. Perform performance pass on backend eval throughput and frontend LCP.
4. Execute docs truth pass across setup, auth, API, and support matrix.
5. Hold release readiness review with sign-off from all owners.

Definition of done:

- All quality gates green for 2 consecutive release candidates.
- No critical or high unresolved findings.
- Team sign-off achieved.

---

### KPI Targets to Track Weekly

1. Backend test pass rate: target 100 percent.
2. Frontend lint errors: target 0.
3. Frontend lint warnings: target 0.
4. Critical security findings: target 0.
5. Mean time to detect and resolve production incidents.
6. Bundle size budget adherence.
7. Documentation drift count: target 0 known mismatches.

---

### Suggested Order of Implementation (Fastest Path)

1. Phase 1 (correctness and test reliability).
2. Phase 2 (security hardening + auth unification decision).
3. Phase 3 and 4 in parallel (backend cleanup + frontend lint/types).
4. Phase 5-7 (integrity, operations, release governance).
5. Phase 8 certification sprint.

If executed with discipline, this roadmap can realistically move the project from 5/10 to a production-grade 9-10/10 band.
