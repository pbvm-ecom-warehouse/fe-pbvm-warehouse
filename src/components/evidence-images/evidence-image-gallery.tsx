import { ExternalLink, Images } from "lucide-react";

import { cn } from "@/lib/utils";

type EvidenceImageGalleryProps = {
  className?: string;
  emptyLabel?: string;
  images?: string[] | null;
  label?: string;
};

export function EvidenceImageGallery({
  className,
  emptyLabel,
  images,
  label = "Ảnh minh chứng",
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
      <div className="flex items-center gap-2 text-sm font-medium">
        <Images className="size-4 text-primary" />
        {label}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
        {availableImages.map((imageUrl, index) => (
          <a
            aria-label={`Mở ảnh minh chứng ${index + 1}`}
            className="group relative aspect-square overflow-hidden rounded-md border bg-muted outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring"
            href={imageUrl}
            key={`${imageUrl}-${index}`}
            rel="noreferrer"
            target="_blank"
          >
            <span
              className="block size-full bg-cover bg-center transition-transform group-hover:scale-105"
              role="img"
              style={{ backgroundImage: `url("${imageUrl}")` }}
            />
            <span className="absolute right-1 top-1 rounded-sm bg-black/65 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <ExternalLink className="size-3" />
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
