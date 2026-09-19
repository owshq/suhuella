import { brand } from "@suhuella/brand";
import { BrandMark } from "./BrandMark";

type SuhuellaWordmarkProps = {
  className?: string;
  glyphClassName?: string;
  textClassName?: string;
  variant?: "horizontal" | "compact";
  tagline?: string;
  taglineClassName?: string;
};

export function SuhuellaWordmark({
  className = "",
  glyphClassName = "h-5 w-5 shrink-0",
  textClassName = "text-sm font-semibold tracking-[-0.02em] text-slate-900",
  variant = "horizontal",
  tagline,
  taglineClassName = "text-xs text-slate-500",
}: SuhuellaWordmarkProps) {
  if (variant === "compact") {
    return <BrandMark className={glyphClassName} aria-label={brand.displayName} />;
  }

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`.trim()}>
      <BrandMark className={glyphClassName} />
      <span className="min-w-0">
        <span className={`block ${textClassName}`.trim()}>{brand.displayName}</span>
        {tagline ? (
          <span className={`mt-0.5 block ${taglineClassName}`.trim()}>{tagline}</span>
        ) : null}
      </span>
    </span>
  );
}
