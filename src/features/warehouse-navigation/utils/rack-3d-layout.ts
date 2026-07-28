import type {
  StorageCellContent,
  StorageCellView,
} from "../services/warehouse-operations.service";

export type RackMeasurements = {
  widthM: number;
  depthM: number;
  heightM: number;
  levels: number;
  bays: number;
  bayWidthsM: number[];
  levelHeightsM: number[];
};

export type PackedCellBox = {
  id: string;
  contentId: string;
  sku: string;
  size: [widthM: number, heightM: number, depthM: number];
  position: [xM: number, yM: number, zM: number];
};

function positiveMeters(value?: number | null) {
  return value && value > 0 ? value / 100 : undefined;
}

function packageSize(
  content: StorageCellContent,
): [number, number, number] | undefined {
  const widthM = positiveMeters(content.packageWidthCm);
  const heightM = positiveMeters(content.packageHeightCm);
  const depthM = positiveMeters(content.packageDepthCm);
  if (widthM && heightM && depthM) return [widthM, heightM, depthM];

  if (
    content.packageVolumeCm3Snapshot &&
    content.packageVolumeCm3Snapshot > 0
  ) {
    const sideM = Math.cbrt(content.packageVolumeCm3Snapshot) / 100;
    return [sideM, sideM, sideM];
  }
  return undefined;
}

export function getRackMeasurements(
  cells: StorageCellView[],
): RackMeasurements {
  const levels = Math.max(1, ...cells.map((cell) => cell.level));
  const bays = Math.max(1, ...cells.map((cell) => cell.bay));
  const bayWidthsM = Array.from({ length: bays }, (_, index) => {
    const bay = index + 1;
    return (
      Math.max(
        0,
        ...cells
          .filter((cell) => cell.bay === bay)
          .map((cell) => cell.innerWidth / 100),
      ) || 1
    );
  });
  const levelHeightsM = Array.from({ length: levels }, (_, index) => {
    const level = index + 1;
    return (
      Math.max(
        0,
        ...cells
          .filter((cell) => cell.level === level)
          .map((cell) => cell.innerHeight / 100),
      ) || 1
    );
  });

  return {
    widthM: bayWidthsM.reduce((sum, width) => sum + width, 0),
    depthM: Math.max(0, ...cells.map((cell) => cell.innerDepth / 100)) || 1,
    heightM: levelHeightsM.reduce((sum, height) => sum + height, 0),
    levels,
    bays,
    bayWidthsM,
    levelHeightsM,
  };
}

export function getCellPosition(
  cell: StorageCellView,
  rack: RackMeasurements,
): [xM: number, yM: number, zM: number] {
  const xBefore = rack.bayWidthsM
    .slice(0, cell.bay - 1)
    .reduce((sum, width) => sum + width, 0);
  const yBefore = rack.levelHeightsM
    .slice(0, cell.level - 1)
    .reduce((sum, height) => sum + height, 0);
  return [
    -rack.widthM / 2 + xBefore + cell.innerWidth / 200,
    -rack.heightM / 2 + yBefore + cell.innerHeight / 200,
    0,
  ];
}

export function packCellBoxes(cell: StorageCellView): PackedCellBox[] {
  const cellWidthM = cell.innerWidth / 100;
  const cellHeightM = cell.innerHeight / 100;
  const cellDepthM = cell.innerDepth / 100;
  const boxes: PackedCellBox[] = [];
  const epsilon = 0.0001;

  let cursorX = -cellWidthM / 2;
  let cursorY = -cellHeightM / 2;
  let cursorZ = -cellDepthM / 2;
  let rowDepth = 0;
  let layerHeight = 0;

  for (const content of cell.contents) {
    const size = packageSize(content);
    if (!size) continue;
    const [widthM, heightM, depthM] = size;
    if (
      widthM > cellWidthM + epsilon ||
      heightM > cellHeightM + epsilon ||
      depthM > cellDepthM + epsilon
    ) {
      continue;
    }

    for (let index = 0; index < content.quantity; index += 1) {
      if (cursorX + widthM > cellWidthM / 2 + epsilon) {
        cursorX = -cellWidthM / 2;
        cursorZ += rowDepth;
        rowDepth = 0;
      }
      if (cursorZ + depthM > cellDepthM / 2 + epsilon) {
        cursorX = -cellWidthM / 2;
        cursorZ = -cellDepthM / 2;
        cursorY += layerHeight;
        rowDepth = 0;
        layerHeight = 0;
      }
      if (cursorY + heightM > cellHeightM / 2 + epsilon) return boxes;

      boxes.push({
        id: `${content.id}-${index}`,
        contentId: content.id,
        sku: content.sku,
        size,
        position: [
          cursorX + widthM / 2,
          cursorY + heightM / 2,
          cursorZ + depthM / 2,
        ],
      });
      cursorX += widthM;
      rowDepth = Math.max(rowDepth, depthM);
      layerHeight = Math.max(layerHeight, heightM);
    }
  }

  return boxes;
}
