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
