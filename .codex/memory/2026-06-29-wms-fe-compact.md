# 2026-06-29 WMS FE Compact

Scope: `fe-pbvm-warehouse` only.

## Current Direction

- WMS FE is frontend-only for this work; do not edit backend to satisfy missing flows.
- Public backend source of truth remains Swagger/API under `https://api-ecom-wms.hoaiphuong.io.vn/api/wms`.
- The visible product name is `WMS`. Do not show `PBVM`, `ECOM`, or `WMS-ECOM` in the app UI.
- The backend hostname may still contain `ecom`; that is an API URL, not UI branding.
- Login is normal WMS staff auth using `username + password`.
- Do not add Google login, Firebase UI, or calls to `/auth/google-login`.

## API Behavior

- Keep all HTTP calls through `src/lib/api-client.ts`.
- Base URL defaults to the CORS-enabled remote API through `NEXT_PUBLIC_WMS_API_URL=https://api-ecom-wms.hoaiphuong.io.vn/api/wms`.
- Browser-side API calls may go directly to the remote API now that backend CORS allows the local frontend origin.
- Axios uses `withCredentials: true` so backend cookie auth remains compatible while FE also stores bearer tokens from the response body.
- API responses unwrap `{ data, meta }`.
- Refresh-token interceptor is kept.
- Do not refresh on `/auth/login` 401; preserve the backend invalid-credentials error.
- Supported live backend endpoints wired in FE:
  - `POST /auth/login`
  - `GET /auth/me`
  - `POST /auth/refresh`
  - `POST /auth/logout`
  - `POST /auth/change-password`
  - admin actions for bootstrap/create/update roles/lock/unlock/reset password
  - `GET /health`
  - `GET /`
- Missing business endpoints should surface as unsupported/unavailable states.
- Do not silently convert missing business API responses into fake complete data.
- Do not use fake business data as if a module is fully integrated.

## UI Copy Rules

- Avoid exposing internal implementation terms in UI:
  - backend
  - Swagger
  - expected backend contract
  - endpoint not supported
  - local fallback
- User-facing missing states should read like a normal product state, for example:
  - `Chưa có dữ liệu`
  - `Chức năng đang chờ dữ liệu hệ thống`
  - `Dữ liệu chưa sẵn sàng`
- Do not show explanatory notes like “Theo docs WMS...” on production screens.

## Brand Rules

- Display brand: `WMS`.
- Logo is implemented in `src/components/brand/wms-logo.tsx`.
- Logo mark should adapt to the app's existing blue/navy UI palette.
- Do not change the whole UI palette to match an uploaded logo reference.
- Current logo palette:
  - dark navy `#0f172a`
  - primary blue `#1e40af`
  - blue `#3b82f6`
  - light blue `#bfdbfe`
- `src/app/globals.css` should keep the original blue primary/accent tokens.
- Metadata title is `WMS Admin`.
- Config name is `WMS`; support placeholder is `ops@wms.local`.

## Current Implementation Snapshot

- Added `MissingBackendEndpointError` helpers in `src/lib/api-contract.ts`.
- Inventory/dashboard services distinguish missing backend endpoints from real auth/server errors.
- `ModulePage` placeholder modules now present normal unavailable/empty states instead of internal endpoint tables.
- Warehouse layout/navigation still tries API when present, but missing layout/suggestion/shelf-content endpoints are shown as unavailable states rather than as completed backend support.
- Logout clears local token/store state even if the logout API call fails.
- Login and password-change UI no longer contains internal backend/docs notes.
- Sidebar and login use the shared `WmsLogo` component.
- Visible source/tests search should remain clean for `PBVM`, `WMS-ECOM`, and `WMS ECOM`.

## Verification Snapshot

Most recent verification after API cleanup, UI copy cleanup, and logo correction:

- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed: 15 files, 56 tests.
- `pnpm build` passed.
- Playwright screenshot check verified production preview at `http://localhost:3104/login`:
  - app primary remains `#1e40af`
  - logo uses blue/navy fills
- 2026-07-02 CORS fix verification:
  - `pnpm lint`, `pnpm typecheck`, `pnpm test` (57 tests), and `pnpm build` passed.
  - Initial proxy workaround sent login to local `/api/wms/auth/login`.
  - After backend CORS was added, FE was restored to direct remote calls with `withCredentials: true`.
  - Backend CORS source was updated to normalize trailing slashes and support `http://localhost:*` style origin patterns.
  - Deploy backend with `WMS_CORS_ORIGINS` including `http://localhost:3101` or `http://localhost:*`; otherwise the remote API will still omit `Access-Control-Allow-Origin`.

## Local Server Notes

- Standard dev server remains `http://localhost:3101` via `pnpm dev`.
- During verification, older dev servers may cache CSS tokens; production preview from a fresh `pnpm build` is more reliable for token checks.
- Temporary preview ports used during this work included `3103` and `3104`; they are not canonical.

## Skill / .codex Notes

- Repo-local `.codex` memory and rules are the place for internal notes; do not render those notes in app UI.
- Skills added under `.codex/skills` are user-managed. Do not delete or revert them unless explicitly requested.
- Keep generated Python `__pycache__` out of commits if cleanup is requested.
- Do not move `skills-lock.json` unless the user explicitly confirms the skill installer should use a non-root lock path.
