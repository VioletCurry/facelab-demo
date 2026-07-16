import { clamp, mapRange } from "./geometry.mjs";

export function neutralTone() {
  return { r: 168, g: 136, b: 124, luminance: 0.56, warmth: 0.18 };
}

export function makeupVisibilityMultiplier(tone, existingMakeup = "bare") {
  const luminance = tone?.luminance ?? 0.56;
  const darkContrastBoost = clamp(mapRange(luminance, 0.18, 0.46, 1.28, 1.06), 1.06, 1.28);
  const brightContrastBoost = clamp(mapRange(luminance, 0.76, 0.95, 1, 1.1), 1, 1.1);
  const existingMakeupBoost = {
    bare: 1,
    light: 1.08,
    visible: 1.18,
  }[existingMakeup] ?? 1;
  return darkContrastBoost * brightContrastBoost * existingMakeupBoost;
}

export function adaptEyeShadowColor(hex, tone, warmSafe) {
  const color = adaptMakeupColor(hex, tone, {
    mix: 0.05,
    lightBoost: 0.94,
    minimumContrast: 0.14,
    warmSafe,
  });
  if (!warmSafe) return color;

  const warmAmount = clamp(mapRange(tone?.warmth ?? 0.08, 0.08, 0.32, 0.24, 0.48), 0.24, 0.48);
  const warmed = mixRgb(color, { r: 142, g: 91, b: 58 }, warmAmount);
  return {
    r: warmed.r,
    g: Math.max(warmed.g, warmed.r * 0.58),
    b: Math.min(warmed.b, warmed.r * 0.62),
  };
}

export function adaptMakeupColor(hex, tone, options = {}) {
  const { mix = 0.1, lightBoost = 1, minimumContrast = 0.12, warmSafe = false } = options;
  const base = hexToRgb(hex);
  const luminance = tone?.luminance ?? 0.56;
  const lightScale = clamp(mapRange(luminance, 0.2, 0.82, 1.12, 0.98), 0.98, 1.12) * lightBoost;
  let warmed = {
    r: base.r * lightScale * (1 + clamp(tone?.warmth ?? 0, -0.12, 0.18) * 0.08),
    g: base.g * lightScale,
    b: base.b * lightScale * (1 - clamp(tone?.warmth ?? 0, -0.12, 0.18) * 0.05),
  };
  if (warmSafe) {
    const warmAmount = clamp(mapRange(tone?.warmth ?? 0.08, 0.08, 0.32, 0.18, 0.42), 0.18, 0.42);
    warmed = mixRgb(warmed, { r: 146, g: 96, b: 70 }, warmAmount);
    warmed.b = Math.min(warmed.b, warmed.r * 0.78);
  }
  const toneMix = clamp(mix * mapRange(luminance, 0.2, 0.82, 0.62, 1), 0.04, mix);
  return ensureColorContrast(mixRgb(warmed, tone ?? neutralTone(), toneMix), tone, minimumContrast);
}

export function ensureColorContrast(color, tone, minimumContrast) {
  const toneLuminance = tone?.luminance ?? 0.56;
  const colorLuminance = (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255;
  if (Math.abs(colorLuminance - toneLuminance) >= minimumContrast) return color;

  const targetLuminance =
    toneLuminance < 0.46
      ? Math.min(0.93, toneLuminance + minimumContrast)
      : Math.max(0.07, toneLuminance - minimumContrast);
  const scale = targetLuminance / Math.max(colorLuminance, 0.05);
  return {
    r: clamp(color.r * scale, 0, 255),
    g: clamp(color.g * scale, 0, 255),
    b: clamp(color.b * scale, 0, 255),
  };
}

export function withAlpha(hex, alpha) {
  return rgbaFromRgb(hexToRgb(hex), alpha);
}

export function colorWithAlpha(color, alpha) {
  return typeof color === "string" ? withAlpha(color, alpha) : rgbaFromRgb(color, alpha);
}

export function rgbaFromRgb(rgb, alpha) {
  const r = Math.round(clamp(rgb.r, 0, 255));
  const g = Math.round(clamp(rgb.g, 0, 255));
  const b = Math.round(clamp(rgb.b, 0, 255));
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

export function mixRgb(a, b, amount) {
  const weight = clamp(amount, 0, 1);
  return {
    r: a.r * (1 - weight) + b.r * weight,
    g: a.g * (1 - weight) + b.g * weight,
    b: a.b * (1 - weight) + b.b * weight,
  };
}

export function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

export function lightenHex(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (channel) => Math.round(channel + (255 - channel) * amount);
  return rgbToHex(mix(r), mix(g), mix(b));
}

export function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((channel) => Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, "0"))
    .join("")}`;
}
