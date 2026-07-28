"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Keyboard, LoaderCircle, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BarcodeDetectorLike = new (options?: { formats?: string[] }) => {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorLike;
  }
}

export type BarcodeConfirmation = {
  itemBarcode: string;
  cellBarcode: string;
  packageCount: number;
};

export function BarcodeScanDialog({
  open,
  onOpenChange,
  initialCellBarcode,
  maxPackageCount,
  actionLabel,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCellBarcode?: string;
  maxPackageCount: number;
  actionLabel: string;
  pending?: boolean;
  onConfirm: (value: BarcodeConfirmation) => void;
}) {
  const [itemBarcode, setItemBarcode] = useState("");
  const [cellBarcode, setCellBarcode] = useState(initialCellBarcode ?? "");
  const [packageCount, setPackageCount] = useState(
    String(Math.max(1, maxPackageCount)),
  );
  const [cameraTarget, setCameraTarget] = useState<"item" | "cell">();
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const cellInputRef = useRef<HTMLInputElement>(null);

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraTarget(undefined);
  }

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (open) {
        setItemBarcode("");
        setCellBarcode(initialCellBarcode ?? "");
        setPackageCount(String(Math.max(1, maxPackageCount)));
        setCameraError("");
      } else stopCamera();
    });
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [initialCellBarcode, maxPackageCount, open]);

  async function startCamera(target: "item" | "cell") {
    setCameraError("");
    if (!window.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Trình duyệt không hỗ trợ quét camera. Dùng máy quét bàn phím hoặc nhập mã thủ công.",
      );
      return;
    }
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraTarget(target);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const video = videoRef.current;
      if (!video) throw new Error("CAMERA_NOT_READY");
      video.srcObject = stream;
      await video.play();
      const BarcodeDetector = window.BarcodeDetector;
      if (!BarcodeDetector) throw new Error("BARCODE_DETECTOR_UNAVAILABLE");
      const detector = new BarcodeDetector({
        formats: ["code_128", "ean_13", "ean_8", "qr_code", "data_matrix"],
      });
      const scan = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const results = await detector.detect(videoRef.current);
          const value = results[0]?.rawValue?.trim();
          if (value) {
            if (target === "item") setItemBarcode(value);
            else setCellBarcode(value);
            stopCamera();
            if (target === "item")
              setTimeout(() => cellInputRef.current?.focus(), 0);
            return;
          }
        } catch {
          /* tiếp tục frame sau khi camera đang lấy nét */
        }
        rafRef.current = requestAnimationFrame(scan);
      };
      rafRef.current = requestAnimationFrame(scan);
    } catch {
      stopCamera();
      setCameraError(
        "Không mở được camera. Kiểm tra quyền camera hoặc dùng máy quét bàn phím.",
      );
    }
  }

  const parsedCount = Number(packageCount);
  const valid =
    itemBarcode.trim() &&
    cellBarcode.trim() &&
    Number.isInteger(parsedCount) &&
    parsedCount > 0 &&
    parsedCount <= maxPackageCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="size-5 text-blue-700" />
            Quét xác nhận vị trí
          </DialogTitle>
          <DialogDescription>
            Phải quét cả mã mặt hàng và tem khoang. Việc chọn trên bản đồ không
            thay thế bước xác nhận vật lý.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Keyboard className="mr-2 inline size-4" />
            Máy quét dạng bàn phím: đặt con trỏ vào ô rồi quét. Nhấn Enter để
            chuyển ô.
          </div>
          {cameraTarget ? (
            <div className="overflow-hidden rounded-lg border bg-black">
              <video
                ref={videoRef}
                className="aspect-video w-full object-cover"
                muted
                playsInline
              />
              <div className="flex items-center justify-between bg-slate-950 px-3 py-2 text-xs text-white">
                <span>
                  Đưa mã {cameraTarget === "item" ? "mặt hàng" : "khoang"} vào
                  giữa khung
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={stopCamera}
                  type="button"
                >
                  Dừng
                </Button>
              </div>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="scan-item-barcode">Mã vạch mặt hàng</Label>
              <Input
                id="scan-item-barcode"
                autoFocus
                value={itemBarcode}
                onChange={(event) => setItemBarcode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    cellInputRef.current?.focus();
                  }
                }}
                placeholder="Quét mã trên thùng hàng"
              />
            </div>
            <Button
              className="self-end"
              variant="outline"
              onClick={() => void startCamera("item")}
              type="button"
            >
              <Camera data-icon="inline-start" />
              Camera
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="scan-cell-barcode">Mã khoang</Label>
              <Input
                id="scan-cell-barcode"
                ref={cellInputRef}
                value={cellBarcode}
                onChange={(event) => setCellBarcode(event.target.value)}
                placeholder="Quét tem khoang trên kệ"
              />
            </div>
            <Button
              className="self-end"
              variant="outline"
              onClick={() => void startCamera("cell")}
              type="button"
            >
              <Camera data-icon="inline-start" />
              Camera
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="scan-package-count">Số thùng nguyên</Label>
            <Input
              id="scan-package-count"
              type="number"
              min={1}
              max={maxPackageCount}
              value={packageCount}
              onChange={(event) => setPackageCount(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Tối đa {maxPackageCount} thùng trong lần xác nhận này.
            </p>
          </div>
          {cameraError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              {cameraError}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            Đóng
          </Button>
          <Button
            disabled={!valid || pending}
            onClick={() =>
              onConfirm({
                itemBarcode: itemBarcode.trim(),
                cellBarcode: cellBarcode.trim(),
                packageCount: parsedCount,
              })
            }
            type="button"
          >
            {pending ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <ScanLine data-icon="inline-start" />
            )}
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
