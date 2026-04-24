# EvalModel Comprehensive Project Audit

**Date:** 2026-04-18  
**Scope:** Full repository review (backend, frontend, docs, tests, config, security posture)  
**Method:** Static code review + lint/build/test execution in backend venv + repository hygiene checks

---

## 1. Executive Summary

EvalModel has a strong functional base and meaningful architectural intent (SMCP evaluation pipeline, fairness/explainability integration, artifact-aware cache, modern frontend stack), but quality and operational readiness are currently limited by:

- fragile backend test collection and at least one confirmed logic regression in trust-mode sensitivity evaluation,
- broad frontend lint/type debt,
- duplication/partial implementation artifacts in backend and docs,
- security hardening gaps around unsafe model deserialization and verbose error leakage,
- oversized frontend production bundle and missing runtime protection controls (e.g., request throttling).

### Overall Readiness Rating

- **Architecture:** B
- **Code Quality:** C+
- **Test Reliability:** C-
- **Security Posture:** C
- **Operational Readiness (prod hardening):** C-
- **Documentation Accuracy:** C-

---

## 2. What Is Good

- Clear backend modularization by `core`, `routes`, `services`, `models`.
- Sensible ownership scoping in many data queries (`.eq("user_id", current_user["id"])`).
- Practical dataset dedupe and metadata fingerprinting strategy.
- Caching logic for evaluation pair artifacts is present and conceptually sound.
- Frontend has modern tooling and tested route scaffolding.
- Frontend production build succeeds (Vite), so deploy path is technically viable.

---

## 3. Critical Findings (High Priority)

## 3.1 Confirmed backend regression in trust sensitivity flow

**Evidence**

Running backend methodology tests in venv:

- `python -m pytest backend/test_dii_components.py backend/test_methodology_integration.py backend/test_trust_modes.py -q`
- Result: **2 failed, 7 passed**
- Failure location: `backend/app/services/meta_evaluator.py` around `evaluate_lambda_sensitivity(...)`
- Exception: `ValueError: too many values to unpack (expected 2)` at fairness unpacking line (`fair_score, dp_value = self._calculate_fairness_score(fairness_result)`).

**Impact**

- Breaks sensitivity-analysis workflow.
- Undermines confidence in trust/explainability methodology outputs.

**Recommendation**

- Align `_calculate_fairness_score` return shape and call site expectations.
- Add unit contract tests specifically for return signatures and null fairness cases.

---

## 3.2 Unsafe model deserialization path (RCE-class risk)

**Evidence**

- `backend/app/routes/evaluation.py` loads uploaded model artifacts with `joblib.load(...)`, then fallback `pickle.load(...)`.
- Similar pattern appears in `backend/app/services/smcp_engine.py`.

**Impact**

- Deserializing untrusted pickle/joblib files can execute arbitrary code.
- In multi-tenant or externally accessible deployments this is a serious security risk.

**Recommendation**

- Treat pickle/joblib model execution as untrusted code execution.
- Prefer sandboxed execution worker (container/VM isolation, restricted FS/network, seccomp/AppArmor where available).
- Strongly prefer ONNX-only evaluation in high-security mode.
- Add explicit allowlist policy and risk acknowledgement in API/docs.

---

## 3.3 Backend test collection blocked by env coupling

**Evidence**

Running full backend tests:

- `python -m pytest d:\projects\evalmodel\backend -q`
- Collection error in `backend/app/routes/test_storage.py` import chain due `os.environ["JWT_SECRET_KEY"]` KeyError in `backend/app/core/dependencies.py`.

**Impact**

- CI reliability and local contributor experience are fragile.
- Test discovery depends on external env state.

**Recommendation**

- Use safe settings loading with explicit validation layer, not module-import hard failure on raw env lookup.
- Move test/debug route modules out of test discovery path or mark them clearly.
- Provide test env fixture/bootstrap (`.env.test` + pytest plugin/fixture).

---

## 4. Medium Findings

## 4.1 Duplicate backend entrypoint files

**Evidence**

- `backend/main.py`
- `backend/app/main.py`

These are largely duplicate and differ in module path used in `uvicorn.run(...)`.

**Impact**

- Drift risk, confusion for operators and contributors.

**Recommendation**

- Keep a single canonical entrypoint and remove/redirect the other.

---

## 4.2 Dead/skeleton service code present in main tree

**Evidence**

- `backend/app/services/model_registry.py` contains in-memory mock storage and TODO note: "replace with real DB query".
- No references found from other backend Python files.

**Impact**

- Maintenance noise, misleading implementation maturity, accidental import risk.

**Recommendation**

- Remove if unused or move to explicit experimental/sandbox folder with naming convention.

---

## 4.3 Debug endpoint retained in app routes

**Evidence**

- `backend/app/routes/test_storage.py` is a diagnostic endpoint.
- Routing is gated by `ENABLE_DEBUG_ROUTES`, which is good, but route code still lives in production app package.

**Impact**

- Increased attack surface risk if misconfigured.

**Recommendation**

- Move debug routes to separate debug module package and include only under explicit non-prod profile.

---

## 4.4 Error detail leakage to clients

**Evidence**

Multiple handlers return raw exception text in HTTP responses (examples in `models.py`, `datasets.py`, `insights.py`, `evaluation.py`, `auth.py`).

**Impact**

- Internal stack/context disclosure to clients.

**Recommendation**

- Return stable user-safe error messages.
- Log full internals server-side only (with correlation IDs).

---

## 4.5 No explicit request throttling / abuse control layer

**Evidence**

- No rate limiter or throttle framework usage detected in backend app routes.

**Impact**

- Susceptible to brute-force/login abuse, expensive evaluation flooding.

**Recommendation**

- Add endpoint-specific rate limits (auth, upload, evaluate, compare).
- Add quotas by user tier and bounded concurrency for expensive evaluations.

---

## 5. Frontend Quality Findings

## 5.1 Lint debt is high

**Evidence**

`npm run -s lint` reports:

- **104 issues total**
- **88 errors**
- **16 warnings**

Recurring categories:

- widespread `any` usage (`@typescript-eslint/no-explicit-any`),
- hook dependency warnings,
- empty interface declarations,
- one forbidden `require()` style import in `tailwind.config.ts`.

**Impact**

- Type safety is significantly reduced.
- Refactoring risk and runtime defect probability increase.

**Recommendation**

- Enforce typed API DTOs first (`src/types` + `lib/api-client.ts`).
- Burn down `any` in high-traffic pages (`Evaluate`, `Compare`, auth context, insights).
- Treat lint as CI gate after staged remediation.

---

## 5.2 Build succeeds but bundle is heavy

**Evidence**

`npm run -s build` succeeds, but output warns large chunk size; primary JS bundle is ~1.39 MB minified.

**Impact**

- Slower initial load/perceived performance.

**Recommendation**

- Introduce route-level lazy loading and manual chunking strategy.
- Evaluate heavy dependency usage hotspots.

---

## 5.3 Partial feature routes present

**Evidence**

`frontend/src/App.tsx` routes several paths to `NotFound` behind protected routes (`/autotune`, `/team`, `/reports`, `/batch`).

**Impact**

- Product surface advertises features that are functionally incomplete.

**Recommendation**

- Hide unfinished routes from nav and release scope, or mark explicitly as beta/coming soon.

---

## 6. Documentation and Project Hygiene

## 6.1 Status docs are stale and internally inconsistent

**Evidence**

- `documentation/PROJECT_STATUS.md` states auth and endpoints that do not match current code reality (e.g., GitHub OAuth references while backend auth is custom JWT email/password flow).
- README language overstates completion for areas still partially implemented.

**Impact**

- Misleading onboarding, incorrect stakeholder expectations.

**Recommendation**

- Re-baseline docs from actual route/service behavior and test evidence.
- Add machine-verifiable status checklist tied to CI.

---

## 6.2 Local secret hygiene: improved git ignore, but operational risk remains

**Evidence**

- `.gitignore` correctly excludes `.env` and `backend/.env`.
- `git check-ignore -v` confirms both are ignored.
- Local env files still contain plaintext operational credentials and JWT secret.

**Impact**

- Reduced repository leak risk, but high local workstation/secrets-management risk.

**Recommendation**

- Rotate all exposed local credentials as a precaution.
- Move to secrets manager for production and ephemeral dev secrets where possible.

---

## 7. Unwanted / Partial / Cleanup Targets

1. `backend/app/services/model_registry.py` (unused in-memory skeleton)
2. Duplicate app entrypoints (`backend/main.py`, `backend/app/main.py`)
3. Debug route module (`backend/app/routes/test_storage.py`) in core app package
4. TODO in password reset flow (`backend/app/routes/auth.py`)
5. Stale status narrative in `documentation/PROJECT_STATUS.md`
6. Placeholder product routes currently shipping in frontend route table

---

## 8. Risk Register

- **R1 (High):** Untrusted model deserialization via pickle/joblib
- **R2 (High):** Trust-sensitivity regression in methodology engine
- **R3 (High):** Test collection/env coupling causing CI fragility
- **R4 (Medium):** Internal error leakage through API details
- **R5 (Medium):** No explicit throttling for expensive or auth endpoints
- **R6 (Medium):** Documentation drift causing operational confusion
- **R7 (Medium):** Frontend type/lint debt hindering maintainability

---

## 9. Prioritized Remediation Plan (Recommended)

## Week 1 (Stability + Security Baseline)

1. Fix fairness score return-contract regression in `meta_evaluator` and add regression tests.
2. Stop returning raw exception strings to API clients.
3. Add test bootstrap env handling (`.env.test` / fixtures) so full backend test discovery is deterministic.
4. Restrict/segment unsafe deserialization flow (sandbox execution path and explicit security flag).

## Week 2 (Code Hygiene + Architecture)

1. Remove or archive unused `model_registry.py` skeleton.
2. Consolidate to one backend entrypoint.
3. Isolate debug routes outside main route package and guard by non-prod profile.
4. Add rate limiting and quota controls on auth/evaluation/upload endpoints.

## Week 3 (Frontend and Docs)

1. Reduce `any` usage in critical flows and enforce stricter TS/lint posture incrementally.
2. Add route-level lazy loading to shrink initial JS chunk.
3. Reconcile README and `PROJECT_STATUS.md` with implemented behavior and real test status.

---

## 10. Quality Gates to Add in CI

- Backend:
  - `pytest` full suite with deterministic test env
  - security checks for unsafe deserialization policy and secret scan
- Frontend:
  - lint as required check (after initial debt reduction)
  - `npm run build` with bundle-size budget threshold
- Docs:
  - status checklist validation tied to route/tests snapshots

---

## 11. Final Assessment

This project is promising and already delivers substantive ML evaluation functionality, but it is **not yet production-hard**. The fastest path to safe readiness is to prioritize:

1. methodology regression fixes,
2. secure model execution boundaries,
3. deterministic test/CI behavior,
4. frontend type/lint debt reduction,
5. documentation truthfulness.

After these are addressed, EvalModel can move from “feature-rich prototype” to “reliable production candidate.”
