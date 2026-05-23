# Warehouse Codex Context

Repo: `fe-pbvm-warehouse`

This file defines repo-specific rules that override shared `@WDP/.codex` when needed.

## Scope

- Internal operations dashboard
- Inventory and stock movement views
- Purchase and transfer workflows
- Cup conversion and audit trails

## Priorities

1. Data correctness for warehouse operations
2. Clear auditability of stock-related actions
3. Stable and secure authenticated admin requests

## Rule Set

- Workflow: `rules/Workflow.md`
- Code quality: `rules/Code-quality.md`
- Fetching strategy: `rules/Data-fetching.md`
- Folder boundaries: `rules/Folder-structure.md`

## Local Memory

- Decisions: `memory/decisions.md`

## Compaction Rule

- For changes only in this repo, compact into:
  - `fe-pbvm-warehouse/.codex/memory/decisions.md`
- For changes spanning both repos, compact into:
  - `@WDP/.codex/memory/decisions.md`
