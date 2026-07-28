import type { StorageCellView } from "../services/warehouse-operations.service";
import type { PutawayPackageSpec } from "./putaway-work-items";

export type CellCapacityEvaluation = {
  dimensionFits: boolean;
  remainingPackages?: number;
  full: boolean;
  locked: boolean;
  suggested: boolean;
  override: boolean;
  selectable: boolean;
  reason:
    | "AVAILABLE"
    | "BLOCKED"
    | "FULL"
    | "DIMENSION_MISMATCH"
    | "OCCUPIED_OVERRIDE";
};

export function evaluateCellCapacity(
  cell: StorageCellView,
  packageSpec?: PutawayPackageSpec,
  options: { suggested?: boolean } = {},
): CellCapacityEvaluation {
  const suggested = options.suggested ?? true;
  const locked = cell.status !== "ACTIVE";
  const dimensionFits = packageSpec
    ? packageSpec.depthCm <= cell.innerDepth &&
      packageSpec.widthCm <= cell.innerWidth &&
      packageSpec.heightCm <= cell.innerHeight
    : true;
  const remainingVolume = Math.max(
    0,
    cell.usableVolumeCm3 - cell.occupiedVolumeCm3,
  );
  const remainingPackages = packageSpec?.volumeCm3
    ? Math.floor(remainingVolume / packageSpec.volumeCm3)
    : undefined;
  const full =
    cell.fillPercent >= 100 || remainingVolume <= 0 || remainingPackages === 0;
  const empty = cell.contents.length === 0;
  const override = !suggested && empty && !locked && !full && dimensionFits;
  const selectable =
    !locked && !full && dimensionFits && (suggested || override);
  const reason = locked
    ? "BLOCKED"
    : !dimensionFits
      ? "DIMENSION_MISMATCH"
      : full
        ? "FULL"
        : !suggested && !empty
          ? "OCCUPIED_OVERRIDE"
          : "AVAILABLE";

  return {
    dimensionFits,
    remainingPackages,
    full,
    locked,
    suggested,
    override,
    selectable,
    reason,
  };
}
