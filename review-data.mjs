export const FEEDBACK_LABELS = Object.freeze({
  like: "喜欢",
  dislike: "不喜欢",
  lighter: "太浓",
  stronger: "太淡",
  "wrong-color": "色不对",
  "wrong-style": "风格不对",
  switch: "换风格",
});

export const REVIEW_CSV_COLUMNS = Object.freeze([
  ["recordType", "record_type"],
  ["recordId", "record_id"],
  ["createdAt", "created_at"],
  ["label", "label"],
  ["sampleLabel", "sample_label"],
  ["lookName", "look_name"],
  ["recommendationSource", "recommendation_source"],
  ["recommendationConfidence", "recommendation_confidence"],
  ["occasion", "occasion"],
  ["goal", "goal"],
  ["finish", "finish"],
  ["budget", "budget"],
  ["existingMakeup", "existing_makeup"],
  ["baseCoverage", "base_coverage"],
  ["browStyle", "brow_style"],
  ["eyeFocus", "eye_focus"],
  ["lipTexture", "lip_texture"],
  ["qualityPercent", "quality_percent"],
  ["luminancePercent", "luminance_percent"],
  ["warmthPercent", "warmth_percent"],
  ["qualityGate", "quality_gate"],
  ["renderVersion", "render_version"],
  ["makeupStepId", "makeup_step_id"],
  ["makeupStepFeedback", "makeup_step_feedback"],
  ["issueTags", "issue_tags"],
  ["landmarkStabilityScore", "landmark_stability_score"],
  ["lipEdgeScore", "lip_edge_score"],
  ["lipTextureScore", "lip_texture_score"],
  ["lipNaturalnessScore", "lip_naturalness_score"],
  ["blushPlacementScore", "blush_placement_score"],
  ["blushColorScore", "blush_color_score"],
  ["blushNaturalnessScore", "blush_naturalness_score"],
  ["eyeshadowAlignmentScore", "eyeshadow_alignment_score"],
  ["colorVisibilityScore", "color_visibility_score"],
  ["recommendationTasteScore", "recommendation_taste_score"],
  ["explanationTrustScore", "explanation_trust_score"],
  ["privacyComfort", "privacy_comfort"],
  ["fitScore", "fit_score"],
  ["naturalnessScore", "naturalness_score"],
  ["reuseIntent", "reuse_intent"],
  ["note", "note"],
  ["privacy", "privacy"],
]);

export function feedbackLabel(type) {
  return FEEDBACK_LABELS[type] ?? "其他";
}

export function summarizeFeedback(history = []) {
  if (!history.length) return { total: 0, text: "暂无反馈" };
  return summarizeLabels(history, (item) => item.label ?? feedbackLabel(item.type));
}

export function summarizeExpertReviews(reviews = [], ratingLabels = {}) {
  if (!reviews.length) return { total: 0, text: "暂无专家评审" };
  return summarizeLabels(reviews, (item) => item.ratingLabel ?? ratingLabels[item.rating] ?? "其他");
}

export function signalPercent(value) {
  if (value == null || value === "") return "";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : "";
}

export function buildReviewRows({
  feedback = [],
  testRuns = [],
  makeupStepFeedback = [],
  friendReviews = [],
  expertReviews = [],
  expertRatingLabels = {},
}) {
  const feedbackRows = feedback.map((item) => ({
    recordType: "user_feedback",
    recordId: "",
    createdAt: item.at,
    label: item.label ?? feedbackLabel(item.type),
    sampleLabel: "",
    lookName: item.lookName,
    recommendationSource: item.recommendationSource,
    recommendationConfidence: item.recommendationConfidence,
    ...preferenceColumns(item.preferences),
    ...signalColumns(item.signals),
    renderVersion: item.renderVersion ?? "render-v5-natural-makeup",
    note: item.note ?? "",
    privacy: "no_image_or_video_frame",
  }));

  const testRows = testRuns.map((run) => ({
    recordType: "photo_test",
    recordId: run.id,
    createdAt: run.at,
    label: "测试记录",
    sampleLabel: run.sampleLabel,
    lookName: run.lookName,
    recommendationSource: run.source,
    recommendationConfidence: run.recommendationConfidence ?? "",
    ...preferenceColumns(run.preferences),
    qualityPercent: run.quality ?? "",
    luminancePercent: run.luminance ?? "",
    warmthPercent: run.warmth ?? "",
    qualityGate: run.qualityGate ?? "",
    renderVersion: run.renderVersion ?? "",
    issueTags: (run.issueTags ?? []).join(";"),
    landmarkStabilityScore: run.scores?.landmarkStability ?? "",
    lipEdgeScore: run.scores?.lipEdge ?? "",
    lipTextureScore: run.scores?.lipTexture ?? "",
    lipNaturalnessScore: run.scores?.lipNaturalness ?? "",
    blushPlacementScore: run.scores?.blushPlacement ?? "",
    blushColorScore: run.scores?.blushColor ?? "",
    blushNaturalnessScore: run.scores?.blushNaturalness ?? "",
    eyeshadowAlignmentScore: run.scores?.eyeshadowAlignment ?? "",
    colorVisibilityScore: run.scores?.colorVisibility ?? "",
    recommendationTasteScore: run.scores?.recommendationTaste ?? "",
    explanationTrustScore: run.scores?.explanationTrust ?? "",
    note: run.note,
    privacy: "no_image_or_video_frame",
  }));

  const makeupRows = makeupStepFeedback.map((item) => ({
    recordType: "makeup_step_feedback",
    recordId: item.id,
    createdAt: item.at,
    label: item.label,
    makeupStepId: item.stepId,
    makeupStepFeedback: item.value,
    sampleLabel: "",
    lookName: item.lookName,
    ...preferenceColumns(item.preferences),
    renderVersion: item.renderVersion ?? "render-v5-natural-makeup",
    note: item.stepLabel,
    privacy: "no_image_or_video_frame",
  }));

  const friendRows = friendReviews.map((review) => ({
    recordType: "friend_review",
    recordId: review.id,
    createdAt: review.at,
    label: "friend_test_summary",
    lookName: review.lookName,
    recommendationSource: review.recommendationSource,
    recommendationConfidence: review.recommendationConfidence,
    ...preferenceColumns(review.preferences),
    ...signalColumns(review.signals),
    renderVersion: review.renderVersion ?? "render-v5-natural-makeup",
    privacyComfort: review.privacyComfort,
    fitScore: review.fitScore,
    naturalnessScore: review.naturalnessScore,
    reuseIntent: review.reuseIntent,
    note: review.note,
    privacy: "no_image_or_video_frame",
  }));

  const expertRows = expertReviews.map((review) => ({
    recordType: "expert_review",
    recordId: review.id,
    createdAt: review.at,
    label: review.ratingLabel ?? expertRatingLabels[review.rating],
    sampleLabel: review.sampleLabel,
    lookName: review.lookName,
    recommendationSource: review.recommendationSource,
    recommendationConfidence: review.recommendationConfidence,
    ...preferenceColumns(review.preferences),
    ...signalColumns(review.signals),
    renderVersion: review.renderVersion ?? "render-v5-natural-makeup",
    note: review.note,
    privacy: "no_image_or_video_frame",
  }));

  return [...testRows, ...feedbackRows, ...makeupRows, ...friendRows, ...expertRows].sort((a, b) =>
    String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
  );
}

export function toCsv(rows, columns = REVIEW_CSV_COLUMNS) {
  const header = columns.map(([, label]) => csvCell(label)).join(",");
  const body = rows.map((row) => columns.map(([key]) => csvCell(row[key])).join(","));
  return [header, ...body].join("\r\n");
}

function summarizeLabels(items, labelFor) {
  const counts = items.reduce((acc, item) => {
    const label = labelFor(item);
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});
  return {
    total: items.length,
    text: Object.entries(counts)
      .map(([label, count]) => `${label} ${count}`)
      .join(" / "),
  };
}

function preferenceColumns(preferences = {}) {
  return {
    occasion: preferences?.occasion ?? "",
    goal: preferences?.goal ?? "",
    finish: preferences?.finish ?? "",
    budget: preferences?.budget ?? "",
    existingMakeup: preferences?.existingMakeup ?? "",
    baseCoverage: preferences?.baseCoverage ?? "",
    browStyle: preferences?.browStyle ?? "",
    eyeFocus: preferences?.eyeFocus ?? "",
    lipTexture: preferences?.lipTexture ?? "",
  };
}

function signalColumns(signals = {}) {
  return {
    qualityPercent: signalPercent(signals?.quality),
    luminancePercent: signalPercent(signals?.luminance),
    warmthPercent: signalPercent(signals?.warmth),
  };
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}
