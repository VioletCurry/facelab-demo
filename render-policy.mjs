export const qualityGateLabels = {
  good_for_tryon: "适合试妆",
  usable_but_unstable: "可用但不稳定",
  retake_recommended: "建议重拍",
  cannot_analyze: "无法分析",
};

export function qualityGateFromSignals(signals) {
  if (!signals) {
    return { id: "cannot_analyze", label: qualityGateLabels.cannot_analyze };
  }

  const quality = signals.quality ?? 0;
  const yaw = signals.pose?.yaw ?? 0;
  const mouthOpen = signals.pose?.mouthOpen ?? 0;

  if (quality < 0.32) {
    return { id: "cannot_analyze", label: qualityGateLabels.cannot_analyze };
  }
  if (quality < 0.48 || yaw > 0.16 || mouthOpen > 0.12) {
    return { id: "retake_recommended", label: qualityGateLabels.retake_recommended };
  }
  if (quality < 0.72 || yaw > 0.08 || mouthOpen > 0.08) {
    return { id: "usable_but_unstable", label: qualityGateLabels.usable_but_unstable };
  }
  return { id: "good_for_tryon", label: qualityGateLabels.good_for_tryon };
}

export function recommendationConfidenceCap(gateId) {
  return {
    good_for_tryon: 96,
    usable_but_unstable: 68,
    retake_recommended: 44,
    cannot_analyze: 0,
  }[gateId] ?? 0;
}

const v5LipTextureRenderProfile = {
  id: "v5-baseline",
  softAlpha: 0.64,
  pigmentAlpha: 0.54,
  softBlurScale: 1.3,
  pigmentBlurScale: 1,
  outlineHighlightAlpha: 0.17,
  innerHighlightAlpha: 0.17,
  highlightWidthScale: 0.018,
  highlightBlur: 0.55,
  centerAlpha: 0,
  centerBlurScale: 1,
  centerRadiusScale: 0.54,
  glossSpotAlpha: 0,
  glossSpotWidthScale: 0.12,
  glossSpotHeightScale: 0.026,
  glossSpotBlur: 0.45,
};

const experimentalLipTextureRenderProfiles = {
  stain: {
    id: "stain",
    softAlpha: 0.48,
    pigmentAlpha: 0.24,
    softBlurScale: 1.52,
    pigmentBlurScale: 1.32,
    outlineHighlightAlpha: 0,
    innerHighlightAlpha: 0.01,
    highlightWidthScale: 0.014,
    highlightBlur: 0.8,
    centerAlpha: 0.24,
    centerBlurScale: 0.9,
    centerRadiusScale: 0.38,
    glossSpotAlpha: 0,
    glossSpotWidthScale: 0.12,
    glossSpotHeightScale: 0.026,
    glossSpotBlur: 0.45,
  },
  satin: {
    id: "satin",
    softAlpha: 0.56,
    pigmentAlpha: 0.47,
    softBlurScale: 1.22,
    pigmentBlurScale: 0.95,
    outlineHighlightAlpha: 0.025,
    innerHighlightAlpha: 0.15,
    highlightWidthScale: 0.018,
    highlightBlur: 0.9,
    centerAlpha: 0.02,
    centerBlurScale: 0.9,
    centerRadiusScale: 0.5,
    glossSpotAlpha: 0,
    glossSpotWidthScale: 0.12,
    glossSpotHeightScale: 0.026,
    glossSpotBlur: 0.45,
  },
  mist: {
    id: "mist",
    softAlpha: 0.58,
    pigmentAlpha: 0.44,
    softBlurScale: 1.6,
    pigmentBlurScale: 1.24,
    outlineHighlightAlpha: 0,
    innerHighlightAlpha: 0,
    highlightWidthScale: 0.014,
    highlightBlur: 0.9,
    centerAlpha: 0,
    centerBlurScale: 1.25,
    centerRadiusScale: 0.54,
    glossSpotAlpha: 0,
    glossSpotWidthScale: 0.12,
    glossSpotHeightScale: 0.026,
    glossSpotBlur: 0.45,
  },
  glow: {
    id: "glow",
    softAlpha: 0.48,
    pigmentAlpha: 0.34,
    softBlurScale: 1.16,
    pigmentBlurScale: 0.9,
    outlineHighlightAlpha: 0.01,
    innerHighlightAlpha: 0.34,
    highlightWidthScale: 0.014,
    highlightBlur: 0.3,
    centerAlpha: 0,
    centerBlurScale: 1.05,
    centerRadiusScale: 0.54,
    glossSpotAlpha: 0.2,
    glossSpotWidthScale: 0.13,
    glossSpotHeightScale: 0.027,
    glossSpotBlur: 0.4,
  },
};

export function lipTextureRenderProfile(texture, experimental = false) {
  if (!experimental) return { ...v5LipTextureRenderProfile };
  return {
    ...(experimentalLipTextureRenderProfiles[texture] ?? experimentalLipTextureRenderProfiles.stain),
  };
}

const adaptiveBlushProfiles = {
  round: {
    id: "round",
    outward: 0.72,
    vertical: 0.52,
    radiusXScale: 0.13,
    radiusYScale: 0.065,
    tilt: 0.2,
    intensityScale: 0.78,
  },
  long: {
    id: "long",
    outward: 0.58,
    vertical: 0.7,
    radiusXScale: 0.145,
    radiusYScale: 0.055,
    tilt: 0.04,
    intensityScale: 0.76,
  },
  heart: {
    id: "heart",
    outward: 0.58,
    vertical: 0.68,
    radiusXScale: 0.125,
    radiusYScale: 0.062,
    tilt: 0.06,
    intensityScale: 0.76,
  },
  square: {
    id: "square",
    outward: 0.68,
    vertical: 0.56,
    radiusXScale: 0.135,
    radiusYScale: 0.068,
    tilt: 0.17,
    intensityScale: 0.74,
  },
  oval: {
    id: "oval",
    outward: 0.64,
    vertical: 0.6,
    radiusXScale: 0.125,
    radiusYScale: 0.064,
    tilt: 0.14,
    intensityScale: 0.78,
  },
};

export function adaptiveBlushProfile({ faceHeight = 1, faceWidth = 1, foreheadWidth = 1, jawWidth = 1 } = {}) {
  const width = Math.max(faceWidth, 0.000001);
  const lengthRatio = faceHeight / width;
  const foreheadRatio = foreheadWidth / width;
  const jawRatio = jawWidth / width;
  const taperRatio = foreheadRatio - jawRatio;
  const smoothRange = (value, start, end) => {
    const progress = Math.max(0, Math.min(1, (value - start) / Math.max(end - start, 0.000001)));
    return progress * progress * (3 - 2 * progress);
  };

  // MediaPipe's temple landmarks make foreheadRatio cluster near 1.0 in real
  // photos. Blend several placement tendencies instead of forcing every face
  // through one brittle categorical threshold.
  const scores = {
    long: smoothRange(lengthRatio, 1.3, 1.44) * 1.6,
    round:
      smoothRange(1.24 - lengthRatio, 0, 0.16) *
      (1 - smoothRange(taperRatio, 0.23, 0.31) * 0.35),
    heart:
      smoothRange(taperRatio, 0.2, 0.3) *
      smoothRange(0.86 - jawRatio, 0, 0.12) *
      2.2,
    square:
      smoothRange(jawRatio, 0.77, 0.84) *
      smoothRange(1.38 - lengthRatio, 0, 0.18) *
      1.8,
    oval:
      0.58 + smoothRange(0.18 - Math.abs(lengthRatio - 1.27), 0, 0.14) * 0.28,
  };
  const scoreTotal = Object.values(scores).reduce((total, score) => total + score, 0);
  const weights = Object.fromEntries(
    Object.entries(scores).map(([id, score]) => [id, score / scoreTotal]),
  );
  const shape = Object.entries(scores).reduce(
    (best, current) => (current[1] > best[1] ? current : best),
    ["oval", -Infinity],
  )[0];
  const blendedValue = (key) =>
    Object.entries(weights).reduce(
      (value, [id, weight]) => value + adaptiveBlushProfiles[id][key] * weight,
      0,
    );

  return {
    id: shape,
    outward: blendedValue("outward"),
    vertical: blendedValue("vertical"),
    radiusXScale: blendedValue("radiusXScale"),
    radiusYScale: blendedValue("radiusYScale"),
    tilt: blendedValue("tilt"),
    intensityScale: blendedValue("intensityScale"),
    lengthRatio: Number(lengthRatio.toFixed(3)),
    foreheadRatio: Number(foreheadRatio.toFixed(3)),
    jawRatio: Number(jawRatio.toFixed(3)),
    weights: Object.fromEntries(
      Object.entries(weights).map(([id, weight]) => [id, Number(weight.toFixed(3))]),
    ),
  };
}

export function adaptiveBlushColorProfile({ luminance = 0.56, warmth = 0.08 } = {}) {
  const family = warmth > 0.18 ? "warm-coral" : warmth < 0.02 ? "cool-rose" : "neutral-rose";
  const tint = {
    "warm-coral": { r: 190, g: 108, b: 94 },
    "cool-rose": { r: 178, g: 104, b: 132 },
    "neutral-rose": { r: 186, g: 108, b: 116 },
  }[family];

  return {
    family,
    tint,
    tintMix: family === "neutral-rose" ? 0.08 : 0.12,
    toneMix: 0.18,
    lightBoost: luminance < 0.36 ? 1.05 : 1,
    minimumContrast: 0.1,
  };
}

export function adaptiveBlushCenters({
  nose,
  leftOuter,
  rightOuter,
  leftLegacy,
  rightLegacy,
  eyeLineY,
  profile,
  blend = 0.72,
}) {
  const weight = Math.min(1, Math.max(0, blend));
  const adaptiveY = eyeLineY + (nose.y - eyeLineY) * profile.vertical;
  const structuralLeft = {
    x: nose.x + (leftOuter.x - nose.x) * profile.outward,
    y: adaptiveY,
  };
  const structuralRight = {
    x: nose.x + (rightOuter.x - nose.x) * profile.outward,
    y: adaptiveY,
  };
  const mixPoint = (legacy, structural) => ({
    x: legacy.x * (1 - weight) + structural.x * weight,
    y: legacy.y * (1 - weight) + structural.y * weight,
  });

  return {
    left: mixPoint(leftLegacy, structuralLeft),
    right: mixPoint(rightLegacy, structuralRight),
  };
}

export function adaptiveBlushSideScale({ sideSpan = 1, averageSpan = 1, sideOpacity = 1 } = {}) {
  const safeAverage = Math.max(averageSpan, 0.000001);
  const projection = Math.min(1.18, Math.max(0.72, sideSpan / safeAverage));
  const radiusXScale = Math.min(1.1, Math.max(0.82, 0.45 + projection * 0.55));
  const radiusYScale = Math.min(1.04, Math.max(0.96, 0.96 + projection * 0.04));
  const balancedOpacity = 0.45 + Math.min(1, Math.max(0, sideOpacity)) * 0.55;
  const areaCompensation = Math.min(1.12, Math.max(0.94, Math.sqrt(1 / projection)));

  return {
    projection: Number(projection.toFixed(3)),
    radiusXScale: Number(radiusXScale.toFixed(3)),
    radiusYScale: Number(radiusYScale.toFixed(3)),
    opacityScale: Number(Math.min(1.05, Math.max(0.78, balancedOpacity * areaCompensation)).toFixed(3)),
  };
}
