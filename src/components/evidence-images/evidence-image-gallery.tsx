import { ExternalLink, Images } from "lucide-react";

import { cn } from "@/lib/utils";

type EvidenceImageGalleryProps = {
  className?: string;
  emptyLabel?: string;
  images?: string[] | null;
  label?: string;
  onPreview?: (imageUrl: string) => void;
};

export function EvidenceImageGallery({
  className,
  emptyLabel,
  images,
  label = "Ảnh minh chứng",
  onPreview,
}: EvidenceImageGalleryProps) {
  const availableImages = images?.filter(Boolean) ?? [];

  if (availableImages.length === 0) {
    return emptyLabel ? (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {emptyLabel}
      </p>
    ) : null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <div className="flex items-center gap-2 text-sm font-medium">
          <Images className="size-4 text-primary" />
          {label}
        </div>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2">
        {availableImages.map((imageUrl, index) => {
          const previewClassName =
            "group relative block w-28 overflow-hidden rounded-md border bg-muted outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring sm:w-36";
          const previewContent = (
            <>
              <img
                alt={`Ảnh minh chứng ${index + 1}`}
                className="block h-auto w-full object-contain transition-transform group-hover:scale-105"
                src={imageUrl}
              />
              <span className="absolute right-1 top-1 rounded-sm bg-black/65 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <ExternalLink className="size-3" />
              </span>
            </>
          );

          return onPreview ? (
            <button
              aria-label={`Mở ảnh minh chứng ${index + 1}`}
              className={previewClassName}
              key={`${imageUrl}-${index}`}
              type="button"
              onClick={() => onPreview(imageUrl)}
            >
              {previewContent}
            </button>
          ) : (
            <a
              aria-label={`Mở ảnh minh chứng ${index + 1}`}
              className={previewClassName}
              href={imageUrl}
              key={`${imageUrl}-${index}`}
              rel="noreferrer"
              target="_blank"
            >
              {previewContent}
            </a>
          );
        })}
      </div>
    </div>
  );
}
