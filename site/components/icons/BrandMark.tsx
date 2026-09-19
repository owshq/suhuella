import { brand } from "@suhuella/brand";

type BrandMarkProps = {
  className?: string;
  size?: number;
  "aria-label"?: string;
};

/** App icon (blue tile + mark) — not the glyph-only logo SVG. */
export function BrandMark({ className = "", size = 20, "aria-label": ariaLabel }: BrandMarkProps) {
  if (brand.id === "suhuella") {
    return (
      <img
        src={brand.icon.public256}
        alt=""
        width={size}
        height={size}
        aria-hidden={ariaLabel ? undefined : true}
        aria-label={ariaLabel}
        className={`block shrink-0 rounded-[22%] object-contain ${className}`.trim()}
      />
    );
  }

  return (
    <img
      src={brand.logo.publicSvg}
      alt=""
      width={size}
      height={size}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      className={`block shrink-0 object-contain ${className}`.trim()}
    />
  );
}
