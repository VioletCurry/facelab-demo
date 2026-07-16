export function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char];
  });
}

export function testMetricText(
  run,
  { qualityGateLabels = {}, defaultRenderVersion } = {}
) {
  const gate = run.qualityGateLabel ?? qualityGateLabels[run.qualityGate] ?? "未分级";
  const version = run.renderVersion ?? defaultRenderVersion;
  if (run.quality == null) return `未识别人脸，仅记录问卷推荐 / ${gate} / ${version}`;
  const light = run.luminance < 34 ? "偏暗" : run.luminance > 78 ? "偏亮" : "稳定";
  const tone = run.warmth > 18 ? "偏暖" : run.warmth < -8 ? "偏冷" : "中性";
  return `关键点 ${run.quality}% / 光线${light} / ${tone} / ${gate} / ${version}`;
}

export function scoreSummaryText(scores = {}, scoreLabels = {}) {
  const entries = Object.entries(scoreLabels)
    .filter(([key]) => scores[key] != null && scores[key] !== "")
    .map(([key, label]) => `${label}${scores[key]}`);
  return entries.length ? `评分：${entries.join(" / ")}` : "";
}

export function issueSummaryText(issueTags = [], issueLabels = {}) {
  if (!issueTags.length) return "";
  const labels = issueTags.map((tag) => issueLabels[tag] ?? tag);
  return `失败标签：${labels.join(" / ")}`;
}

export function groupFriendReviews(
  reviews = [],
  fallbackRenderVersion = "render-v5-natural-makeup"
) {
  return reviews.reduce((groups, review) => {
    const version = review.renderVersion ?? fallbackRenderVersion;
    groups[version] ??= [];
    groups[version].push(review);
    return groups;
  }, {});
}

export function summarizeFriendReviewGroups(
  reviews = [],
  {
    privacyComfortLabels = {},
    reuseIntentLabels = {},
    fallbackRenderVersion = "render-v5-natural-makeup",
  } = {}
) {
  const averageScore = (versionReviews, key) => {
    const values = versionReviews.map((review) => Number(review[key]) || 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    return (values.length ? total / values.length : 0).toFixed(1);
  };
  const describeCounts = (versionReviews, key, labels) =>
    Object.entries(labels)
      .map(
        ([value, label]) =>
          `${label} ${versionReviews.filter((review) => review[key] === value).length}`
      )
      .join(" / ");

  return Object.entries(groupFriendReviews(reviews, fallbackRenderVersion)).map(
    ([version, versionReviews]) => ({
      version,
      count: versionReviews.length,
      fitScore: averageScore(versionReviews, "fitScore"),
      naturalnessScore: averageScore(versionReviews, "naturalnessScore"),
      privacySummary: describeCounts(
        versionReviews,
        "privacyComfort",
        privacyComfortLabels
      ),
      reuseSummary: describeCounts(versionReviews, "reuseIntent", reuseIntentLabels),
      notes: versionReviews
        .filter((review) => review.note)
        .slice(0, 3)
        .map((review) => escapeHtml(String(review.note))),
    })
  );
}

export function friendReviewSummaryHtml(reviews = [], options = {}) {
  if (!reviews.length) {
    return `<p>还没有朋友试玩总结。完成 5 条后，再根据贴合度、自然度和复用意愿决定是否继续迭代。</p>`;
  }

  return summarizeFriendReviewGroups(reviews, options)
    .map(
      (summary) => `
        <article>
          <strong>${summary.version}：${summary.count} 条</strong>
          <span>推荐贴合度 ${summary.fitScore} / 5；妆效自然度 ${summary.naturalnessScore} / 5</span>
          <small>隐私：${summary.privacySummary}</small>
          <small>复用：${summary.reuseSummary}</small>
          ${summary.notes.map((note) => `<small>${note}</small>`).join("")}
        </article>
      `
    )
    .join("");
}
