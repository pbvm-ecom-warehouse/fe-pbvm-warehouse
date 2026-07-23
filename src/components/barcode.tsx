"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

import { cn } from "@/lib/utils";

export function Barcode({
  className,
  value,
}: {
  className?: string;
  value: string;
}) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!barcodeRef.current || !value) {
      return;
    }

    JsBarcode(barcodeRef.current, value, {
      background: "transparent",
      displayValue: true,
      font: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 13,
      format: "CODE128",
      height: 48,
      margin: 0,
      textMargin: 6,
      width: 1.5,
    });
  }, [value]);

  return (
    <div
      className={cn(
        "max-w-full overflow-x-auto rounded-md bg-white p-3",
        className,
      )}
    >
      <svg
        aria-label={`Mã vạch nội bộ ${value}`}
        className="block h-auto max-w-none"
        ref={barcodeRef}
        role="img"
      />
    </div>
  );
}
