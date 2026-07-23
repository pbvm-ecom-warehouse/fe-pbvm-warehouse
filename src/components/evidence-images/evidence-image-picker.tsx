"use client";

import { useEffect, useId, useMemo } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import {
  EVIDENCE_IMAGE_ACCEPT_ATTRIBUTE,
  EVIDENCE_IMAGE_MAX_BYTES,
  validateEvidenceImageFiles,
} from "./evidence-image-utils";

type EvidenceImagePickerProps = {
  className?: string;
  disabled?: boolean;
  files: File[];
  id?: string;
  label?: string;
  onChange: (files: File[]) => void;
};

export function EvidenceImagePicker({
  className,
  disabled = false,
  files,
  id,
  label = "Ảnh minh chứng",
  onChange,
}: EvidenceImagePickerProps) {
  const generatedId = useId();
  const inputId = id ?? `evidence-images-${generatedId}`;

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;

    const { accepted, rejected } = validateEvidenceImageFiles(fileList);

    if (rejected.some((item) => item.reason === "type")) {
      toast.error("Chỉ nhận ảnh JPEG, PNG hoặc WebP.");
    }
    if (rejected.some((item) => item.reason === "size")) {
      toast.error("Mỗi ảnh minh chứng không được vượt quá 5 MB.");
    }

    if (accepted.length > 0) {
      onChange([...files, ...accepted]);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label htmlFor={inputId}>{label}</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            JPEG, PNG hoặc WebP, tối đa {EVIDENCE_IMAGE_MAX_BYTES / 1024 / 1024}{" "}
            MB mỗi ảnh.
          </p>
        </div>
        <Button
          asChild
          disabled={disabled}
          size="sm"
          type="button"
          variant="outline"
        >
          <label
            className={cn(disabled && "pointer-events-none")}
            htmlFor={inputId}
          >
            <ImagePlus data-icon="inline-start" />
            Chọn ảnh
          </label>
        </Button>
        <input
          accept={EVIDENCE_IMAGE_ACCEPT_ATTRIBUTE}
          className="sr-only"
          disabled={disabled}
          id={inputId}
          multiple
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
          type="file"
        />
      </div>

      {files.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {files.map((file, index) => (
            <EvidenceFilePreview
              file={file}
              key={`${file.name}-${file.lastModified}-${index}`}
              onRemove={() =>
                onChange(files.filter((_, fileIndex) => fileIndex !== index))
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EvidenceFilePreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  return (
    <div className="group relative aspect-square overflow-hidden rounded-md border bg-muted">
      <div
        aria-label={`Xem trước ${file.name}`}
        className="size-full bg-cover bg-center"
        role="img"
        style={
          previewUrl ? { backgroundImage: `url("${previewUrl}")` } : undefined
        }
      />
      <Button
        aria-label={`Xóa ${file.name}`}
        className="absolute right-1 top-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
        onClick={onRemove}
        size="icon-sm"
        type="button"
        variant="destructive"
      >
        <Trash2 />
      </Button>
      <div className="absolute inset-x-0 bottom-0 truncate bg-black/65 px-1.5 py-1 text-[11px] text-white">
        {file.name}
      </div>
    </div>
  );
}
