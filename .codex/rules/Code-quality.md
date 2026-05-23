# Warehouse Code Quality

- Treat stock math and status transitions as high-risk logic.
- Keep movement/ref data mapping explicit and testable.
- Avoid hidden side effects in UI action handlers.
- Use typed service contracts for all admin API interactions.
- Keep domain naming consistent with backend terms:
  - quantity
  - reserved_qty
  - available_qty
  - movement ref_id/ref_type
