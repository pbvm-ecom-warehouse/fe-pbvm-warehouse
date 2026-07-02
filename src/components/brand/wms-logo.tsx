import { cn } from "@/lib/utils";

type WmsLogoProps = {
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
  subtitle?: string;
};

const markSizes = {
  lg: "size-14",
  md: "size-11",
  sm: "size-10",
};

const wordmarkSizes = {
  lg: "text-2xl",
  md: "text-lg",
  sm: "text-lg",
};

export function WmsLogo({
  className,
  showWordmark = true,
  size = "md",
  subtitle,
}: WmsLogoProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <WmsLogoMark className={markSizes[size]} />
      {showWordmark ? (
        <div className="min-w-0">
          <div
            className={cn(
              "truncate font-extrabold leading-none tracking-[0.18em] text-foreground",
              wordmarkSizes[size],
            )}
          >
            WMS
          </div>
          {subtitle ? (
            <div className="mt-1 truncate text-xs font-medium text-muted-foreground">
              {subtitle}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function WmsLogoMark({ className }: { className?: string }) {
  return (
    <svg
      aria-label="WMS"
      className={cn("shrink-0 drop-shadow-[0_14px_22px_rgba(30,64,175,0.22)]", className)}
      role="img"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M32 5 56 18.5 32 32 8 18.5 32 5Z" fill="#0f172a" />
      <path d="M32 14 51 24.7 32 35.4 13 24.7 32 14Z" fill="#bfdbfe" />
      <path d="M8 22.5 29.2 34.4v24.1L8 46.6V22.5Z" fill="#1e40af" />
      <path d="M34.8 34.4 56 22.5v24.1L34.8 58.5V34.4Z" fill="#3b82f6" />
      <path
        d="M35 35.5c8.3 1.5 14.1 6 17 12.1-6 8-14.5 10-17 10V35.5Z"
        fill="#1e40af"
      />
      <path
        d="M35.3 56.7c5.5-9.7 11.4-14.2 20.2-18.2"
        fill="none"
        stroke="#ffffff"
        strokeLinecap="round"
        strokeWidth="4.8"
      />
      <path d="M29.2 34.4 32 35.9l2.8-1.5" fill="none" stroke="#ffffff" strokeWidth="3" />
      <path d="M32 14v21.9" stroke="#ffffff" strokeLinecap="round" strokeWidth="3" />
      <path
        d="M15.2 35.6h10.9M15.2 45.3h10.9"
        stroke="#ffffff"
        strokeLinecap="square"
        strokeWidth="5"
      />
      <path
        d="M8 18.5 32 32l24-13.5M32 32v26.5"
        fill="none"
        stroke="#ffffff"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}
