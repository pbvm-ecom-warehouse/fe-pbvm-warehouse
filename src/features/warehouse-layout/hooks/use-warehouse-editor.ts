"use client";

import { useMemo, useRef, useState } from "react";

import type { WarehouseLayout } from "@/types/api";
import { cloneWarehouseLayout } from "../utils/warehouse-layout";
import { buildWarehouseLayoutOperations } from "../utils/warehouse-layout-operations";

type LayoutUpdater = (layout: WarehouseLayout) => WarehouseLayout;

function layoutsEqual(left: WarehouseLayout, right: WarehouseLayout) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useWarehouseEditor(initialLayout: WarehouseLayout) {
  const [baseLayout, setBaseLayout] = useState(() =>
    cloneWarehouseLayout(initialLayout),
  );
  const [draftLayout, setDraftLayout] = useState(() =>
    cloneWarehouseLayout(initialLayout),
  );
  const [undoStack, setUndoStack] = useState<WarehouseLayout[]>([]);
  const [redoStack, setRedoStack] = useState<WarehouseLayout[]>([]);
  const draftRef = useRef(draftLayout);
  const interactionStartRef = useRef<WarehouseLayout | null>(null);

  function setDraft(next: WarehouseLayout) {
    draftRef.current = next;
    setDraftLayout(next);
  }

  function commit(updater: LayoutUpdater) {
    const before = draftRef.current;
    const next = updater(cloneWarehouseLayout(before));
    if (layoutsEqual(before, next)) return;
    setUndoStack((history) => [...history, cloneWarehouseLayout(before)]);
    setRedoStack([]);
    setDraft(next);
  }

  function updateLive(updater: LayoutUpdater) {
    const next = updater(cloneWarehouseLayout(draftRef.current));
    setDraft(next);
  }

  function beginInteraction() {
    interactionStartRef.current ??= cloneWarehouseLayout(draftRef.current);
  }

  function endInteraction() {
    const before = interactionStartRef.current;
    interactionStartRef.current = null;
    if (!before || layoutsEqual(before, draftRef.current)) return;
    setUndoStack((history) => [...history, before]);
    setRedoStack([]);
  }

  function undo() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setUndoStack((history) => history.slice(0, -1));
    setRedoStack((history) => [
      cloneWarehouseLayout(draftRef.current),
      ...history,
    ]);
    setDraft(cloneWarehouseLayout(previous));
  }

  function redo() {
    const next = redoStack[0];
    if (!next) return;
    setRedoStack((history) => history.slice(1));
    setUndoStack((history) => [
      ...history,
      cloneWarehouseLayout(draftRef.current),
    ]);
    setDraft(cloneWarehouseLayout(next));
  }

  function reset(layout: WarehouseLayout) {
    const canonical = cloneWarehouseLayout(layout);
    setBaseLayout(canonical);
    setDraft(cloneWarehouseLayout(canonical));
    setUndoStack([]);
    setRedoStack([]);
    interactionStartRef.current = null;
  }

  const operations = useMemo(
    () => buildWarehouseLayoutOperations(baseLayout, draftLayout),
    [baseLayout, draftLayout],
  );

  return {
    baseLayout,
    draftLayout,
    operations,
    isDirty: operations.length > 0,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    beginInteraction,
    commit,
    endInteraction,
    redo,
    reset,
    undo,
    updateLive,
  };
}
