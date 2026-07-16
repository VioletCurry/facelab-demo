export function confidenceBand(confidence) {
  if (confidence >= 84) return "high";
  if (confidence >= 70) return "medium";
  return "low";
}

export function buildRecommendationResultPayload({
  createdAt,
  intake,
  faceSignals,
  qualityGate,
  recommendation,
  activeLook,
  fallbackReason,
  makeupPlan,
  styleItems,
  sampleLabel,
  renderVersion,
  issueTags,
  scores,
  reviewNote,
  makeupStepFeedback,
}) {
  const planStep = (id) => makeupPlan.find((step) => step.id === id)?.recommendation ?? "";
  return {
    schemaVersion: 1,
    createdAt,
    intake: { ...intake },
    faceSignals: {
      quality: Number(faceSignals.quality.toFixed(3)),
      luminance: Number(faceSignals.luminance.toFixed(3)),
      warmth: Number(faceSignals.warmth.toFixed(3)),
      qualityTier: qualityGate.id,
      notes: faceSignals.summary ? [faceSignals.summary] : [],
    },
    qualityGate: qualityGate.id,
    recommendation: {
      lookId: recommendation?.lookId ?? activeLook.id,
      lookName: recommendation?.lookName ?? activeLook.name,
      source: recommendation?.source === "face" ? "face_fusion" : "questionnaire",
      confidenceBand: confidenceBand(recommendation?.confidence),
      reason: recommendation?.reason ?? fallbackReason,
      caveat: qualityGate.id === "good_for_tryon" ? "" : qualityGate.label,
    },
    makeupPlan: {
      base: planStep("base"),
      concealer: planStep("concealer"),
      brows: planStep("brows"),
      eyeliner: planStep("eyeliner"),
      lashes: planStep("lashes"),
      eye: planStep("eye"),
      blush: planStep("blush"),
      highlightContour: planStep("highlightContour"),
      setting: planStep("setting"),
      lip: planStep("lip"),
      steps: makeupPlan.map((step) => ({
        id: step.id,
        category: step.category,
        recommendation: step.recommendation,
        guidance: step.guidance,
        caution: step.caution,
        productDirection: step.productDirection,
        visualPreview: step.visualPreview,
      })),
    },
    stylePlan: {
      hair: styleItems["发型"] ?? "",
      outfitPalette: String(styleItems["穿搭色"] ?? "")
        .split(/[、,/]/)
        .map((item) => item.trim())
        .filter(Boolean),
      productCategories: makeupPlan.map((step) => ({
        category: step.category,
        guidance: `${step.recommendation} / ${step.productDirection}`,
        budgetTier: intake.budget,
      })),
    },
    validation: {
      sampleLabel,
      renderVersion,
      issueTags,
      scores,
      reviewNote,
    },
    makeupStepFeedback: makeupStepFeedback.map((item) => ({
      stepId: item.stepId,
      stepLabel: item.stepLabel,
      value: item.value,
      label: item.label,
      lookId: item.lookId,
      lookName: item.lookName,
      intake: item.preferences,
      createdAt: item.at,
    })),
  };
}

export function buildLocalDataPayload({
  exportedAt,
  renderVersion,
  qualityGate,
  preferences,
  preferenceLabels,
  activeLook,
  recommendation,
  recommendationResult,
  stylePlan,
  products,
  testRuns,
  feedback,
  friendReviews,
  makeupStepFeedback,
  expertReviews,
}) {
  return {
    schemaVersion: 1,
    exportedAt,
    privacy: {
      includesImages: false,
      includesVideoFrames: false,
      source: "browser-local-summary",
    },
    validationMode: {
      renderVersion,
      qualityGate,
      recommendationSchema: "schemas/recommendation-result.schema.json",
    },
    preferences: { ...preferences, labels: preferenceLabels },
    activeLook: {
      id: activeLook.id,
      name: activeLook.name,
      scene: activeLook.scene,
      colors: {
        lip: activeLook.lip,
        blush: activeLook.blush,
        eye: activeLook.eye,
      },
      intensity: {
        lip: activeLook.lipIntensity,
        blush: activeLook.blushIntensity,
        eye: activeLook.eyeIntensity,
      },
    },
    recommendation,
    recommendationResult,
    stylePlan: stylePlan.map(([title, body]) => ({ title, body })),
    products,
    testRuns,
    feedback,
    friendReviews,
    makeupStepFeedback,
    expertReviews,
  };
}
