"use client";

import { useRef, type ReactNode } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type EntityDetailDialogProps = {
  bodyClassName?: string;
  children: ReactNode;
  description: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: ReactNode;
};

export function EntityDetailDialog({
  bodyClassName,
  children,
  description,
  onOpenChange,
  open,
  title,
}: EntityDetailDialogProps) {
  const returnFocusRef = useRef<HTMLElement | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[90dvh] sm:max-w-5xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
        onOpenAutoFocus={() => {
          returnFocusRef.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        showCloseButton={false}
        size="5xl"
      >
        <DialogHeader
          className="shrink-0 border-b bg-muted/20 px-4 py-4 pr-14 sm:px-6"
          data-slot="entity-detail-header"
        >
          <DialogTitle className="text-base sm:text-lg">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogClose asChild>
          <Button
            aria-label="Đóng"
            className="absolute right-3 top-3 z-10"
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X />
          </Button>
        </DialogClose>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5",
            bodyClassName,
          )}
          data-slot="entity-detail-body"
        >
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
