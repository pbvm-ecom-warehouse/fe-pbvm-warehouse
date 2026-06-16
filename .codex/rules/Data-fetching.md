# Warehouse Data Fetching

## Default

- Use `axios` via shared `src/lib/api-client.ts` for admin flows.
- Keep auth/refresh/token behavior centralized.
- WMS requests target `/api/wms`.
- Protected responses must unwrap `{ data, meta }`.

## When `fetch` is acceptable

- Non-sensitive, read-only, cacheable screens that do not require auth headers.
- Use sparingly; prefer consistency with secure admin client.

## Constraints

- Do not bypass shared interceptors for protected endpoints.
- Do not duplicate token refresh logic in feature files.
- Use `/auth/refresh`, not stale refresh-token routes.
- Branch on `error.code`, not Vietnamese message text.
- Read pagination from `meta.pagination`.
