# Warehouse Data Fetching

## Default

- Use `axios` via shared `src/lib/api-client.ts` for admin flows.
- Keep auth/refresh/token behavior centralized.

## When `fetch` is acceptable

- Non-sensitive, read-only, cacheable screens that do not require auth headers.
- Use sparingly; prefer consistency with secure admin client.

## Constraints

- Do not bypass shared interceptors for protected endpoints.
- Do not duplicate token refresh logic in feature files.
