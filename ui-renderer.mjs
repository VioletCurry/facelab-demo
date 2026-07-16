import {
  escapeHtml,
  friendReviewSummaryHtml,
  issueSummaryText,
  scoreSummaryText,
  testMetricText,
} from "./ui-formatters.mjs";

export function renderRecommendationPanel(elements, recommendation) {
  if (!recommendation) {
    delete elements.applyButton.dataset.lookId;
    elements.state.textContent = "等待人脸";
    elements.title.textContent = "等待分析";
    elements.reason.textContent = "识别人脸后，会根据光线、角度和当前画面自动挑选更适合的妆容。";
    elements.confidence.textContent = "匹配度 --";
    elements.chips.innerHTML = "";
    elements.applyButton.disabled = true;
    return;
  }

  elements.applyButton.dataset.lookId = recommendation.lookId;
  elements.state.textContent =
    recommendation.canApply === false
      ? "建议重拍"
      : recommendation.source === "face"
        ? "融合推荐"
        : "问询推荐";
  elements.title.textContent = recommendation.lookName;
  elements.reason.textContent = recommendation.reason;
  elements.confidence.textContent =
    recommendation.confidence == null ? "问卷方向" : `匹配度 ${recommendation.confidence}`;
  elements.chips.innerHTML = recommendation.chips.map((chip) => `<span>${chip}</span>`).join("");
  elements.applyButton.disabled = recommendation.canApply === false;
}

export function renderIntakePreviewPanel(elements, recommendation, look) {
  if (!elements.card) return;

  if (!recommendation) {
    elements.state.textContent = "等待选择";
    elements.title.textContent = "等待推荐";
    elements.reason.textContent = "选择场景、目标和妆感后，会先生成一版不需要摄像头的推荐。";
    elements.chips.innerHTML = "";
    elements.swatches.innerHTML = "";
    return;
  }

  elements.state.textContent = recommendation.source === "face" ? "融合推荐" : "问询推荐";
  elements.title.textContent = recommendation.lookName;
  elements.reason.textContent = recommendation.reason;
  elements.chips.innerHTML = recommendation.chips.map((chip) => `<span>${chip}</span>`).join("");
  elements.swatches.innerHTML = look
    ? `
      <span style="background:${look.lip}"></span>
      <span style="background:${look.blush}"></span>
      <span style="background:${look.eye}"></span>
    `
    : "";
}

export function renderLookRecommendationMarker(cards, lookId) {
  cards.forEach((card) => {
    card.classList.toggle("recommended", card.dataset.lookId === lookId);
  });
}

export function renderPreferenceSummary(container, labels) {
  container.innerHTML = labels.map((label) => `<span>${label}</span>`).join("");
}

export function renderProfileSummary(elements, { stateText, metaText, detailText }) {
  elements.state.textContent = stateText;
  elements.summary.innerHTML = `
      <span>${metaText}</span>
      <strong>${detailText}</strong>
    `;
}

export function renderStylePlan(container, items) {
  container.innerHTML = items
    .map(([title, body]) => `<article><span>${title}</span><strong>${body}</strong></article>`)
    .join("");
}

export function renderMakeupPlanSummary(container, plan) {
  const previewCount = plan.filter((step) => step.visualPreview).length;
  container.innerHTML = `
    <div class="makeup-plan-status">
      <span>${previewCount} 项已预览</span>
      <small>${plan.length - previewCount} 项方案建议</small>
    </div>
    <div class="makeup-step-chips">
      ${plan
        .map(
          (step) =>
            `<span class="${step.visualPreview ? "is-previewed" : ""}" style="--step-color:${step.color}">${step.category}</span>`
        )
        .join("")}
    </div>
    <p>${plan.find((step) => step.id === "base")?.guidance ?? ""}</p>
  `;
}

export function renderProductList(elements, { budgetLabel, products }) {
  elements.budgetLabel.textContent = budgetLabel;
  elements.list.innerHTML = products
    .map(
      (item) => `
        <article class="product-card">
          <span class="product-swatch" style="background:${item.color}"></span>
          <div>
            <strong>${item.role}</strong>
            <p>${item.name}</p>
            <small>${item.meta}${item.visualPreview ? " / 已预览" : " / 方案建议"}</small>
          </div>
        </article>
      `
    )
    .join("");
}

export function renderValidationState(elements, { gateLabel, renderVersion }) {
  elements.qualityGate.textContent = gateLabel;
  elements.renderVersion.textContent = renderVersion;
}

export function renderTestRunList(
  elements,
  { runs, qualityGateLabels, defaultRenderVersion, validationScoreLabels, validationIssueLabels }
) {
  elements.count.textContent = `${runs.length} 条`;
  if (!runs.length) {
    elements.list.innerHTML = `<p>上传真实照片后，给样本打标签并记录结果。</p>`;
    return;
  }

  elements.list.innerHTML = runs
    .slice(0, 4)
    .map((run) => {
      const scoreText = scoreSummaryText(run.scores, validationScoreLabels);
      const issueText = issueSummaryText(run.issueTags, validationIssueLabels);
      return `
        <article>
          <strong>${run.sampleLabel}</strong>
          <span>${run.lookName} / ${run.source}</span>
          <small>${testMetricText(run, { qualityGateLabels, defaultRenderVersion })}</small>
          ${scoreText ? `<small>${scoreText}</small>` : ""}
          ${issueText ? `<small>${issueText}</small>` : ""}
          ${run.note ? `<p>${escapeHtml(run.note)}</p>` : ""}
        </article>
      `;
    })
    .join("");
}

export function renderExpertReviewList(elements, reviews) {
  elements.count.textContent = `${reviews.length} 条`;
  if (!reviews.length) {
    elements.list.innerHTML = `<p>专家评审只保存标签、备注和推荐上下文，不保存照片。</p>`;
    return;
  }

  elements.list.innerHTML = reviews
    .slice(0, 4)
    .map(
      (review) => `
        <article>
          <strong>${review.ratingLabel}</strong>
          <span>${review.sampleLabel} / ${review.lookName}</span>
          <small>${review.preferenceLabels?.join(" / ") ?? "未记录偏好标签"}</small>
          ${review.note ? `<p>${escapeHtml(review.note)}</p>` : ""}
        </article>
      `
    )
    .join("");
}

export function renderFriendReviewList(elements, reviews, labelOptions) {
  elements.count.textContent = `${reviews.length} 条`;
  elements.summary.innerHTML = friendReviewSummaryHtml(reviews, labelOptions);
}

export function renderResultSheet(elements, viewModel) {
  elements.mode.textContent = viewModel.mode;
  elements.lookName.textContent = viewModel.lookName;
  elements.reason.textContent = viewModel.reason;
  elements.swatches.innerHTML = viewModel.swatches
    .map((color) => `<span style="background:${escapeHtml(color)}"></span>`)
    .join("");
  elements.profile.innerHTML = viewModel.profileLines
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
  elements.stylePlan.innerHTML = viewModel.styleItems
    .map(
      ([title, body]) =>
        `<article><strong>${escapeHtml(title)}</strong><span>${escapeHtml(body)}</span></article>`
    )
    .join("");
  elements.makeupPlan.innerHTML = viewModel.makeupSteps
    .map((step) => renderResultMakeupStep(step))
    .join("");
  elements.products.innerHTML = viewModel.products
    .map(
      (product) => `
        <article>
          <i style="background:${escapeHtml(product.color)}"></i>
          <strong>${escapeHtml(product.category)}</strong>
          <span>${escapeHtml(product.description)}</span>
        </article>
      `
    )
    .join("");
  elements.tests.innerHTML = viewModel.tests
    .map(
      (test) => `
        <article>
          <strong>${escapeHtml(test.title)}</strong>
          ${test.lines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
        </article>
      `
    )
    .join("");
}

function renderResultMakeupStep(step) {
  const selected = (value) => (step.feedbackValue === value ? " selected" : "");
  return `
    <article class="makeup-plan-card">
      <div class="makeup-plan-card-head">
        <i style="background:${escapeHtml(step.color)}"></i>
        <strong>${escapeHtml(step.category)}</strong>
        <span class="${step.visualPreview ? "is-previewed" : ""}">${step.visualPreview ? "已预览" : "方案建议"}</span>
      </div>
      <p>${escapeHtml(step.recommendation)}</p>
      <small>${escapeHtml(step.guidance)}</small>
      <em>注意：${escapeHtml(step.caution)}</em>
      <label class="makeup-step-feedback">
        <span>这一步反馈</span>
        <select data-makeup-step-feedback="${escapeHtml(step.id)}" aria-label="${escapeHtml(step.category)}反馈">
          <option value="">暂不评价</option>
          <option value="suitable"${selected("suitable")}>适合</option>
          <option value="too_complex"${selected("too_complex")}>太复杂</option>
          <option value="skip"${selected("skip")}>不想做</option>
          <option value="wrong_color"${selected("wrong_color")}>颜色不对</option>
        </select>
      </label>
    </article>
  `;
}
