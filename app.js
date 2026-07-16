import {
  qualityGateFromSignals,
  qualityGateLabels,
  recommendationConfidenceCap,
} from "./render-policy.mjs?v=7.3-continuous-cheek";
import { buildCompleteMakeupPlan } from "./makeup-plan.mjs";
import { createCompatibleFaceLandmarker } from "./browser-runtime.mjs?v=7.3-architecture";
import { createAppState } from "./app-state.mjs?v=7.3-architecture";
import {
  buildLocalDataPayload,
  buildRecommendationResultPayload,
} from "./export-data.mjs?v=7.3-architecture";
import {
  estimateFaceQuality,
  landmarkToCanvas,
  measureFacePose,
  realtimeMakeupMultiplier,
  smoothFaceLandmarks,
} from "./face-analysis.mjs?v=7.3-architecture";
import {
  clamp,
  distance,
  mapRange,
} from "./render/geometry.mjs?v=7.3-architecture";
import { neutralTone } from "./render/color.mjs?v=7.3-architecture";
import { clearStores, createArrayStore, createObjectStore } from "./persistence.mjs?v=7.3-architecture";
import { releaseConfig } from "./release-config.mjs?v=7.3-architecture";
import { collectUiRefs } from "./ui-refs.mjs?v=7.3-architecture";
import {
  issueSummaryText,
  scoreSummaryText,
  testMetricText,
} from "./ui-formatters.mjs?v=7.3-architecture";
import {
  renderExpertReviewList,
  renderFriendReviewList,
  renderIntakePreviewPanel,
  renderLookRecommendationMarker,
  renderMakeupPlanSummary as renderMakeupPlanSummaryView,
  renderPreferenceSummary as renderPreferenceSummaryView,
  renderProductList as renderProductListView,
  renderProfileSummary as renderProfileSummaryView,
  renderRecommendationPanel,
  renderStylePlan as renderStylePlanView,
  renderTestRunList,
  renderValidationState as renderValidationStateView,
} from "./ui-renderer.mjs?v=7.3-architecture";
import { createMakeupRenderer, makeupSideVisibility } from "./makeup-renderer.mjs?v=7.3-architecture";
import {
  buildReviewRows,
  feedbackLabel,
  summarizeExpertReviews,
  summarizeFeedback,
  toCsv,
} from "./review-data.mjs?v=7.3-architecture";
import {
  PREFERENCE_PRESETS as preferencePresets,
  budgetHint as budgetHintPure,
  buildPreferenceProfile as buildPreferenceProfilePure,
  guidanceForFace as guidanceForFacePure,
  lightLabel as lightLabelPure,
  preferenceRecommendationReason as preferenceRecommendationReasonPure,
  rankLooksByPreference,
  recommendFromFaceSignals,
  recommendFromPreferences as recommendFromPreferencesPure,
  toneLabel as toneLabelPure,
} from "./recommendation-engine.mjs?v=7.3-architecture";

const guidanceForFace = guidanceForFacePure;
const lightLabel = lightLabelPure;
const toneLabel = toneLabelPure;
const budgetHint = budgetHintPure;

const modelUrl =
  "./models/face_landmarker.task";
const storageKey = "facestyle-ai-mvp-preferences";
const feedbackStorageKey = "facestyle-ai-mvp-feedback";
const makeupStepFeedbackStorageKey = "facestyle-ai-mvp-makeup-step-feedback";
const testRunStorageKey = "facestyle-ai-mvp-test-runs";
const expertReviewStorageKey = "facestyle-ai-mvp-expert-reviews";
const friendReviewStorageKey = "facestyle-ai-mvp-friend-reviews";
const preferenceStore = createObjectStore(storageKey);
const feedbackStore = createArrayStore(feedbackStorageKey, { limit: 50 });
const makeupStepFeedbackStore = createArrayStore(makeupStepFeedbackStorageKey, { limit: 100 });
const testRunStore = createArrayStore(testRunStorageKey, { limit: 50 });
const expertReviewStore = createArrayStore(expertReviewStorageKey, { limit: 50 });
const friendReviewStore = createArrayStore(friendReviewStorageKey, { limit: 50 });
const makeupStepFeedbackPreferenceKeys = [
  "occasion",
  "goal",
  "finish",
  "budget",
  "existingMakeup",
  "baseCoverage",
  "browStyle",
  "eyeFocus",
  "lipTexture",
];

const sampleScenarios = {
  "front-natural": "正脸自然光",
  "warm-light": "暖光室内",
  "low-light": "弱光",
  "side-angle": "侧脸角度",
  "deep-tone": "深肤色",
  "fair-tone": "浅肤色",
};

const expertRatingLabels = {
  suitable: "适合",
  wearable: "可日常",
  "too-strong": "太浓",
  "wrong-color": "色不对",
  "wrong-placement": "位置不对",
  retest: "需复测",
};

const friendPrivacyComfortLabels = {
  comfortable: "放心",
  hesitant: "有点犹豫",
  uncomfortable: "不放心",
};

const friendReuseIntentLabels = {
  yes: "愿意再用",
  maybe: "也许再用",
  no: "不愿再用",
};

const developerMode = releaseConfig.developerTools;
const lipTextureExperimentEnabled = releaseConfig.lipTextureExperiment;
const blushPlacementExperimentEnabled = releaseConfig.blushPlacementExperiment;
const renderVersion = releaseConfig.renderVersion;

const validationScoreLabels = {
  landmarkStability: "关键点",
  lipEdge: "唇线",
  lipTexture: "唇部质地",
  lipNaturalness: "唇部自然度",
  blushPlacement: "腮红位置",
  blushColor: "腮红颜色",
  blushNaturalness: "腮红自然度",
  eyeshadowAlignment: "眼影",
  colorVisibility: "显色",
  recommendationTaste: "审美",
  explanationTrust: "解释",
};

const validationIssueLabels = {
  lip_edge_overdraw: "唇线外溢",
  lip_edge_underfill: "唇线欠填",
  lip_too_strong: "口红过重",
  lip_texture_mismatch: "唇部质地不符",
  lip_mouth_spill: "嘴腔染色",
  lip_teeth_spill: "牙齿染色",
  lip_highlight_drift: "高光漂移",
  lip_texture_flicker: "质地闪烁",
  blush_not_visible: "腮红不可见",
  blush_too_high: "腮红过高",
  blush_too_low: "腮红过低",
  blush_too_inner: "腮红过内",
  blush_too_outer: "腮红过外",
  blush_color_mismatch: "腮红色号不合适",
  blush_asymmetry: "腮红左右不一致",
  eyeshadow_not_visible: "眼影不可见",
  eyeshadow_drift: "眼影漂移",
  color_not_visible: "颜色不可见",
  retake_needed: "需要重拍",
  weak_explanation: "解释偏弱",
  quality_gate_unclear: "质量提示不清",
};

const makeupStepFeedbackLabels = {
  suitable: "适合",
  too_complex: "太复杂",
  skip: "不想做",
  wrong_color: "颜色不对",
};

const budgetProductCopy = {
  starter: {
    label: "平价",
    tier: "开架友好",
    base: "轻薄持妆粉底液",
    lip: "同色系水润唇釉",
    blush: "低饱和单色腮红",
    eye: "三色日常眼影盘",
  },
  balanced: {
    label: "均衡",
    tier: "开架 + 中端",
    base: "柔焦妆前乳 + 自然粉底",
    lip: "细管显色口红",
    blush: "膏状腮红",
    eye: "四色通勤眼影盘",
  },
  premium: {
    label: "进阶",
    tier: "质感优先",
    base: "精华粉底 + 局部遮瑕",
    lip: "丝绒质感唇膏",
    blush: "细闪修容腮红",
    eye: "高贴合粉质眼影",
  },
  sensitive: {
    label: "敏感肌",
    tier: "低刺激表达",
    base: "温和妆前 + 轻遮瑕底妆",
    lip: "滋润型低香精唇膏",
    blush: "轻薄膏状腮红",
    eye: "低闪片哑光眼影",
  },
};

const moodStyleCopy = {
  clean: {
    hair: "低层次锁骨发或干净低马尾",
    outfit: "灰白、雾蓝、浅牛仔",
    focus: "保留皮肤通透感，眉眼线条不要压得太重",
  },
  rose: {
    hair: "轻卷披发或半扎发",
    outfit: "玫瑰粉、烟灰紫、柔白",
    focus: "把腮红和唇色连成柔和气色带",
  },
  sharp: {
    hair: "侧分直发、低盘发或利落短发",
    outfit: "黑白、冷灰、深海军蓝",
    focus: "眉峰和眼尾保持清晰，唇色选择低饱和但有轮廓",
  },
  fresh: {
    hair: "空气感刘海、丸子头或自然内扣",
    outfit: "杏色、浅绿、珊瑚、奶白",
    focus: "腮红位置略高，唇色保留轻盈透明感",
  },
  bold: {
    hair: "湿发感大波浪或高马尾",
    outfit: "黑色、酒红、深棕、金属配饰",
    focus: "降低腮红面积，让唇色和眼部成为主视觉",
  },
};

const looks = [
  {
    id: "clean_daily",
    name: "清透通勤",
    scene: "日常",
    lip: "#b85f6a",
    blush: "#d9968c",
    eye: "#a77a66",
    lipIntensity: 0.54,
    blushIntensity: 0.52,
    eyeIntensity: 0.42,
    profile: { intensity: 0.44, warmth: 0.18, light: 0.54, clarity: 0.72, mood: "clean" },
  },
  {
    id: "soft_rose",
    name: "温柔玫瑰",
    scene: "约会",
    lip: "#c85f73",
    blush: "#e4a0a8",
    eye: "#b98a78",
    lipIntensity: 0.56,
    blushIntensity: 0.58,
    eyeIntensity: 0.46,
    profile: { intensity: 0.5, warmth: 0.12, light: 0.58, clarity: 0.62, mood: "rose" },
  },
  {
    id: "cool_smart",
    name: "冷感利落",
    scene: "面试",
    lip: "#9f5c61",
    blush: "#c4878c",
    eye: "#8c7a72",
    lipIntensity: 0.46,
    blushIntensity: 0.38,
    eyeIntensity: 0.34,
    profile: { intensity: 0.34, warmth: -0.12, light: 0.48, clarity: 0.9, mood: "sharp" },
  },
  {
    id: "sweet_peach",
    name: "元气蜜桃",
    scene: "周末",
    lip: "#e97968",
    blush: "#f0a18f",
    eye: "#d7a07b",
    lipIntensity: 0.5,
    blushIntensity: 0.56,
    eyeIntensity: 0.38,
    profile: { intensity: 0.43, warmth: 0.36, light: 0.62, clarity: 0.58, mood: "fresh" },
  },
  {
    id: "glass_nude",
    name: "裸感水光",
    scene: "裸妆",
    lip: "#ad7668",
    blush: "#d7a092",
    eye: "#9b8175",
    lipIntensity: 0.4,
    blushIntensity: 0.42,
    eyeIntensity: 0.3,
    profile: { intensity: 0.28, warmth: 0.2, light: 0.5, clarity: 0.7, mood: "clean" },
  },
  {
    id: "milk_mauve",
    name: "奶霜豆沙",
    scene: "柔雾",
    lip: "#b66b7c",
    blush: "#d99aaa",
    eye: "#a98a8c",
    lipIntensity: 0.48,
    blushIntensity: 0.48,
    eyeIntensity: 0.38,
    profile: { intensity: 0.38, warmth: -0.02, light: 0.52, clarity: 0.64, mood: "rose" },
  },
  {
    id: "latte_office",
    name: "拿铁职场",
    scene: "会议",
    lip: "#a9675c",
    blush: "#c99484",
    eye: "#8f6f5e",
    lipIntensity: 0.44,
    blushIntensity: 0.42,
    eyeIntensity: 0.44,
    profile: { intensity: 0.4, warmth: 0.28, light: 0.46, clarity: 0.86, mood: "sharp" },
  },
  {
    id: "berry_night",
    name: "浆果夜色",
    scene: "晚间",
    lip: "#8f3f58",
    blush: "#bd7890",
    eye: "#7d6379",
    lipIntensity: 0.58,
    blushIntensity: 0.48,
    eyeIntensity: 0.48,
    profile: { intensity: 0.58, warmth: -0.16, light: 0.42, clarity: 0.72, mood: "bold" },
  },
  {
    id: "coral_energy",
    name: "珊瑚活力",
    scene: "户外",
    lip: "#df695b",
    blush: "#ed9b83",
    eye: "#c88d68",
    lipIntensity: 0.54,
    blushIntensity: 0.6,
    eyeIntensity: 0.36,
    profile: { intensity: 0.48, warmth: 0.42, light: 0.66, clarity: 0.56, mood: "fresh" },
  },
  {
    id: "misty_plum",
    name: "雾感梅子",
    scene: "高级",
    lip: "#99516b",
    blush: "#c68b9f",
    eye: "#8c7484",
    lipIntensity: 0.5,
    blushIntensity: 0.44,
    eyeIntensity: 0.44,
    profile: { intensity: 0.44, warmth: -0.2, light: 0.5, clarity: 0.8, mood: "sharp" },
  },
  {
    id: "apricot_clean",
    name: "杏仁清甜",
    scene: "学生",
    lip: "#d9826f",
    blush: "#e6a78f",
    eye: "#bd9170",
    lipIntensity: 0.44,
    blushIntensity: 0.5,
    eyeIntensity: 0.32,
    profile: { intensity: 0.34, warmth: 0.34, light: 0.64, clarity: 0.52, mood: "fresh" },
  },
  {
    id: "velvet_red",
    name: "绒感红棕",
    scene: "气场",
    lip: "#9d473f",
    blush: "#c47b70",
    eye: "#795f54",
    lipIntensity: 0.6,
    blushIntensity: 0.42,
    eyeIntensity: 0.48,
    profile: { intensity: 0.6, warmth: 0.3, light: 0.44, clarity: 0.88, mood: "bold" },
  },
];

const refs = collectUiRefs(document);

const ctx = refs.canvas.getContext("2d", { alpha: false });
const makeupRenderer = createMakeupRenderer({ ctx, canvas: refs.canvas });
const appState = createAppState();

let faceLandmarker;
let FaceLandmarkerClass;
let FilesetResolverClass;
let pendingPhotoFile = null;
let modelLoadNoticeTimer = null;
let activeLook = { ...looks[0] };
let photoImage = null;
let lastVideoTime = -1;
let lastResults = null;
let rafId = null;
let smoothedLandmarks = null;
let lastQuality = 0;
let lastLandmarkMotion = 0;
let activeRecommendation = null;
let lastRecommendationKey = "";
let lastProfileSignals = null;
let lastRenderDiagnostics = null;
let lastPersonalizationKey = "";
let activeSampleScenario = "front-natural";
let activeExpertRating = "suitable";
let preferenceState = {
  occasion: "daily",
  goal: "fresh",
  finish: "natural",
  budget: "starter",
  existingMakeup: "bare",
  baseCoverage: "sheer",
  browStyle: "natural",
  eyeFocus: "natural",
  lipTexture: "stain",
};

document.body.classList.toggle("developer-mode", developerMode);

init();

async function init() {
  renderLooks();
  restorePreferenceState();
  bindControls();
  setLook(looks[0]);
  updatePreferenceState();
  updatePreferenceSummary();
  updateProfileSummary(null);
  activeRecommendation = recommendFromPreferences();
  updateRecommendationUI(activeRecommendation);
  renderTestRuns();
  renderExpertReviews();
  renderFriendReviewSummary();
  renderValidationState();
  setStatus("idle", "加载模型");
  setInputGuidance("idle", "上传清晰单人正脸照片，或开启摄像头后让脸部保持在画面中央。");
  modelLoadNoticeTimer = window.setTimeout(() => {
    if (appState.getState().modelState !== "loading") return;
    refs.runtimeLabel.textContent = "首次加载较慢";
    setStatus("idle", pendingPhotoFile ? "照片已选择" : "正在加载模型");
    setInputGuidance(
      "idle",
      pendingPhotoFile
        ? "照片已保留，模型加载完成后会自动分析。首次加载约 15 MB，请保持页面打开。"
        : "首次加载约 15 MB，请保持页面打开。你也可以先选择照片，模型就绪后会自动分析。"
    );
  }, 6000);

  try {
    const vision = await import(
      "./node_modules/@mediapipe/tasks-vision/vision_bundle.mjs"
    );
    FaceLandmarkerClass = vision.FaceLandmarker;
    FilesetResolverClass = vision.FilesetResolver;

    const filesetResolver = await FilesetResolverClass.forVisionTasks(
      "./node_modules/@mediapipe/tasks-vision/wasm"
    );
    const compatibleRuntime = await createCompatibleFaceLandmarker({
      FaceLandmarker: FaceLandmarkerClass,
      filesetResolver,
      modelAssetPath: modelUrl,
      onDelegate(delegate) {
        refs.runtimeLabel.textContent =
          delegate === "CPU" ? "兼容模式加载中" : "MediaPipe 加载中";
      },
    });
    faceLandmarker = compatibleRuntime.landmarker;
    appState.update({ modelState: "ready" });
    window.clearTimeout(modelLoadNoticeTimer);
    refs.runtimeLabel.textContent =
      compatibleRuntime.delegate === "CPU" ? "模型已就绪（兼容）" : "模型已就绪";
    setStatus("idle", "可开始");
    if (pendingPhotoFile) {
      const queuedFile = pendingPhotoFile;
      pendingPhotoFile = null;
      await processPhotoFile(queuedFile);
    }
  } catch (error) {
    console.error(error);
    appState.update({ modelState: "failed" });
    pendingPhotoFile = null;
    window.clearTimeout(modelLoadNoticeTimer);
    refs.runtimeLabel.textContent = "模型加载失败";
    setStatus("error", "加载失败");
    setInputGuidance(
      "error",
      "模型加载失败。请用 Safari 打开此页面并刷新；如果仍失败，请稍后重试。"
    );
  }
}

function renderLooks() {
  refs.lookGrid.innerHTML = "";
  for (const look of looks) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "look-card";
    button.dataset.lookId = look.id;
    button.innerHTML = `
      <div class="swatches">
        <span class="swatch" style="background:${look.lip}"></span>
        <span class="swatch" style="background:${look.blush}"></span>
        <span class="swatch" style="background:${look.eye}"></span>
      </div>
      <strong>${look.name}</strong>
      <small>${look.scene}</small>
      <span class="recommend-badge">推荐</span>
    `;
    button.addEventListener("click", () => setLook(look));
    refs.lookGrid.appendChild(button);
  }
}

function bindControls() {
  refs.intakeContinueBtn.addEventListener("click", enterTryOn);
  refs.privacyConsent.addEventListener("change", () => {
    if (refs.privacyConsent.checked) refs.consentError.textContent = "";
  });
  refs.editPreferencesBtn.addEventListener("click", showIntake);
  refs.startCameraBtn.addEventListener("click", startCamera);
  refs.photoInput.addEventListener("change", handlePhotoUpload);
  refs.sampleButtons.forEach((button) => {
    button.addEventListener("click", () => setSampleScenario(button.dataset.sample));
  });
  refs.recordTestBtn.addEventListener("click", recordCurrentTestRun);
  refs.validationIssueButtons.forEach((button) => {
    button.addEventListener("click", () => {
      button.classList.toggle("active");
    });
  });
  refs.expertButtons.forEach((button) => {
    button.addEventListener("click", () => setExpertRating(button.dataset.expertRating));
  });
  refs.recordExpertBtn.addEventListener("click", recordExpertReview);
  refs.captureBtn.addEventListener("click", captureCanvas);
  refs.openResultBtn.addEventListener("click", openResultSheet);
  refs.closeResultBtn.addEventListener("click", closeResultSheet);
  refs.exportDataBtn.addEventListener("click", exportLocalData);
  refs.exportCsvBtn.addEventListener("click", exportReviewCsv);
  refs.resultSheet.addEventListener("click", (event) => {
    if (event.target === refs.resultSheet) closeResultSheet();
  });
  refs.resultMakeupPlan.addEventListener("change", (event) => {
    const input = event.target.closest("[data-makeup-step-feedback]");
    if (!input) return;
    recordMakeupStepFeedback(input.dataset.makeupStepFeedback, input.value);
  });
  refs.clearDataBtn.addEventListener("click", clearLocalData);
  refs.feedbackButtons.forEach((button) => {
    button.addEventListener("click", () => handleFeedback(button.dataset.feedback));
  });
  refs.recordFriendReviewBtn.addEventListener("click", recordFriendReview);
  refs.applyRecommendationBtn.addEventListener("click", () => {
    const lookId = refs.applyRecommendationBtn.dataset.lookId || activeRecommendation?.lookId;
    const look = looks.find((item) => item.id === lookId);
    if (look) setLook(look);
  });
  refs.preferenceInputs.forEach((input) => {
    input.addEventListener("change", () => {
      updatePreferenceState();
      updatePreferenceSummary();
      updateProfileSummary(lastProfileSignals);
      renderPersonalizationPanels();
      if (refs.privacyConsent.checked) savePreferenceState();
      if (appState.getState().mode === "photo") {
        drawPhotoFrame();
      } else if (lastResults?.faceLandmarks?.length && appState.getState().mode === "camera") {
        drawMakeup(lastResults, true);
      } else {
        activeRecommendation = recommendFromPreferences();
        updateRecommendationUI(activeRecommendation);
      }
    });
  });

  bindRange(refs.lipIntensity, refs.lipValue, "lipIntensity");
  bindRange(refs.blushIntensity, refs.blushValue, "blushIntensity");
  bindRange(refs.eyeIntensity, refs.eyeValue, "eyeIntensity");

  refs.lipColor.addEventListener("input", () => updateColor("lip", refs.lipColor.value));
  refs.blushColor.addEventListener("input", () => updateColor("blush", refs.blushColor.value));
  refs.eyeColor.addEventListener("input", () => updateColor("eye", refs.eyeColor.value));
  refs.beforeToggle.addEventListener("change", () => {
    appState.update({ beautyEnabled: refs.beforeToggle.checked });
    if (appState.getState().mode === "photo") drawPhotoFrame();
  });
}

function enterTryOn() {
  if (!refs.privacyConsent.checked) {
    refs.consentError.textContent = "请先确认隐私授权，再生成风格档案。";
    refs.privacyConsent.focus();
    return;
  }
  refs.consentError.textContent = "";
  updatePreferenceState();
  savePreferenceState();
  updatePreferenceSummary();
  updateProfileSummary(null);
  activeRecommendation = recommendFromPreferences();
  updateRecommendationUI(activeRecommendation);
  const recommendedLook = looks.find((look) => look.id === activeRecommendation?.lookId);
  if (recommendedLook) setLook(recommendedLook);
  document.body.classList.add("tryon-mode");
  refs.intakeScreen.classList.add("is-hidden");
  refs.appShell.classList.remove("is-hidden");
}

function showIntake() {
  stopLoop();
  stopCameraTracks();
  appState.update({ mode: "idle" });
  photoImage = null;
  lastResults = null;
  lastProfileSignals = null;
  refs.emptyState.classList.remove("hidden");
  refs.downloadLink.classList.remove("ready");
  setStatus("idle", faceLandmarker ? "可开始" : "加载模型");
  activeRecommendation = recommendFromPreferences();
  updateRecommendationUI(activeRecommendation);
  updateProfileSummary(null);
  document.body.classList.remove("tryon-mode");
  refs.appShell.classList.add("is-hidden");
  refs.intakeScreen.classList.remove("is-hidden");
}

function bindRange(input, output, key) {
  input.addEventListener("input", () => {
    activeLook[key] = Number(input.value);
    output.value = Math.round(Number(input.value) * 100);
    if (appState.getState().mode === "photo") drawPhotoFrame();
  });
}

function updateColor(key, value) {
  activeLook[key] = value;
  if (appState.getState().mode === "photo") drawPhotoFrame();
}

function setLook(look) {
  activeLook = { ...look };
  refs.lookName.textContent = look.name;
  refs.lipIntensity.value = look.lipIntensity;
  refs.blushIntensity.value = look.blushIntensity;
  refs.eyeIntensity.value = look.eyeIntensity;
  refs.lipValue.value = Math.round(look.lipIntensity * 100);
  refs.blushValue.value = Math.round(look.blushIntensity * 100);
  refs.eyeValue.value = Math.round(look.eyeIntensity * 100);
  refs.lipColor.value = look.lip;
  refs.blushColor.value = look.blush;
  refs.eyeColor.value = look.eye;

  document.querySelectorAll(".look-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.lookId === look.id);
  });

  renderPersonalizationPanels();
  if (appState.getState().mode === "photo") drawPhotoFrame();
}

async function startCamera() {
  if (!faceLandmarker) {
    const failed = appState.getState().modelState === "failed";
    setStatus(failed ? "error" : "idle", failed ? "模型加载失败" : "模型加载中");
    setInputGuidance(
      failed ? "error" : "idle",
      failed
        ? "请用 Safari 打开此页面并刷新，然后再开启摄像头。"
        : "模型仍在加载。首次加载约 15 MB，完成后再开启摄像头。"
    );
    return;
  }

  stopLoop();
  resetSmoothing();
  appState.update({ mode: "camera" });
  photoImage = null;
  refs.emptyState.classList.add("hidden");
  refs.downloadLink.classList.remove("ready");
  setStatus("idle", "请求权限");
  setInputGuidance("idle", "请把脸放在画面中央，面向镜头，并保持正面柔光。");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    refs.video.srcObject = stream;
    await refs.video.play();
    appState.update({ running: true });
    setStatus("idle", "寻找人脸");
    setInputGuidance("idle", "正在寻找人脸。请靠近一点，让脸部完整进入画面。");
    rafId = requestAnimationFrame(loopCamera);
  } catch (error) {
    console.error(error);
    setStatus("error", "摄像头不可用");
    setInputGuidance("error", "摄像头不可用。可以改用上传照片继续测试。");
    refs.emptyState.classList.remove("hidden");
  }
}

async function handlePhotoUpload(event) {
  const [file] = event.target.files;
  event.target.value = "";
  if (!file) return;

  if (!faceLandmarker) {
    if (appState.getState().modelState === "failed") {
      setStatus("error", "模型加载失败");
      setInputGuidance("error", "照片未处理。请用 Safari 打开此页面并刷新后重试。");
      return;
    }
    pendingPhotoFile = file;
    setStatus("idle", "照片已选择");
    setInputGuidance(
      "idle",
      "照片已保留，模型加载完成后会自动分析。首次加载约 15 MB，请保持页面打开。"
    );
    return;
  }

  await processPhotoFile(file);
}

async function processPhotoFile(file) {

  const objectUrl = URL.createObjectURL(file);
  try {
    await loadPhotoSource(objectUrl);
  } catch (error) {
    console.error(error);
    setStatus("error", "照片读取失败");
    setInputGuidance("error", "无法读取这张照片，请换一张 JPG、PNG 或 HEIC 照片重试。");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function loadPhotoSource(source) {
  if (!faceLandmarker) return;

  stopCameraTracks();
  stopLoop();
  resetSmoothing();
  appState.update({ mode: "photo" });
  refs.emptyState.classList.add("hidden");
  refs.downloadLink.classList.remove("ready");
  setStatus("idle", "分析照片");
  setInputGuidance("idle", "正在分析照片。请优先使用单人正脸、脸部完整、光线均匀的图片。");

  await new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = async () => {
      try {
        photoImage = image;
        await drawPhotoFrame();
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error("Photo could not be loaded"));
    image.src = source;
  });
}

function loopCamera() {
  if (!appState.getState().running || appState.getState().mode !== "camera") return;

  const video = refs.video;
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    resizeCanvas(video.videoWidth, video.videoHeight);
    drawVideoMirrored(video);

    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      lastResults = faceLandmarker.detectForVideo(video, performance.now());
    }

    drawMakeup(lastResults, true);
  }

  rafId = requestAnimationFrame(loopCamera);
}

async function drawPhotoFrame() {
  if (!photoImage) return;

  resizeCanvas(photoImage.naturalWidth, photoImage.naturalHeight);
  ctx.drawImage(photoImage, 0, 0, refs.canvas.width, refs.canvas.height);

  lastResults = await detectPhoto(photoImage);
  drawMakeup(lastResults, false);

  if (lastResults.faceLandmarks?.length) {
    const gate = currentQualityGate();
    setStatus(
      gate.id === "good_for_tryon" ? "tracking" : gate.id === "cannot_analyze" ? "error" : "warn",
      gate.id === "good_for_tryon" ? "已识别人脸" : gate.label
    );
  } else {
    setStatus("error", "未识别人脸");
    setInputGuidance("error", "没有识别人脸。请换成单人正脸照片，并避免遮挡、侧脸或多人合照。");
  }
}

async function detectPhoto(image) {
  await faceLandmarker.setOptions({ runningMode: "IMAGE" });
  const result = faceLandmarker.detect(image);
  await faceLandmarker.setOptions({ runningMode: "VIDEO" });
  return result;
}

function drawVideoMirrored(video) {
  ctx.save();
  ctx.translate(refs.canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, refs.canvas.width, refs.canvas.height);
  ctx.restore();
}

function drawMakeup(results, mirrored) {
  const rawLandmarks = results?.faceLandmarks?.[0];
  if (!rawLandmarks) {
    lastRenderDiagnostics = {
      version: renderVersion,
      status: "no-face",
      reason: "face-not-detected",
    };
    if (appState.getState().mode === "camera") setStatus("idle", "寻找人脸");
    refs.qualityLabel.textContent = "未识别人脸";
    setInputGuidance(
      appState.getState().mode === "camera" ? "idle" : "error",
      appState.getState().mode === "camera"
        ? "请把脸放在画面中央，面向镜头，并增加正面光线。"
        : "没有识别人脸。请换成单人正脸照片，并避免遮挡、侧脸或多人合照。"
    );
    lastProfileSignals = null;
    renderValidationState();
    updateProfileSummary(null);
    renderPersonalizationPanels();
    const fallbackRecommendation = recommendFromPreferences();
    activeRecommendation =
      appState.getState().mode === "idle"
        ? fallbackRecommendation
        : {
            ...fallbackRecommendation,
            canApply: false,
            caveat: qualityGateLabels.cannot_analyze,
            chips: [...fallbackRecommendation.chips.slice(0, 4), "重拍后再应用"],
            reason: "当前照片无法可靠识别人脸。问卷方向会保留，但请上传单人正脸、避免遮挡并使用均匀正面光后再应用试妆。",
          };
    updateRecommendationUI(activeRecommendation);
    return;
  }

  const landmarks = appState.getState().mode === "camera" ? smoothLandmarks(rawLandmarks) : rawLandmarks;
  const canvasSize = { width: refs.canvas.width, height: refs.canvas.height };
  const pose = measureFacePose({ landmarks, mirrored, canvasSize });
  const quality = estimateFaceQuality({ landmarks, mirrored, canvasSize, pose });
  const faceTone = sampleToneFromIndices(landmarks, mirrored, [10, 1, 50, 280, 234, 454, 152], 26);
  const renderDiagnostics = {
    version: renderVersion,
    status: appState.getState().beautyEnabled ? "ready" : "before-mode",
    pose: {
      yaw: Number(pose.yaw.toFixed(3)),
      mouthOpen: Number(pose.mouthOpen.toFixed(3)),
      visibleSide: pose.visibleSide,
    },
    faceTone: {
      luminance: Number((faceTone.luminance ?? 0.56).toFixed(3)),
      warmth: Number((faceTone.warmth ?? 0.12).toFixed(3)),
    },
    sides: makeupSideVisibility(pose),
    parameters: {
      lookId: activeLook.id,
      lookName: activeLook.name,
      lip: activeLook.lip,
      blush: activeLook.blush,
      eye: activeLook.eye,
      lipIntensity: activeLook.lipIntensity,
      blushIntensity: activeLook.blushIntensity,
      eyeIntensity: activeLook.eyeIntensity,
      lipTexture: preferenceState.lipTexture,
      lipTextureExperiment: lipTextureExperimentEnabled,
    },
  };
  lastRenderDiagnostics = renderDiagnostics;
  const guidance = guidanceForFace(quality, faceTone, pose);
  lastProfileSignals = { quality, faceTone, pose, guidance };
  renderValidationState();
  updateProfileSummary(lastProfileSignals);
  renderPersonalizationPanels();
  const recommendation = recommendLook(landmarks, mirrored, quality, faceTone, pose);
  activeRecommendation = recommendation;
  updateRecommendationUI(recommendation);
  lastQuality = quality;
  updateQualityLabel(quality, faceTone, pose);
  setInputGuidance(guidance.tone, guidance.message);
  const gate = currentQualityGate();
  setStatus(
    gate.id === "good_for_tryon" ? "tracking" : gate.id === "cannot_analyze" ? "error" : "warn",
    gate.id === "good_for_tryon" ? "实时追踪" : gate.label
  );
  refs.emptyState.classList.add("hidden");

  if (!appState.getState().beautyEnabled) return;

  const makeupOpacity =
    clamp(mapRange(quality, 0.28, 0.72, 0.74, 1), 0.72, 1) *
    realtimeMakeupMultiplier({
      mode: appState.getState().mode,
      landmarkMotion: lastLandmarkMotion,
      pose,
    });
  renderDiagnostics.parameters.makeupOpacity = Number(makeupOpacity.toFixed(3));
  renderDiagnostics.parameters.landmarkMotion = Number(lastLandmarkMotion.toFixed(4));
  makeupRenderer.renderMakeupLayers({
    landmarks,
    mirrored,
    qualityOpacity: makeupOpacity,
    pose,
    diagnostics: renderDiagnostics,
    look: activeLook,
    preferences: preferenceState,
    mode: appState.getState().mode,
    flags: { lipTextureExperimentEnabled, blushPlacementExperimentEnabled },
  });
}

function smoothLandmarks(rawLandmarks) {
  const smoothed = smoothFaceLandmarks({
    rawLandmarks,
    previousLandmarks: smoothedLandmarks,
    lastQuality,
  });
  smoothedLandmarks = smoothed.landmarks;
  lastLandmarkMotion = smoothed.motion;
  return smoothedLandmarks;
}

function resetSmoothing() {
  smoothedLandmarks = null;
  lastQuality = 0;
  lastLandmarkMotion = 0;
}

function updateQualityLabel(quality, faceTone, pose) {
  if (!appState.getState().beautyEnabled) {
    refs.qualityLabel.textContent = "Before 模式";
    return;
  }
  refs.qualityLabel.textContent = guidanceForFace(quality, faceTone, pose).label;
}

function recommendLook(landmarks, mirrored, quality, faceTone, pose) {
  const preferenceProfile = buildPreferenceProfile();
  const leftCheek = point(landmarks[234], mirrored);
  const rightCheek = point(landmarks[454], mirrored);
  const faceWidth = Math.max(1, distance(leftCheek, rightCheek));
  const gate = qualityGateFromSignals({ quality, faceTone, pose });
  return recommendFromFaceSignals({
    looks,
    preferenceProfile,
    quality,
    faceTone,
    pose,
    faceWidth,
    gate,
    confidenceCap: recommendationConfidenceCap(gate.id),
  });
}

function recommendFromPreferences() {
  return recommendFromPreferencesPure({ looks, preferenceProfile: buildPreferenceProfile() });
}

function updateRecommendationUI(recommendation) {
  const key = recommendation
    ? `${recommendation.source}:${recommendation.lookId}:${recommendation.confidence}:${recommendation.canApply}:${recommendation.chips.join(",")}:${recommendation.reason}`
    : "none";
  if (key === lastRecommendationKey) return;
  lastRecommendationKey = key;

  if (!recommendation) {
    activeRecommendation = null;
    updateIntakePreview(null);
    renderRecommendationPanel(recommendationPanelElements(), null);
    updateLookRecommendationMarker(null);
    return;
  }

  activeRecommendation = recommendation;
  updateIntakePreview(recommendation);
  renderRecommendationPanel(recommendationPanelElements(), recommendation);
  updateLookRecommendationMarker(recommendation.lookId);
}

function recommendationPanelElements() {
  return {
    state: refs.recommendationState,
    title: refs.recommendationTitle,
    reason: refs.recommendationReason,
    confidence: refs.recommendationConfidence,
    chips: refs.recommendationChips,
    applyButton: refs.applyRecommendationBtn,
  };
}

function updateIntakePreview(recommendation) {
  const look = recommendation ? looks.find((item) => item.id === recommendation.lookId) : null;
  renderIntakePreviewPanel(
    {
      card: refs.intakePreviewCard,
      state: refs.intakePreviewState,
      title: refs.intakePreviewTitle,
      reason: refs.intakePreviewReason,
      chips: refs.intakePreviewChips,
      swatches: refs.intakePreviewSwatches,
    },
    recommendation,
    look
  );
}

function updateLookRecommendationMarker(lookId) {
  renderLookRecommendationMarker(document.querySelectorAll(".look-card"), lookId);
}

function updatePreferenceState() {
  refs.preferenceInputs.forEach((input) => {
    if (input.checked) preferenceState[input.dataset.pref] = input.value;
  });
}

function updatePreferenceSummary() {
  const profile = buildPreferenceProfile();
  renderPreferenceSummaryView(refs.preferenceSummaryChips, [
    ...profile.labels,
    profile.existingMakeupLabel,
    ...profile.detailLabels,
  ]);
}

function updateProfileSummary(signals) {
  const profile = buildPreferenceProfile();
  const intensityText =
    profile.intensity > 0.52 ? "推荐保留更明确的唇色和眼部存在感" : profile.intensity < 0.34 ? "推荐低负担、低对比度的自然妆效" : "推荐中等显色，优先提气色";
  const budgetText = budgetHint(preferenceState.budget);

  if (!signals) {
    renderProfileSummaryView(
      { state: refs.profileState, summary: refs.profileSummary },
      {
        stateText: "问卷生成",
        metaText: profile.labels.join(" / "),
        detailText: `${intensityText}；${budgetText}。`,
      }
    );
    return;
  }

  const { quality, faceTone, guidance } = signals;
  const toneText = toneLabel(faceTone.warmth);
  const lightText = lightLabel(faceTone.luminance);
  const fitText = guidance?.summary ?? (quality > 0.72 ? "关键点贴合良好" : quality > 0.48 ? "关键点可用" : "角度偏大，推荐会更保守");
  renderProfileSummaryView(
    { state: refs.profileState, summary: refs.profileSummary },
    {
      stateText: "脸部融合",
      metaText: `${toneText} / ${lightText} / ${fitText}`,
      detailText: `${intensityText}；${budgetText}。`,
    }
  );
}

function renderPersonalizationPanels() {
  const signalKey = lastProfileSignals
    ? `${Math.round(lastProfileSignals.quality * 10)}:${Math.round(lastProfileSignals.faceTone.luminance * 10)}:${Math.round(lastProfileSignals.faceTone.warmth * 10)}:${currentQualityGate().id}`
    : "none";
  const key = `${activeLook.id}:${preferenceState.occasion}:${preferenceState.goal}:${preferenceState.finish}:${preferenceState.budget}:${preferenceState.existingMakeup}:${preferenceState.baseCoverage}:${preferenceState.browStyle}:${preferenceState.eyeFocus}:${preferenceState.lipTexture}:${signalKey}`;
  if (key === lastPersonalizationKey) return;
  lastPersonalizationKey = key;
  renderStylePlan();
  renderMakeupPlanSummary();
  renderProductList();
}

function currentStyleItems() {
  const style = moodStyleCopy[activeLook.profile?.mood] ?? moodStyleCopy.clean;
  const profile = buildPreferenceProfile();
  const faceSignal = lastProfileSignals?.faceTone
    ? lastProfileSignals.faceTone.warmth > 0.18
      ? "当前画面偏暖，穿搭色可以顺着暖调走"
      : lastProfileSignals.faceTone.warmth < -0.08
        ? "当前画面偏冷，银色、灰调和低饱和色更稳"
        : "当前画面接近中性，冷暖色都有空间"
    : "上传照片后会补充肤色与光线判断";
  return [
    ["发型", style.hair],
    ["穿搭色", style.outfit],
    ["妆容重点", style.focus],
    ["场景理由", `${profile.labels[0]}场景下，${profile.labels[1]}优先，${profile.labels[2]}妆感不要抢过整体状态。${faceSignal}。`],
  ];
}

function renderStylePlan() {
  renderStylePlanView(refs.stylePlan, currentStyleItems());
}

function currentMakeupPlan() {
  return buildCompleteMakeupPlan({
    look: activeLook,
    profile: buildPreferenceProfile(),
    budget: preferenceState.budget,
    qualityGate: currentQualityGate().id,
  });
}

function renderMakeupPlanSummary() {
  renderMakeupPlanSummaryView(refs.makeupPlanSummary, currentMakeupPlan());
}

function currentProducts() {
  return currentMakeupPlan().map((step) => ({
    role: step.category,
    name: step.recommendation,
    meta: step.productDirection,
    color: step.color,
    visualPreview: step.visualPreview,
  }));
}

function renderProductList() {
  const copy = budgetProductCopy[preferenceState.budget] ?? budgetProductCopy.starter;
  renderProductListView(
    { budgetLabel: refs.productBudgetLabel, list: refs.productList },
    { budgetLabel: copy.label, products: currentProducts() }
  );
}

function setSampleScenario(sampleId) {
  activeSampleScenario = sampleScenarios[sampleId] ? sampleId : "front-natural";
  refs.sampleButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.sample === activeSampleScenario);
  });
}

function renderValidationState() {
  const gate = currentQualityGate();
  renderValidationStateView(
    { qualityGate: refs.qualityGateLabel, renderVersion: refs.renderVersionLabel },
    { gateLabel: gate.label, renderVersion }
  );
}

function selectedValidationScores() {
  const scores = {};
  refs.validationScoreInputs.forEach((input) => {
    if (input.value === "") return;
    const value = Number(input.value);
    if (Number.isInteger(value)) scores[input.dataset.validationScore] = value;
  });
  return scores;
}

function selectedValidationIssues() {
  return [...refs.validationIssueButtons]
    .filter((button) => button.classList.contains("active"))
    .map((button) => button.dataset.validationIssue);
}

function resetValidationControls() {
  refs.validationScoreInputs.forEach((input) => {
    input.value = "";
  });
  refs.validationIssueButtons.forEach((button) => {
    button.classList.remove("active");
  });
  renderValidationState();
}

function recordCurrentTestRun() {
  const runs = readTestRuns();
  const tone = lastProfileSignals?.faceTone;
  const note = refs.testNoteInput.value.trim();
  const qualityGate = currentQualityGate();
  const run = {
    id: `run-${Date.now()}`,
    sample: activeSampleScenario,
    sampleLabel: sampleScenarios[activeSampleScenario],
    lookName: activeLook.name,
    source: activeRecommendation?.source === "face" ? "脸部融合" : "问卷推荐",
    recommendationConfidence: activeRecommendation?.confidence ?? null,
    qualityGate: qualityGate.id,
    qualityGateLabel: qualityGate.label,
    renderVersion,
    recommendationReason: activeRecommendation?.reason ?? "",
    renderDiagnostics: lastRenderDiagnostics ? JSON.parse(JSON.stringify(lastRenderDiagnostics)) : null,
    scores: selectedValidationScores(),
    issueTags: selectedValidationIssues(),
    quality: lastProfileSignals ? Math.round(lastProfileSignals.quality * 100) : null,
    luminance: tone ? Math.round(tone.luminance * 100) : null,
    warmth: tone ? Math.round(tone.warmth * 100) : null,
    preferences: { ...preferenceState },
    note,
    at: new Date().toISOString(),
  };
  runs.unshift(run);
  saveTestRuns(runs.slice(0, 50));
  refs.testNoteInput.value = "";
  renderTestRuns();
  refs.testRunCount.textContent = `${Math.min(runs.length, 50)} 条`;
}

function readTestRuns() {
  return testRunStore.read();
}

function saveTestRuns(runs) {
  testRunStore.write(runs);
}

function renderTestRuns() {
  const runs = readTestRuns();
  renderTestRunList(
    { count: refs.testRunCount, list: refs.testRunList },
    {
      runs,
      qualityGateLabels,
      defaultRenderVersion: renderVersion,
      validationScoreLabels,
      validationIssueLabels,
    }
  );
}

function setExpertRating(rating) {
  activeExpertRating = expertRatingLabels[rating] ? rating : "suitable";
  refs.expertButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.expertRating === activeExpertRating);
  });
}

function recordExpertReview() {
  const reviews = readExpertReviews();
  const profile = buildPreferenceProfile();
  const note = refs.expertNoteInput.value.trim();
  const review = {
    id: `expert-${Date.now()}`,
    rating: activeExpertRating,
    ratingLabel: expertRatingLabels[activeExpertRating],
    sample: activeSampleScenario,
    sampleLabel: sampleScenarios[activeSampleScenario],
    lookId: activeLook.id,
    lookName: activeLook.name,
    recommendationSource: activeRecommendation?.source ?? "preference",
    recommendationConfidence: activeRecommendation?.confidence ?? null,
    renderVersion,
    preferences: { ...preferenceState },
    preferenceLabels: profile.labels,
    signals: feedbackSignals(),
    note,
    at: new Date().toISOString(),
  };
  reviews.unshift(review);
  saveExpertReviews(reviews.slice(0, 50));
  refs.expertNoteInput.value = "";
  refs.feedbackState.textContent = "已记录专家评审";
  renderExpertReviews();
}

function readExpertReviews() {
  return expertReviewStore.read();
}

function saveExpertReviews(reviews) {
  expertReviewStore.write(reviews);
}

function renderExpertReviews() {
  const reviews = readExpertReviews();
  renderExpertReviewList(
    { count: refs.expertReviewCount, list: refs.expertReviewList },
    reviews
  );
}

function openResultSheet() {
  renderResultSheet();
  refs.resultSheet.classList.remove("is-hidden");
}

function closeResultSheet() {
  refs.resultSheet.classList.add("is-hidden");
}

function renderResultSheet() {
  const profile = buildPreferenceProfile();
  const look = activeLook;
  const makeupPlan = currentMakeupPlan();
  const feedbackSummary = summarizeFeedback(readFeedbackHistory());
  const expertSummary = summarizeExpertReviews(readExpertReviews());
  refs.resultMode.textContent = activeRecommendation?.source === "face" ? "脸部融合推荐" : "问卷推荐";
  refs.resultLookName.textContent = look.name;
  refs.resultReason.textContent = activeRecommendation?.reason ?? "等待推荐生成。";
  refs.resultSwatches.innerHTML = [look.lip, look.blush, look.eye]
    .map((color) => `<span style="background:${color}"></span>`)
    .join("");
  refs.resultProfile.innerHTML = `
    <p>${profile.labels.join(" / ")}</p>
    <p>${refs.profileSummary.innerText.replace(/\n/g, " ")}</p>
  `;
  refs.resultStylePlan.innerHTML = currentStyleItems()
    .map(([title, body]) => `<article><strong>${title}</strong><span>${body}</span></article>`)
    .join("");
  refs.resultMakeupPlan.innerHTML = makeupPlan
    .map((step) => {
      const feedbackValue = latestMakeupStepFeedback(step.id)?.value ?? "";
      return `
        <article class="makeup-plan-card">
          <div class="makeup-plan-card-head">
            <i style="background:${step.color}"></i>
            <strong>${step.category}</strong>
            <span class="${step.visualPreview ? "is-previewed" : ""}">${step.visualPreview ? "已预览" : "方案建议"}</span>
          </div>
          <p>${step.recommendation}</p>
          <small>${step.guidance}</small>
          <em>注意：${step.caution}</em>
          <label class="makeup-step-feedback">
            <span>这一步反馈</span>
            <select data-makeup-step-feedback="${step.id}" aria-label="${step.category}反馈">
              <option value="">暂不评价</option>
              <option value="suitable" ${feedbackValue === "suitable" ? "selected" : ""}>适合</option>
              <option value="too_complex" ${feedbackValue === "too_complex" ? "selected" : ""}>太复杂</option>
              <option value="skip" ${feedbackValue === "skip" ? "selected" : ""}>不想做</option>
              <option value="wrong_color" ${feedbackValue === "wrong_color" ? "selected" : ""}>颜色不对</option>
            </select>
          </label>
        </article>
      `;
    })
    .join("");
  refs.resultProducts.innerHTML = makeupPlan
    .filter((step) => step.visualPreview)
    .map(
      (step) =>
        `<article><i style="background:${step.color}"></i><strong>${step.category}</strong><span>${step.recommendation} / ${step.productDirection}</span></article>`
    )
    .join("");

  const runs = readTestRuns();
  refs.resultTests.innerHTML = runs.length
    ? runs
        .slice(0, 6)
        .map(
          (run) => `
            <article>
              <strong>${run.sampleLabel}</strong>
              <span>${run.lookName} / ${testMetricText(run, { qualityGateLabels, defaultRenderVersion: renderVersion })}</span>
              ${scoreSummaryText(run.scores, validationScoreLabels) ? `<span>${scoreSummaryText(run.scores, validationScoreLabels)}</span>` : ""}
              ${issueSummaryText(run.issueTags, validationIssueLabels) ? `<span>${issueSummaryText(run.issueTags, validationIssueLabels)}</span>` : ""}
            </article>
          `
        )
        .join("")
    : `<article><strong>暂无记录</strong><span>上传真实照片并记录样本后，这里会显示测试摘要。</span></article>`;

  if (feedbackSummary.total) {
    refs.resultTests.innerHTML += `<article><strong>反馈摘要</strong><span>${feedbackSummary.text}</span></article>`;
  }
  if (expertSummary.total) {
    refs.resultTests.innerHTML += `<article><strong>专家评审</strong><span>${expertSummary.text}</span></article>`;
  }
}

function shadeLabel(look) {
  const warmth = look.profile?.warmth ?? 0;
  const intensity = look.profile?.intensity ?? 0.4;
  const mood = look.profile?.mood ?? "clean";
  const lip =
    intensity > 0.56
      ? warmth > 0.12
        ? "红棕/砖红同色系"
        : "浆果/梅子同色系"
      : warmth > 0.24
        ? "珊瑚/蜜桃同色系"
        : warmth < -0.08
          ? "豆沙/玫瑰同色系"
          : "裸粉/奶茶同色系";
  const blush = mood === "bold" ? "低面积晕染" : mood === "sharp" ? "靠后收敛" : "苹果肌到颧骨轻扫";
  const eye = warmth > 0.16 ? "杏棕、赤陶、暖金" : warmth < -0.08 ? "灰粉、藕紫、冷棕" : "米棕、灰棕、香槟";
  return { lip, blush, eye };
}

function handleFeedback(type) {
  const messages = {
    like: "已记录喜欢",
    dislike: "已记录不喜欢",
    lighter: "已调淡当前妆容",
    stronger: "已增强当前妆容",
    "wrong-color": "已记录颜色不对",
    "wrong-style": "已记录风格不对",
    switch: "已切换风格",
  };
  recordFeedback(type);

  if (type === "lighter") {
    scaleActiveIntensity(0.88);
  } else if (type === "stronger") {
    scaleActiveIntensity(1.12);
  } else if (type === "switch") {
    switchToAlternativeLook();
  }

  refs.feedbackState.textContent = messages[type] ?? "已记录反馈";
}

function recordFeedback(type) {
  const history = readFeedbackHistory();
  history.push({
    type,
    label: feedbackLabel(type),
    note: refs.feedbackNoteInput.value.trim(),
    lookId: activeLook.id,
    lookName: activeLook.name,
    recommendationSource: activeRecommendation?.source ?? "preference",
    recommendationConfidence: activeRecommendation?.confidence ?? null,
    renderVersion,
    preferences: { ...preferenceState },
    signals: feedbackSignals(),
    at: new Date().toISOString(),
  });
  feedbackStore.write(history);
  refs.feedbackNoteInput.value = "";
}

function readFeedbackHistory() {
  return feedbackStore.read();
}

function recordFriendReview() {
  const requiredValues = [
    refs.friendPrivacyComfort.value,
    refs.friendFitScore.value,
    refs.friendNaturalnessScore.value,
    refs.friendReuseIntent.value,
  ];
  if (requiredValues.some((value) => !value)) {
    refs.feedbackState.textContent = "请先完成 4 项试玩总结";
    return;
  }

  const reviews = readFriendReviews();
  reviews.unshift({
    id: `friend-${Date.now()}`,
    privacyComfort: refs.friendPrivacyComfort.value,
    fitScore: Number(refs.friendFitScore.value),
    naturalnessScore: Number(refs.friendNaturalnessScore.value),
    reuseIntent: refs.friendReuseIntent.value,
    note: refs.friendReviewNoteInput.value.trim(),
    lookId: activeLook.id,
    lookName: activeLook.name,
    recommendationSource: activeRecommendation?.source ?? "preference",
    recommendationConfidence: activeRecommendation?.confidence ?? null,
    renderVersion,
    preferences: { ...preferenceState },
    signals: feedbackSignals(),
    at: new Date().toISOString(),
  });
  saveFriendReviews(reviews.slice(0, 50));
  resetFriendReviewFields();
  renderFriendReviewSummary();
  refs.feedbackState.textContent = "试玩总结已保存在当前浏览器";
}

function readFriendReviews() {
  return friendReviewStore.read();
}

function saveFriendReviews(reviews) {
  friendReviewStore.write(reviews);
}

function resetFriendReviewFields() {
  refs.friendPrivacyComfort.value = "";
  refs.friendFitScore.value = "";
  refs.friendNaturalnessScore.value = "";
  refs.friendReuseIntent.value = "";
  refs.friendReviewNoteInput.value = "";
}

function renderFriendReviewSummary() {
  const reviews = readFriendReviews();
  renderFriendReviewList(
    { count: refs.friendReviewCount, summary: refs.friendReviewSummary },
    reviews,
    {
      privacyComfortLabels: friendPrivacyComfortLabels,
      reuseIntentLabels: friendReuseIntentLabels,
    }
  );
}

function readMakeupStepFeedback() {
  return makeupStepFeedbackStore.read();
}

function saveMakeupStepFeedback(feedback) {
  makeupStepFeedbackStore.write(feedback);
}

function isCurrentMakeupStepFeedback(item, stepId) {
  return (
    item.stepId === stepId &&
    item.lookId === activeLook.id &&
    makeupStepFeedbackPreferenceKeys.every(
      (key) => item.preferences?.[key] === preferenceState[key]
    )
  );
}

function latestMakeupStepFeedback(stepId) {
  return [...readMakeupStepFeedback()]
    .reverse()
    .find((item) => isCurrentMakeupStepFeedback(item, stepId));
}

function recordMakeupStepFeedback(stepId, value) {
  const planStep = currentMakeupPlan().find((step) => step.id === stepId);
  if (!planStep) return;

  const existing = readMakeupStepFeedback().filter(
    (item) => !isCurrentMakeupStepFeedback(item, stepId)
  );

  if (value) {
    existing.push({
      id: `makeup-step-${Date.now()}`,
      stepId,
      stepLabel: planStep.category,
      value,
      label: makeupStepFeedbackLabels[value] ?? value,
      lookId: activeLook.id,
      lookName: activeLook.name,
      renderVersion,
      preferences: { ...preferenceState },
      at: new Date().toISOString(),
    });
  }

  saveMakeupStepFeedback(existing);
  refs.feedbackState.textContent = value
    ? `${planStep.category}：${makeupStepFeedbackLabels[value] ?? value}`
    : `${planStep.category}反馈已清除`;
}

function feedbackSignals() {
  const tone = lastProfileSignals?.faceTone;
  return {
    quality: lastProfileSignals ? Number(lastProfileSignals.quality.toFixed(3)) : null,
    luminance: tone ? Number(tone.luminance.toFixed(3)) : null,
    warmth: tone ? Number(tone.warmth.toFixed(3)) : null,
    mode: appState.getState().mode,
  };
}

function exportLocalData() {
  const payload = buildLocalDataExport();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  if (refs.dataDownloadLink.href) URL.revokeObjectURL(refs.dataDownloadLink.href);
  refs.dataDownloadLink.href = URL.createObjectURL(blob);
  refs.dataDownloadLink.classList.add("ready");
  refs.feedbackState.textContent = "本地数据已准备";
}

function buildRecommendationResultExport() {
  const gate = currentQualityGate();
  const tone = lastProfileSignals?.faceTone ?? neutralTone();
  const quality = lastProfileSignals?.quality ?? 0;
  const makeupPlan = currentMakeupPlan();
  const styleItems = Object.fromEntries(currentStyleItems());
  return buildRecommendationResultPayload({
    createdAt: new Date().toISOString(),
    intake: preferenceState,
    faceSignals: {
      quality,
      luminance: tone.luminance ?? 0.56,
      warmth: tone.warmth ?? 0.18,
      summary: lastProfileSignals?.guidance?.summary ?? "",
    },
    qualityGate: gate,
    recommendation: activeRecommendation,
    activeLook,
    fallbackReason: preferenceRecommendationReason(activeLook, buildPreferenceProfile()),
    makeupPlan,
    styleItems,
    sampleLabel: sampleScenarios[activeSampleScenario],
    renderVersion,
    issueTags: selectedValidationIssues(),
    scores: selectedValidationScores(),
    reviewNote: refs.testNoteInput.value.trim(),
    makeupStepFeedback: readMakeupStepFeedback(),
  });
}

function buildLocalDataExport() {
  const profile = buildPreferenceProfile();
  return buildLocalDataPayload({
    exportedAt: new Date().toISOString(),
    renderVersion,
    qualityGate: currentQualityGate(),
    preferences: preferenceState,
    preferenceLabels: profile.labels,
    activeLook,
    recommendation: activeRecommendation,
    recommendationResult: buildRecommendationResultExport(),
    stylePlan: currentStyleItems(),
    products: currentProducts(),
    testRuns: readTestRuns(),
    feedback: readFeedbackHistory(),
    friendReviews: readFriendReviews(),
    makeupStepFeedback: readMakeupStepFeedback(),
    expertReviews: readExpertReviews(),
  });
}

function exportReviewCsv() {
  const csv = toCsv(
    buildReviewRows({
      feedback: readFeedbackHistory(),
      testRuns: readTestRuns(),
      makeupStepFeedback: readMakeupStepFeedback(),
      friendReviews: readFriendReviews(),
      expertReviews: readExpertReviews(),
      expertRatingLabels,
    })
  );
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  if (refs.csvDownloadLink.href) URL.revokeObjectURL(refs.csvDownloadLink.href);
  refs.csvDownloadLink.href = URL.createObjectURL(blob);
  refs.csvDownloadLink.classList.add("ready");
  refs.feedbackState.textContent = "评审 CSV 已准备";
}

function scaleActiveIntensity(scale) {
  activeLook.lipIntensity = clamp(activeLook.lipIntensity * scale, 0.18, 0.92);
  activeLook.blushIntensity = clamp(activeLook.blushIntensity * scale, 0.08, 0.72);
  activeLook.eyeIntensity = clamp(activeLook.eyeIntensity * scale, 0.08, 0.68);
  refs.lipIntensity.value = activeLook.lipIntensity;
  refs.blushIntensity.value = activeLook.blushIntensity;
  refs.eyeIntensity.value = activeLook.eyeIntensity;
  refs.lipValue.value = Math.round(activeLook.lipIntensity * 100);
  refs.blushValue.value = Math.round(activeLook.blushIntensity * 100);
  refs.eyeValue.value = Math.round(activeLook.eyeIntensity * 100);
  if (appState.getState().mode === "photo") drawPhotoFrame();
}

function switchToAlternativeLook() {
  const candidates = rankLooksByPreference({
    looks,
    preferenceProfile: buildPreferenceProfile(),
    excludeLookId: activeLook.id,
  });
  if (candidates[0]) setLook(candidates[0].look);
}

function restorePreferenceState() {
  const saved = preferenceStore.read();
  if (!saved) return;
  for (const key of Object.keys(preferenceState)) {
    if (preferencePresets[key]?.[saved[key]]) preferenceState[key] = saved[key];
  }
  syncPreferenceInputs();
}

function savePreferenceState() {
  preferenceStore.write(preferenceState);
}

function syncPreferenceInputs() {
  refs.preferenceInputs.forEach((input) => {
    input.checked = preferenceState[input.dataset.pref] === input.value;
  });
}

function clearLocalData() {
  clearStores([
    preferenceStore,
    feedbackStore,
    makeupStepFeedbackStore,
    testRunStore,
    expertReviewStore,
    friendReviewStore,
  ]);

  Object.assign(preferenceState, {
    occasion: "daily",
    goal: "fresh",
    finish: "natural",
    budget: "starter",
    existingMakeup: "bare",
    baseCoverage: "sheer",
    browStyle: "natural",
    eyeFocus: "natural",
    lipTexture: "stain",
  });
  setExpertRating("suitable");
  syncPreferenceInputs();
  refs.privacyConsent.checked = false;
  refs.photoInput.value = "";
  refs.feedbackNoteInput.value = "";
  resetFriendReviewFields();
  if (refs.downloadLink.href) URL.revokeObjectURL(refs.downloadLink.href);
  refs.downloadLink.removeAttribute("href");
  refs.downloadLink.classList.remove("ready");
  if (refs.dataDownloadLink.href) URL.revokeObjectURL(refs.dataDownloadLink.href);
  refs.dataDownloadLink.removeAttribute("href");
  refs.dataDownloadLink.classList.remove("ready");
  if (refs.csvDownloadLink.href) URL.revokeObjectURL(refs.csvDownloadLink.href);
  refs.csvDownloadLink.removeAttribute("href");
  refs.csvDownloadLink.classList.remove("ready");
  refs.feedbackState.textContent = "本地反馈";
  renderTestRuns();
  renderExpertReviews();
  renderFriendReviewSummary();
  refs.consentError.textContent = "本地记录已清除。";
  lastProfileSignals = null;
  resetValidationControls();
  lastPersonalizationKey = "";
  showIntake();
  updatePreferenceState();
  updatePreferenceSummary();
  updateProfileSummary(null);
  activeRecommendation = recommendFromPreferences();
  updateRecommendationUI(activeRecommendation);
}

function buildPreferenceProfile() {
  return buildPreferenceProfilePure({ preferences: preferenceState, presets: preferencePresets });
}

function preferenceRecommendationReason(look, preferenceProfile) {
  return preferenceRecommendationReasonPure(look, preferenceProfile);
}

function currentQualityGate() {
  return qualityGateFromSignals(lastProfileSignals);
}

function sampleToneFromIndices(landmarks, mirrored, indices, padding) {
  return sampleToneFromPoints(indices.map((index) => point(landmarks[index], mirrored)), padding);
}

function sampleToneFromPoints(points, padding = 10) {
  if (!points.length || refs.canvas.width <= 1 || refs.canvas.height <= 1) return neutralTone();

  const bounds = getBounds(points, padding);
  if (bounds.width < 1 || bounds.height < 1) return neutralTone();

  try {
    const pixels = ctx.getImageData(bounds.x, bounds.y, bounds.width, bounds.height).data;
    const pixelCount = bounds.width * bounds.height;
    const stride = Math.max(1, Math.floor(pixelCount / 900));
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;

    for (let pixel = 0; pixel < pixelCount; pixel += stride) {
      const offset = pixel * 4;
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
      if (luminance < 0.035) continue;
      r += red;
      g += green;
      b += blue;
      count += 1;
    }

    if (!count) return neutralTone();
    r /= count;
    g /= count;
    b /= count;
    return {
      r,
      g,
      b,
      luminance: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255,
      warmth: (r - b) / 255,
    };
  } catch (error) {
    return neutralTone();
  }
}

function getBounds(points, padding) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.floor(clamp(Math.min(...xs) - padding, 0, refs.canvas.width - 1));
  const yMin = Math.floor(clamp(Math.min(...ys) - padding, 0, refs.canvas.height - 1));
  const xMax = Math.ceil(clamp(Math.max(...xs) + padding, 0, refs.canvas.width));
  const yMax = Math.ceil(clamp(Math.max(...ys) + padding, 0, refs.canvas.height));
  return {
    x: xMin,
    y: yMin,
    width: Math.max(1, xMax - xMin),
    height: Math.max(1, yMax - yMin),
  };
}

function point(landmark, mirrored) {
  return landmarkToCanvas(landmark, mirrored, {
    width: refs.canvas.width,
    height: refs.canvas.height,
  });
}

function resizeCanvas(width, height) {
  const safeWidth = Math.max(1, width || 1);
  const safeHeight = Math.max(1, height || 1);
  if (refs.canvas.width !== safeWidth || refs.canvas.height !== safeHeight) {
    refs.canvas.width = safeWidth;
    refs.canvas.height = safeHeight;
  }
}

function setStatus(state, text) {
  refs.statusPill.dataset.state = state;
  refs.statusText.textContent = text;
}

function setInputGuidance(tone, text) {
  if (!refs.inputGuidance) return;
  refs.inputGuidance.dataset.tone = tone;
  refs.inputGuidance.textContent = text;
}

function captureCanvas() {
  refs.canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    refs.downloadLink.href = url;
    refs.downloadLink.classList.add("ready");
  }, "image/png");
}

function stopLoop() {
  appState.update({ running: false });
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

function stopCameraTracks() {
  const stream = refs.video.srcObject;
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
  refs.video.srcObject = null;
}
