import { BrandMark } from "./BrandMark";

type SuhuellaLogoProps = {
  className?: string;
  "aria-label"?: string;
};

/** Compatibility name. Visual identity comes from the selected Brand. */
export function SuhuellaLogo({ className = "h-5 w-5", "aria-label": ariaLabel }: SuhuellaLogoProps) {
  return <BrandMark className={className} aria-label={ariaLabel} />;
}
