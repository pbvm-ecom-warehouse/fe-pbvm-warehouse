# Warehouse Code Quality

- Treat stock math and status transitions as high-risk logic.
- Keep movement/ref data mapping explicit and testable.
- Avoid hidden side effects in UI action handlers.
- Use typed service contracts for all admin API interactions.
- Keep domain naming consistent with backend terms:
  - `onHand`
  - `reserved`
  - `availableQty`
  - movement `refId`/`refType`
- Put-away suggestion UI must label results as advisory, not exact 3D bin-packing.
- Barcode scan confirmation and override/audit path stay visible for receiver workflows.
