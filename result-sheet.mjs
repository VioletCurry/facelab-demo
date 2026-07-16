import {
  issueSummaryText,
  scoreSummaryText,
  testMetricText,
} from "./ui-formatters.mjs";

export function buildResultSheetViewModel({
  recommendation,
  look,
  profileLabels = [],
  profileSummaryText = "",
  styleItems = [],
  makeupPlan = [],
  makeupFeedbackByStep = {},
  testRuns = [],
  feedbackSummary = { total: 0, text: "" },
  expertSummary = { total: 0, text: "" },
  qualityGateLabels = {},
  defaultRenderVersion = "",
  validationScoreLabels = {},
  validationIssueLabels = {},
}) {
  const tests = testRuns.slice(0, 6).map((run) => {
    const scoreText = scoreSummaryText(run.scores, validationScoreLabels);
    const issueText = issueSummaryText(run.issueTags, validationIssueLabels);
    return {
      title: run.sampleLabel,
      lines: [
        `${run.lookName} / ${testMetricText(run, {
          qualityGateLabels,
          defaultRenderVersion,
        })}`,
        scoreText,
        issueText,
      ].filter(Boolean),
    };
  });

  if (!tests.length) {
    tests.push({
      title: "暂无记录",
      lines: ["上传真实照片并记录样本后，这里会显示测试摘要。"],
    });
  }
  if (feedbackSummary.total) {
    tests.push({ title: "反馈摘要", lines: [feedbackSummary.text] });
  }
  if (expertSummary.total) {
    tests.push({ title: "专家评审", lines: [expertSummary.text] });
  }

  return {
    mode: recommendation?.source === "face" ? "脸部融合推荐" : "问卷推荐",
    lookName: look.name,
    reason: recommendation?.reason ?? "等待推荐生成。",
    swatches: [look.lip, look.blush, look.eye],
    profileLines: [
      profileLabels.join(" / "),
      String(profileSummaryText).replace(/\r?\n/g, " "),
    ].filter(Boolean),
    styleItems,
    makeupSteps: makeupPlan.map((step) => ({
      ...step,
      feedbackValue: makeupFeedbackByStep[step.id] ?? "",
    })),
    products: makeupPlan
      .filter((step) => step.visualPreview)
      .map((step) => ({
        category: step.category,
        color: step.color,
        description: `${step.recommendation} / ${step.productDirection}`,
      })),
    tests,
  };
}
