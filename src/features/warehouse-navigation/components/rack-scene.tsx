"use client";

import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Edges, Html, OrbitControls } from "@react-three/drei";
import type { StorageCellView } from "../services/warehouse-operations.service";

function cellColor(cell: StorageCellView, selected: boolean) {
  if (selected) return "#f59e0b";
  if (cell.status === "BLOCKED") return "#94a3b8";
  if (cell.fillPercent >= 90) return "#dc2626";
  if (cell.fillPercent >= 60) return "#f97316";
  if (cell.fillPercent > 0) return "#2563eb";
  return "#dbeafe";
}

function RackModel({
  cells,
  selectedCellId,
  onSelectCell,
}: {
  cells: StorageCellView[];
  selectedCellId?: string;
  onSelectCell: (cell: StorageCellView) => void;
}) {
  const levels = Math.max(1, ...cells.map((cell) => cell.level));
  const bays = Math.max(1, ...cells.map((cell) => cell.bay));
  const width = bays * 1.45;
  const height = levels * 1.15;
  return (
    <group position={[0, -0.2, 0]}>
      {Array.from({ length: bays + 1 }, (_, index) => (
        <mesh
          key={`post-${index}`}
          position={[-width / 2 + index * 1.45, 0, 0]}
        >
          <boxGeometry args={[0.09, height + 0.5, 0.24]} />
          <meshStandardMaterial
            color="#334155"
            metalness={0.55}
            roughness={0.38}
          />
        </mesh>
      ))}
      {Array.from({ length: levels + 1 }, (_, index) => (
        <mesh
          key={`beam-${index}`}
          position={[0, -height / 2 + index * 1.15, 0]}
        >
          <boxGeometry args={[width + 0.12, 0.09, 0.28]} />
          <meshStandardMaterial
            color="#475569"
            metalness={0.5}
            roughness={0.42}
          />
        </mesh>
      ))}
      {cells.map((cell) => {
        const x = -width / 2 + (cell.bay - 0.5) * 1.45;
        const y = -height / 2 + (cell.level - 0.5) * 1.15;
        const selected = selectedCellId === cell.id;
        return (
          <group key={cell.id} position={[x, y, 0]}>
            <mesh
              onClick={(event: ThreeEvent<MouseEvent>) => {
                event.stopPropagation();
                onSelectCell(cell);
              }}
            >
              <boxGeometry args={[1.3, 1, 0.72]} />
              <meshStandardMaterial
                color={cellColor(cell, selected)}
                transparent
                opacity={selected ? 0.9 : 0.72}
                roughness={0.55}
              />
              <Edges color={selected ? "#92400e" : "#475569"} />
            </mesh>
            <Html center distanceFactor={8} position={[0, 0, 0.39]} transform>
              <button
                className="w-28 rounded border border-white/60 bg-white/90 px-1.5 py-1 text-center text-[9px] leading-tight text-slate-900 shadow-sm"
                onClick={() => onSelectCell(cell)}
                type="button"
              >
                <span className="block font-mono font-bold">{cell.code}</span>
                <span className="block">
                  {cell.fillPercent}% ·{" "}
                  {cell.contents.reduce(
                    (sum, item) => sum + item.quantity,
                    0,
                  )}{" "}
                  thùng
                </span>
              </button>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

export default function RackScene(props: {
  cells: StorageCellView[];
  selectedCellId?: string;
  onSelectCell: (cell: StorageCellView) => void;
}) {
  const levels = Math.max(1, ...props.cells.map((cell) => cell.level));
  const bays = Math.max(1, ...props.cells.map((cell) => cell.bay));
  const distance = Math.max(6, Math.max(levels, bays) * 2.15);
  return (
    <Canvas
      camera={{
        position: [distance * 0.58, distance * 0.42, distance],
        fov: 40,
      }}
      dpr={[1, 1.5]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#f1f5f9"]} />
      <ambientLight intensity={1.25} />
      <directionalLight intensity={1.7} position={[5, 8, 6]} />
      <RackModel {...props} />
      <OrbitControls
        enablePan={false}
        maxDistance={distance * 1.8}
        minDistance={distance * 0.55}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}
