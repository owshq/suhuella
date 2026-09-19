import type { BrandConfig, BrandTheme } from "./types.ts";

export const HEX_COLOR = /^#([0-9a-fA-F]{6})$/;
const WHITE = "#FFFFFF";
const BLACK = "#000000";

export type ResolvedBrandTheme = Required<BrandTheme>;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value.trim());
}

export function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const match = HEX_COLOR.exec(hex.trim());
  if (!match) return null;
  const value = match[1];
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function channelLuminance(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  return 0.2126 * channelLuminance(rgb.r) + 0.7152 * channelLuminance(rgb.g) + 0.0722 * channelLuminance(rgb.b);
}

export function contrastRatio(a: string, b: string): number | null {
  const left = relativeLuminance(a);
  const right = relativeLuminance(b);
  if (left === null || right === null) return null;
  const lighter = Math.max(left, right);
  const darker = Math.min(left, right);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Accent must be usable as text on white or black (4.5:1). */
export function accentReadableOnNeutral(accent: string): boolean {
  const onWhite = contrastRatio(accent, WHITE);
  const onBlack = contrastRatio(accent, BLACK);
  return (onWhite !== null && onWhite >= 4.5) || (onBlack !== null && onBlack >= 4.5);
}

export function darkenHex(hex: string, amount = 0.08): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const scale = Math.max(0, 1 - amount);
  const toHex = (channel: number) => Math.round(channel * scale).toString(16).padStart(2, "0");
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
}

export function withAlpha(hex: string, alpha = 0.1): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function resolveBrandTheme(theme: BrandTheme): ResolvedBrandTheme {
  const accent = theme.accent.trim().toUpperCase();
  const onAccent = theme.onAccent.trim().toUpperCase();
  return {
    accent,
    onAccent,
    accentHover: (theme.accentHover ?? darkenHex(accent, 0.08)).toUpperCase(),
    accentMuted: theme.accentMuted ?? withAlpha(accent, 0.1),
  };
}

export function brandThemeCssVars(theme: BrandTheme): Record<string, string> {
  const resolved = resolveBrandTheme(theme);
  return {
    "--brand-accent": resolved.accent,
    "--brand-accent-hover": resolved.accentHover,
    "--brand-accent-muted": resolved.accentMuted,
    "--brand-on-accent": resolved.onAccent,
    "--nav-active-bg": resolved.accent,
    "--nav-active-fg": resolved.onAccent,
    "--overlay-strong": resolved.accent,
  };
}

export function brandPresentationCssVars(config: BrandConfig): Record<string, string> {
  return {
    ...brandThemeCssVars(config.theme),
    "--brand-surface": config.pwa.backgroundColor,
    "--landing-bg": config.pwa.backgroundColor,
  };
}

export function assertBrandTheme(theme: BrandTheme, brandId: string): void {
  if (!isHexColor(theme.accent)) {
    throw new Error(`${brandId} theme.accent must be #RRGGBB`);
  }
  if (!isHexColor(theme.onAccent)) {
    throw new Error(`${brandId} theme.onAccent must be #RRGGBB`);
  }
  if (theme.accentHover && !isHexColor(theme.accentHover)) {
    throw new Error(`${brandId} theme.accentHover must be #RRGGBB`);
  }
  if (!accentReadableOnNeutral(theme.accent)) {
    throw new Error(`${brandId} theme.accent must contrast 4.5:1 against white or black`);
  }
}
