# Warehouse Folder Boundaries

## Required shape

- `src/app`: route composition and shells
- `src/features/<feature>/components`: feature UI
- `src/features/<feature>/services`: API calls
- `src/features/<feature>/schemas`: validation
- `src/features/<feature>/utils`: pure domain helpers
- `src/lib`: shared infra (`api-client`, env, token)
- `src/types`: cross-feature contracts

## Boundary rules

- Pages should not call raw endpoints directly.
- Stock-domain helpers stay pure and unit-tested.
- Shared admin layout belongs to `features/admin-shell` and `components/layout`.
