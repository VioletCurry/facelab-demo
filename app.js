import { qualityGateFromSignals, qualityGateLabels, recommendationConfidenceCap } from "./render-policy.mjs";
import { buildCompleteMakeupPlan } from "./makeup-plan.mjs";

const modelUrl =
  "./models/face_landmarker.task";
const storageKey = "facestyle-ai-mvp-preferences";
const feedbackStorageKey = "facestyle-ai-mvp-feedback";
const makeupStepFeedbackStorageKey = "facestyle-ai-mvp-makeup-step-feedback";
const testRunStorageKey = "facestyle-ai-mvp-test-runs";
const expertReviewStorageKey = "facestyle-ai-mvp-expert-reviews";
const friendReviewStorageKey = "facestyle-ai-mvp-friend-reviews";
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

const renderVersion = "render-v5-natural-makeup";

const validationScoreLabels = {
  landmarkStability: "关键点",
  lipEdge: "唇线",
  blushPlacement: "腮红",
  eyeshadowAlignment: "眼影",
  colorVisibility: "显色",
  recommendationTaste: "审美",
  explanationTrust: "解释",
};

const validationIssueLabels = {
  lip_edge_overdraw: "唇线外溢",
  lip_too_strong: "口红过重",
  blush_not_visible: "腮红不可见",
  blush_too_high: "腮红过高",
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

const preferencePresets = {
  occasion: {
    daily: { label: "通勤", intensity: 0.38, warmth: 0.08, clarity: 0.82, light: 0.54, moods: ["clean", "sharp"] },
    date: { label: "约会", intensity: 0.48, warmth: 0.12, clarity: 0.58, light: 0.58, moods: ["rose", "fresh"] },
    interview: { label: "面试", intensity: 0.34, warmth: -0.04, clarity: 0.92, light: 0.5, moods: ["sharp", "clean"] },
    photo: { label: "拍照", intensity: 0.56, warmth: 0.18, clarity: 0.66, light: 0.62, moods: ["fresh", "bold"] },
  },
  goal: {
    fresh: { label: "提气色", intensity: 0.48, warmth: 0.24, clarity: 0.6, light: 0.62, moods: ["fresh", "rose"] },
    bright: { label: "显白", intensity: 0.42, warmth: -0.12, clarity: 0.76, light: 0.56, moods: ["rose", "sharp"] },
    lowkey: { label: "低调", intensity: 0.28, warmth: 0.06, clarity: 0.76, light: 0.5, moods: ["clean", "sharp"] },
    presence: { label: "气场", intensity: 0.62, warmth: 0.02, clarity: 0.88, light: 0.46, moods: ["bold", "sharp"] },
  },
  finish: {
    natural: { label: "清透", intensity: 0.3, warmth: 0.08, clarity: 0.68, light: 0.58, moods: ["clean", "fresh"] },
    mist: { label: "柔雾", intensity: 0.4, warmth: -0.02, clarity: 0.72, light: 0.5, moods: ["rose", "sharp"] },
    glow: { label: "水光", intensity: 0.34, warmth: 0.18, clarity: 0.56, light: 0.66, moods: ["clean", "fresh"] },
    bold: { label: "显色", intensity: 0.62, warmth: 0.08, clarity: 0.82, light: 0.48, moods: ["bold", "sharp"] },
  },
  budget: {
    starter: { label: "平价", intensity: 0.38, warmth: 0.1, clarity: 0.68, light: 0.56, moods: ["fresh", "clean"] },
    balanced: { label: "均衡", intensity: 0.44, warmth: 0.08, clarity: 0.7, light: 0.54, moods: ["clean", "rose"] },
    premium: { label: "进阶", intensity: 0.54, warmth: 0.02, clarity: 0.82, light: 0.5, moods: ["sharp", "bold"] },
    sensitive: { label: "敏感肌", intensity: 0.3, warmth: 0.06, clarity: 0.76, light: 0.58, moods: ["clean", "fresh"] },
  },
  existingMakeup: {
    bare: { label: "素颜", visibilityFloor: 0.4 },
    light: { label: "淡妆", visibilityFloor: 0.46 },
    visible: { label: "明显妆容", visibilityFloor: 0.53 },
  },
  baseCoverage: {
    sheer: { label: "底妆轻薄", intensity: 0.3, warmth: 0.04, clarity: 0.64, light: 0.62, moods: ["clean", "fresh"] },
    natural: { label: "底妆自然", intensity: 0.42, warmth: 0.06, clarity: 0.72, light: 0.56, moods: ["clean", "rose"] },
    medium: { label: "底妆中等", intensity: 0.54, warmth: 0.04, clarity: 0.8, light: 0.5, moods: ["sharp", "bold"] },
  },
  browStyle: {
    natural: { label: "眉妆原生", intensity: 0.34, warmth: 0.04, clarity: 0.64, light: 0.58, moods: ["clean", "fresh"] },
    defined: { label: "眉妆清晰", intensity: 0.46, warmth: 0.02, clarity: 0.84, light: 0.52, moods: ["rose", "sharp"] },
    sharp: { label: "眉妆利落", intensity: 0.54, warmth: -0.04, clarity: 0.92, light: 0.48, moods: ["sharp", "bold"] },
  },
  eyeFocus: {
    natural: { label: "眼妆自然", intensity: 0.32, warmth: 0.06, clarity: 0.64, light: 0.58, moods: ["clean", "rose"] },
    bright: { label: "眼妆放大", intensity: 0.48, warmth: 0.06, clarity: 0.78, light: 0.56, moods: ["fresh", "rose"] },
    lifted: { label: "眼妆提拉", intensity: 0.5, warmth: -0.02, clarity: 0.9, light: 0.5, moods: ["sharp", "bold"] },
  },
  lipTexture: {
    stain: { label: "唇部染唇", intensity: 0.36, warmth: 0.1, clarity: 0.68, light: 0.58, moods: ["clean", "fresh"] },
    satin: { label: "唇部缎光", intensity: 0.46, warmth: 0.08, clarity: 0.74, light: 0.54, moods: ["rose", "sharp"] },
    mist: { label: "唇部柔雾", intensity: 0.44, warmth: 0.02, clarity: 0.78, light: 0.5, moods: ["rose", "sharp"] },
    glow: { label: "唇部水光", intensity: 0.4, warmth: 0.16, clarity: 0.62, light: 0.64, moods: ["fresh", "clean"] },
  },
};

const refs = {
  appShell: document.querySelector("#appShell"),
  intakeScreen: document.querySelector("#intakeScreen"),
  intakeContinueBtn: document.querySelector("#intakeContinueBtn"),
  privacyConsent: document.querySelector("#privacyConsent"),
  consentError: document.querySelector("#consentError"),
  intakePreviewCard: document.querySelector("#intakePreviewCard"),
  intakePreviewState: document.querySelector("#intakePreviewState"),
  intakePreviewTitle: document.querySelector("#intakePreviewTitle"),
  intakePreviewReason: document.querySelector("#intakePreviewReason"),
  intakePreviewChips: document.querySelector("#intakePreviewChips"),
  intakePreviewSwatches: document.querySelector("#intakePreviewSwatches"),
  video: document.querySelector("#camera"),
  canvas: document.querySelector("#preview"),
  statusPill: document.querySelector("#statusPill"),
  statusText: document.querySelector("#statusPill strong"),
  emptyState: document.querySelector("#emptyState"),
  runtimeLabel: document.querySelector("#runtimeLabel"),
  startCameraBtn: document.querySelector("#startCameraBtn"),
  photoInput: document.querySelector("#photoInput"),
  inputGuidance: document.querySelector("#inputGuidance"),
  sampleButtons: document.querySelectorAll("[data-sample]"),
  recordTestBtn: document.querySelector("#recordTestBtn"),
  testNoteInput: document.querySelector("#testNoteInput"),
  testRunCount: document.querySelector("#testRunCount"),
  testRunList: document.querySelector("#testRunList"),
  qualityGateLabel: document.querySelector("#qualityGateLabel"),
  renderVersionLabel: document.querySelector("#renderVersionLabel"),
  validationScoreInputs: document.querySelectorAll("[data-validation-score]"),
  validationIssueButtons: document.querySelectorAll("[data-validation-issue]"),
  expertButtons: document.querySelectorAll("[data-expert-rating]"),
  recordExpertBtn: document.querySelector("#recordExpertBtn"),
  expertNoteInput: document.querySelector("#expertNoteInput"),
  expertReviewCount: document.querySelector("#expertReviewCount"),
  expertReviewList: document.querySelector("#expertReviewList"),
  friendReviewCount: document.querySelector("#friendReviewCount"),
  friendReviewSummary: document.querySelector("#friendReviewSummary"),
  preferenceInputs: document.querySelectorAll("[data-pref]"),
  preferenceSummaryChips: document.querySelector("#preferenceSummaryChips"),
  editPreferencesBtn: document.querySelector("#editPreferencesBtn"),
  profileState: document.querySelector("#profileState"),
  profileSummary: document.querySelector("#profileSummary"),
  recommendationState: document.querySelector("#recommendationState"),
  recommendationTitle: document.querySelector("#recommendationTitle"),
  recommendationReason: document.querySelector("#recommendationReason"),
  recommendationConfidence: document.querySelector("#recommendationConfidence"),
  recommendationChips: document.querySelector("#recommendationChips"),
  applyRecommendationBtn: document.querySelector("#applyRecommendationBtn"),
  lookGrid: document.querySelector("#lookGrid"),
  lookName: document.querySelector("#lookName"),
  stylePlan: document.querySelector("#stylePlan"),
  makeupPlanSummary: document.querySelector("#makeupPlanSummary"),
  productList: document.querySelector("#productList"),
  productBudgetLabel: document.querySelector("#productBudgetLabel"),
  lipIntensity: document.querySelector("#lipIntensity"),
  blushIntensity: document.querySelector("#blushIntensity"),
  eyeIntensity: document.querySelector("#eyeIntensity"),
  lipValue: document.querySelector("#lipValue"),
  blushValue: document.querySelector("#blushValue"),
  eyeValue: document.querySelector("#eyeValue"),
  lipColor: document.querySelector("#lipColor"),
  blushColor: document.querySelector("#blushColor"),
  eyeColor: document.querySelector("#eyeColor"),
  beforeToggle: document.querySelector("#beforeToggle"),
  qualityLabel: document.querySelector("#qualityLabel"),
  captureBtn: document.querySelector("#captureBtn"),
  openResultBtn: document.querySelector("#openResultBtn"),
  closeResultBtn: document.querySelector("#closeResultBtn"),
  exportDataBtn: document.querySelector("#exportDataBtn"),
  exportCsvBtn: document.querySelector("#exportCsvBtn"),
  resultSheet: document.querySelector("#resultSheet"),
  resultMode: document.querySelector("#resultMode"),
  resultLookName: document.querySelector("#resultLookName"),
  resultReason: document.querySelector("#resultReason"),
  resultSwatches: document.querySelector("#resultSwatches"),
  resultProfile: document.querySelector("#resultProfile"),
  resultStylePlan: document.querySelector("#resultStylePlan"),
  resultMakeupPlan: document.querySelector("#resultMakeupPlan"),
  resultProducts: document.querySelector("#resultProducts"),
  resultTests: document.querySelector("#resultTests"),
  clearDataBtn: document.querySelector("#clearDataBtn"),
  downloadLink: document.querySelector("#downloadLink"),
  dataDownloadLink: document.querySelector("#dataDownloadLink"),
  csvDownloadLink: document.querySelector("#csvDownloadLink"),
  feedbackState: document.querySelector("#feedbackState"),
  feedbackNoteInput: document.querySelector("#feedbackNoteInput"),
  feedbackButtons: document.querySelectorAll("[data-feedback]"),
  friendPrivacyComfort: document.querySelector("#friendPrivacyComfort"),
  friendFitScore: document.querySelector("#friendFitScore"),
  friendNaturalnessScore: document.querySelector("#friendNaturalnessScore"),
  friendReuseIntent: document.querySelector("#friendReuseIntent"),
  friendReviewNoteInput: document.querySelector("#friendReviewNoteInput"),
  recordFriendReviewBtn: document.querySelector("#recordFriendReviewBtn"),
};

const ctx = refs.canvas.getContext("2d", { alpha: false });
const makeupLayer = document.createElement("canvas");
const makeupLayerCtx = makeupLayer.getContext("2d");

let faceLandmarker;
let FaceLandmarkerClass;
let FilesetResolverClass;
let activeLook = { ...looks[0] };
let running = false;
let mode = "idle";
let photoImage = null;
let lastVideoTime = -1;
let lastResults = null;
let rafId = null;
let beautyEnabled = true;
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

const lipOuter = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37,
  39, 40, 185,
];
const lipInner = [
  78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82,
  81, 80, 191,
];
const upperLipOuter = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];
const upperLipInner = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
const lowerLipOuter = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291];
const lowerLipInner = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308];
const developerMode = new URLSearchParams(window.location.search).get("mode") === "developer";

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

  try {
    const vision = await import(
      "./node_modules/@mediapipe/tasks-vision/vision_bundle.mjs"
    );
    FaceLandmarkerClass = vision.FaceLandmarker;
    FilesetResolverClass = vision.FilesetResolver;

    const filesetResolver = await FilesetResolverClass.forVisionTasks(
      "./node_modules/@mediapipe/tasks-vision/wasm"
    );
    faceLandmarker = await FaceLandmarkerClass.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: modelUrl,
        delegate: "GPU",
      },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: "VIDEO",
      numFaces: 1,
    });
    refs.runtimeLabel.textContent = "模型已就绪";
    setStatus("idle", "可开始");
  } catch (error) {
    console.error(error);
    refs.runtimeLabel.textContent = "模型加载失败";
    setStatus("error", "加载失败");
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
      if (mode === "photo") {
        drawPhotoFrame();
      } else if (lastResults?.faceLandmarks?.length && mode === "camera") {
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
    beautyEnabled = refs.beforeToggle.checked;
    if (mode === "photo") drawPhotoFrame();
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
  mode = "idle";
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
    if (mode === "photo") drawPhotoFrame();
  });
}

function updateColor(key, value) {
  activeLook[key] = value;
  if (mode === "photo") drawPhotoFrame();
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
  if (mode === "photo") drawPhotoFrame();
}

async function startCamera() {
  if (!faceLandmarker) {
    setStatus("error", "模型未就绪");
    return;
  }

  stopLoop();
  resetSmoothing();
  mode = "camera";
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
    running = true;
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
  if (!file || !faceLandmarker) return;

  stopCameraTracks();
  stopLoop();
  resetSmoothing();
  mode = "photo";
  refs.emptyState.classList.add("hidden");
  refs.downloadLink.classList.remove("ready");
  setStatus("idle", "分析照片");
  setInputGuidance("idle", "正在分析照片。请优先使用单人正脸、脸部完整、光线均匀的图片。");

  const image = new Image();
  image.decoding = "async";
  image.onload = async () => {
    photoImage = image;
    await drawPhotoFrame();
  };
  image.src = URL.createObjectURL(file);
}

function loopCamera() {
  if (!running || mode !== "camera") return;

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
    if (mode === "camera") setStatus("idle", "寻找人脸");
    refs.qualityLabel.textContent = "未识别人脸";
    setInputGuidance(
      mode === "camera" ? "idle" : "error",
      mode === "camera"
        ? "请把脸放在画面中央，面向镜头，并增加正面光线。"
        : "没有识别人脸。请换成单人正脸照片，并避免遮挡、侧脸或多人合照。"
    );
    lastProfileSignals = null;
    renderValidationState();
    updateProfileSummary(null);
    renderPersonalizationPanels();
    const fallbackRecommendation = recommendFromPreferences();
    activeRecommendation =
      mode === "idle"
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

  const landmarks = mode === "camera" ? smoothLandmarks(rawLandmarks) : rawLandmarks;
  const pose = measureFacePose(landmarks, mirrored);
  const quality = estimateFaceQuality(landmarks, mirrored, pose);
  const faceTone = sampleToneFromIndices(landmarks, mirrored, [10, 1, 50, 280, 234, 454, 152], 26);
  const renderDiagnostics = {
    version: renderVersion,
    status: beautyEnabled ? "ready" : "before-mode",
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

  if (!beautyEnabled) return;

  const makeupOpacity = clamp(mapRange(quality, 0.28, 0.72, 0.74, 1), 0.72, 1) * realtimeMakeupMultiplier(pose);
  renderDiagnostics.parameters.makeupOpacity = Number(makeupOpacity.toFixed(3));
  renderDiagnostics.parameters.landmarkMotion = Number(lastLandmarkMotion.toFixed(4));
  drawEyeShadow(landmarks, mirrored, makeupOpacity, pose, renderDiagnostics);
  drawBlush(landmarks, mirrored, makeupOpacity, pose, renderDiagnostics);
  drawLips(landmarks, mirrored, makeupOpacity, pose, renderDiagnostics);
}

function drawLips(landmarks, mirrored, qualityOpacity, pose, diagnostics) {
  const mouthOpen = pose.mouthOpen ?? 0;
  const yaw = pose.yaw ?? 0;
  const lipDiagnostic = {
    status: "rendered",
    partial: false,
    reason: "",
    mouthOpen: Number(mouthOpen.toFixed(3)),
    yaw: Number(yaw.toFixed(3)),
  };
  if (diagnostics) diagnostics.lip = lipDiagnostic;
  const upperOuter = upperLipOuter.map((index) => point(landmarks[index], mirrored));
  const upperInner = upperLipInner.map((index) => point(landmarks[index], mirrored)).reverse();
  const lowerOuter = lowerLipOuter.map((index) => point(landmarks[index], mirrored));
  const lowerInner = lowerLipInner.map((index) => point(landmarks[index], mirrored)).reverse();
  const allOuter = lipOuter.map((index) => point(landmarks[index], mirrored));
  const innerMouth = lipInner.map((index) => point(landmarks[index], mirrored));
  const upperPath = [...upperOuter, ...upperInner];
  const lowerPath = [...lowerOuter, ...lowerInner];
  const mouthWidth = Math.max(1, distance(point(landmarks[61], mirrored), point(landmarks[291], mirrored)));
  const faceWidth = Math.max(1, distance(point(landmarks[234], mirrored), point(landmarks[454], mirrored)));
  const mouthRatio = mouthWidth / faceWidth;
  if (mouthOpen > 0.28 || yaw > 0.44 || mouthRatio < 0.08) {
    lipDiagnostic.status = "skipped";
    lipDiagnostic.reason = mouthOpen > 0.28 ? "mouth-unreliable" : yaw > 0.44 ? "profile-unreliable" : "lip-landmarks-uncertain";
    return;
  }
  lipDiagnostic.partial = mouthOpen > 0.1 || yaw > 0.12;
  if (lipDiagnostic.partial) lipDiagnostic.reason = mouthOpen > 0.1 ? "partial-mouth-safe" : "partial-yaw-safe";
  const lipTone = sampleToneFromPoints([...allOuter, ...innerMouth], Math.max(4, mouthWidth * 0.025));
  const mouthComfort = clamp(mapRange(mouthOpen, 0.06, 0.24, 1, 0.72), 0.72, 1);
  const poseComfort = clamp(mapRange(yaw, 0.1, 0.44, 1, 0.62), 0.62, 1);
  const opacity =
    activeLook.lipIntensity *
    qualityOpacity *
    makeupVisibilityMultiplier(lipTone) *
    mouthComfort *
    poseComfort *
    (mode === "camera" ? 0.86 : 0.98);
  const edgeBlur = clamp(mouthWidth * 0.012, 0.8, 3.8);
  const eraseBlur = clamp(mouthWidth * mapRange(mouthOpen, 0.02, 0.12, 0.012, 0.032), 1.2, 5.6);
  const lipRgb = adaptMakeupColor(activeLook.lip, lipTone, { mix: 0.04, lightBoost: 0.98, minimumContrast: 0.22 });
  const lipSoftRgb = adaptMakeupColor(activeLook.lip, lipTone, { mix: 0.1, lightBoost: 1.08, minimumContrast: 0.16 });
  const highlightRgb = mixRgb(lipSoftRgb, { r: 255, g: 236, b: 226 }, 0.32);

  drawFeatheredFill({
    paths: [upperPath, lowerPath],
    erasePaths: [innerMouth],
    color: rgbaFromRgb(lipSoftRgb, opacity * 0.64),
    blur: edgeBlur * 1.3,
    eraseBlur,
    composite: "source-over",
  });

  drawFeatheredFill({
    paths: [upperPath, lowerPath],
    erasePaths: [innerMouth],
    color: rgbaFromRgb(lipRgb, opacity * 0.54),
    blur: edgeBlur,
    eraseBlur,
    composite: "multiply",
  });

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = rgbaFromRgb(highlightRgb, opacity * 0.17);
  ctx.lineWidth = clamp(mouthWidth * 0.018, 1.1, 3.2);
  ctx.filter = "blur(0.55px)";
  drawClosedPath(allOuter);
  ctx.stroke();
  drawOpenPath(lowerLipInner.slice(2, 9).map((index) => point(landmarks[index], mirrored)));
  ctx.stroke();
  ctx.restore();
}

function drawBlush(landmarks, mirrored, qualityOpacity, pose, diagnostics) {
  const leftOuter = point(landmarks[234], mirrored);
  const rightOuter = point(landmarks[454], mirrored);
  const leftAnchor = point(landmarks[187] ?? landmarks[234], mirrored);
  const rightAnchor = point(landmarks[411] ?? landmarks[454], mirrored);
  const leftReference = point(landmarks[50] ?? landmarks[187] ?? landmarks[234], mirrored);
  const rightReference = point(landmarks[280] ?? landmarks[411] ?? landmarks[454], mirrored);
  const nose = point(landmarks[1] ?? landmarks[4], mirrored);
  const faceWidth = distance(leftOuter, rightOuter);
  const leftEye = point(landmarks[33], mirrored);
  const rightEye = point(landmarks[263], mirrored);
  const left = movePoint(mixPoints(leftAnchor, leftReference, 0.28), { x: 0, y: -faceWidth * 0.012 });
  const right = movePoint(mixPoints(rightAnchor, rightReference, 0.28), { x: 0, y: -faceWidth * 0.012 });
  const leftRadiusX = clamp(distance(left, nose) * 0.58, faceWidth * 0.095, faceWidth * 0.14);
  const rightRadiusX = clamp(distance(right, nose) * 0.58, faceWidth * 0.095, faceWidth * 0.14);
  const leftRadiusY = clamp(Math.abs(left.y - leftEye.y) * 0.56, faceWidth * 0.06, faceWidth * 0.092);
  const rightRadiusY = clamp(Math.abs(right.y - rightEye.y) * 0.56, faceWidth * 0.06, faceWidth * 0.092);
  const leftTone = sampleToneFromPoints([left, leftReference], leftRadiusX * 0.42);
  const rightTone = sampleToneFromPoints([right, rightReference], rightRadiusX * 0.42);
  const sharedBlushTone = {
    r: average([leftTone.r, rightTone.r]),
    g: average([leftTone.g, rightTone.g]),
    b: average([leftTone.b, rightTone.b]),
    luminance: average([leftTone.luminance, rightTone.luminance]),
    warmth: average([leftTone.warmth, rightTone.warmth]),
  };
  const blushColor = adaptMakeupColor(activeLook.blush, sharedBlushTone, {
    mix: 0.1,
    lightBoost: 1.08,
    minimumContrast: 0.18,
  });
  const leftAngle = angleBetween(leftOuter, left);
  const rightAngle = angleBetween(rightOuter, right);
  const sides = makeupSideVisibility(pose);
  const leftReliability = assessCheekReliability(left, leftRadiusX, leftRadiusY, leftAngle);
  const rightReliability = assessCheekReliability(right, rightRadiusX, rightRadiusY, rightAngle);
  if ((pose.yaw ?? 0) > 0.34) {
    leftReliability.reliable = false;
    rightReliability.reliable = false;
    leftReliability.reason = "profile-cheek-uncertain";
    rightReliability.reason = "profile-cheek-uncertain";
  }
  const blushDiagnostic = {
    mode: sides.mode,
    left: {
      ...leftReliability,
      rendered: false,
      toneLuminance: Number((leftTone.luminance ?? 0.56).toFixed(3)),
      blendMode: (sharedBlushTone.luminance ?? 0.56) < 0.3 ? "shadow-preserving" : "source-over",
    },
    right: {
      ...rightReliability,
      rendered: false,
      toneLuminance: Number((rightTone.luminance ?? 0.56).toFixed(3)),
      blendMode: (sharedBlushTone.luminance ?? 0.56) < 0.3 ? "shadow-preserving" : "source-over",
    },
  };
  if (diagnostics) diagnostics.blush = blushDiagnostic;

  ctx.save();
  const blushBoost = mode === "camera" ? 1.05 : 1.42;
  const drawOneBlush = (center, radiusX, radiusY, angle, color, intensity, tone) => {
    if ((tone?.luminance ?? 0.56) < 0.3) {
      ctx.globalCompositeOperation = "soft-light";
      drawBlushCloud(center.x, center.y, radiusX, radiusY, angle, color, intensity * 1.12);
      ctx.globalCompositeOperation = "source-over";
      drawBlushCloud(center.x, center.y, radiusX, radiusY, angle, color, intensity * 0.2);
      return;
    }
    ctx.globalCompositeOperation = "source-over";
    drawBlushCloud(center.x, center.y, radiusX, radiusY, angle, color, intensity);
  };
  if (sides.left && leftReliability.reliable) {
    drawOneBlush(
      left,
      leftRadiusX,
      leftRadiusY,
      leftAngle,
      blushColor,
      clamp(
        activeLook.blushIntensity * qualityOpacity * makeupVisibilityMultiplier(sharedBlushTone) * blushBoost * sides.leftOpacity,
        0,
        1
      ),
      sharedBlushTone
    );
    blushDiagnostic.left.rendered = true;
  } else if (!sides.left) {
    blushDiagnostic.left.reason = "profile-far-side-hidden";
  } else {
    blushDiagnostic.left.reason = leftReliability.reason || "occlusion-uncertain";
  }
  if (sides.right && rightReliability.reliable) {
    drawOneBlush(
      right,
      rightRadiusX,
      rightRadiusY,
      rightAngle,
      blushColor,
      clamp(
        activeLook.blushIntensity * qualityOpacity * makeupVisibilityMultiplier(sharedBlushTone) * blushBoost * sides.rightOpacity,
        0,
        1
      ),
      sharedBlushTone
    );
    blushDiagnostic.right.rendered = true;
  } else if (!sides.right) {
    blushDiagnostic.right.reason = "profile-far-side-hidden";
  } else {
    blushDiagnostic.right.reason = rightReliability.reason || "occlusion-uncertain";
  }
  ctx.restore();
}

function drawEyeShadow(landmarks, mirrored, qualityOpacity, pose, diagnostics) {
  const faceWidth = distance(point(landmarks[234], mirrored), point(landmarks[454], mirrored));
  const lift = clamp(faceWidth * 0.028, 4, 14);
  const blur = clamp(faceWidth * 0.014, 1.5, 5.5);
  const leftPath = eyeLidShadowPath([33, 246, 161, 160, 159, 158, 157, 173, 133], landmarks, mirrored, lift);
  const rightPath = eyeLidShadowPath([263, 466, 388, 387, 386, 385, 384, 398, 362], landmarks, mirrored, lift);
  const leftTone = sampleToneFromPoints(leftPath, lift * 1.2);
  const rightTone = sampleToneFromPoints(rightPath, lift * 1.2);
  const warmSafe = (diagnostics?.faceTone?.warmth ?? 0) > 0.08 && (activeLook.profile?.warmth ?? 0) >= -0.08;
  const leftColor = adaptEyeShadowColor(activeLook.eye, leftTone, warmSafe);
  const rightColor = adaptEyeShadowColor(activeLook.eye, rightTone, warmSafe);
  const sides = makeupSideVisibility(pose);
  const eyeDiagnostic = {
    mode: sides.mode,
    warmSafe,
    left: { rendered: false, color: leftColor, luminance: Number((leftTone.luminance ?? 0.56).toFixed(3)) },
    right: { rendered: false, color: rightColor, luminance: Number((rightTone.luminance ?? 0.56).toFixed(3)) },
  };
  if (diagnostics) diagnostics.eyeshadow = eyeDiagnostic;

  const drawOneEye = (path, tone, color, sideOpacity) => {
    const darkSceneFactor = clamp(mapRange(tone?.luminance ?? 0.56, 0.08, 0.28, 0.52, 1), 0.52, 1);
    const eyeBoost = mode === "camera" ? 1.12 : 1.5;
    const opacity = clamp(activeLook.eyeIntensity * qualityOpacity * makeupVisibilityMultiplier(tone) * eyeBoost * sideOpacity * darkSceneFactor, 0, 1);
    drawFeatheredFill({
      paths: [path],
      color: rgbaFromRgb(color, opacity * 0.58),
      blur,
      composite: "source-over",
    });
    drawFeatheredFill({
      paths: [path],
      color: rgbaFromRgb(color, opacity * ((tone?.luminance ?? 0.56) < 0.28 ? 0.2 : 0.36)),
      blur: blur * 0.74,
      composite: "multiply",
    });
  };

  if (sides.left) {
    drawOneEye(leftPath, leftTone, leftColor, sides.leftOpacity);
    eyeDiagnostic.left.rendered = true;
  } else {
    eyeDiagnostic.left.reason = "profile-far-side-hidden";
  }
  if (sides.right) {
    drawOneEye(rightPath, rightTone, rightColor, sides.rightOpacity);
    eyeDiagnostic.right.rendered = true;
  } else {
    eyeDiagnostic.right.reason = "profile-far-side-hidden";
  }
}

function makeupSideVisibility(pose = {}) {
  const yaw = pose.yaw ?? 0;
  const visibleSide = pose.visibleSide === "right" ? "right" : "left";
  if (yaw > 0.32) {
    return {
      mode: "profile-visible-side-only",
      left: visibleSide === "left",
      right: visibleSide === "right",
      leftOpacity: visibleSide === "left" ? 1 : 0,
      rightOpacity: visibleSide === "right" ? 1 : 0,
    };
  }

  const farSideOpacity = clamp(mapRange(yaw, 0.08, 0.32, 1, 0.62), 0.62, 1);
  return {
    mode: yaw > 0.08 ? "mild-yaw-bilateral" : "bilateral",
    left: true,
    right: true,
    leftOpacity: visibleSide === "left" ? 1 : Number(farSideOpacity.toFixed(3)),
    rightOpacity: visibleSide === "right" ? 1 : Number(farSideOpacity.toFixed(3)),
  };
}

function smoothLandmarks(rawLandmarks) {
  if (!smoothedLandmarks || smoothedLandmarks.length !== rawLandmarks.length) {
    smoothedLandmarks = rawLandmarks.map((landmark) => ({ ...landmark }));
    lastLandmarkMotion = 0;
    return smoothedLandmarks;
  }

  const anchorIndices = [1, 33, 263, 61, 291, 152];
  const faceWidth = Math.max(
    0.001,
    Math.hypot(rawLandmarks[234].x - rawLandmarks[454].x, rawLandmarks[234].y - rawLandmarks[454].y)
  );
  const motion = average(
    anchorIndices.map((index) => {
      const previous = smoothedLandmarks[index] ?? rawLandmarks[index];
      const current = rawLandmarks[index];
      return Math.hypot(previous.x - current.x, previous.y - current.y) / faceWidth;
    })
  );
  lastLandmarkMotion = motion;
  const smoothing = motion > 0.022 ? 0.5 : lastQuality < 0.55 ? 0.74 : 0.68;

  smoothedLandmarks = rawLandmarks.map((landmark, index) => {
    const previous = smoothedLandmarks[index] ?? landmark;
    return {
      x: previous.x * smoothing + landmark.x * (1 - smoothing),
      y: previous.y * smoothing + landmark.y * (1 - smoothing),
      z: (previous.z ?? 0) * smoothing + (landmark.z ?? 0) * (1 - smoothing),
    };
  });
  return smoothedLandmarks;
}

function resetSmoothing() {
  smoothedLandmarks = null;
  lastQuality = 0;
  lastLandmarkMotion = 0;
}

function realtimeMakeupMultiplier(pose) {
  if (mode !== "camera") return 1;
  const movementComfort = clamp(mapRange(lastLandmarkMotion, 0.004, 0.038, 1, 0.56), 0.56, 1);
  const poseComfort = clamp(mapRange(Math.max(pose.yaw ?? 0, pose.mouthOpen ?? 0), 0.04, 0.24, 1, 0.72), 0.72, 1);
  return clamp(0.8 * movementComfort * poseComfort, 0.42, 0.8);
}

function measureFacePose(landmarks, mirrored) {
  const leftCheek = point(landmarks[234], mirrored);
  const rightCheek = point(landmarks[454], mirrored);
  const nose = point(landmarks[1] ?? landmarks[4], mirrored);
  const faceWidth = Math.max(1, distance(leftCheek, rightCheek));
  const centerX = (leftCheek.x + rightCheek.x) / 2;
  const mouthWidth = Math.max(1, distance(point(landmarks[61], mirrored), point(landmarks[291], mirrored)));
  const mouthOpen = distance(point(landmarks[13], mirrored), point(landmarks[14], mirrored)) / mouthWidth;
  const leftVisibility = distance(nose, leftCheek) / faceWidth;
  const rightVisibility = distance(nose, rightCheek) / faceWidth;
  return {
    yaw: Math.abs(nose.x - centerX) / faceWidth,
    mouthOpen,
    visibleSide: leftVisibility >= rightVisibility ? "left" : "right",
  };
}

function estimateFaceQuality(landmarks, mirrored, pose = measureFacePose(landmarks, mirrored)) {
  const leftCheek = point(landmarks[234], mirrored);
  const rightCheek = point(landmarks[454], mirrored);
  const chin = point(landmarks[152], mirrored);
  const forehead = point(landmarks[10], mirrored);
  const faceWidth = Math.max(1, distance(leftCheek, rightCheek));
  const faceHeight = Math.max(1, distance(chin, forehead));
  const sizeScore = clamp(faceWidth / (refs.canvas.width * 0.22), 0, 1);
  const proportionScore = clamp(faceHeight / faceWidth / 1.15, 0, 1);
  const yawScore = clamp(1 - mapRange(pose.yaw, 0.04, 0.22, 0, 0.72), 0.28, 1);
  return clamp(sizeScore * 0.4 + proportionScore * 0.2 + yawScore * 0.4, 0, 1);
}

function updateQualityLabel(quality, faceTone, pose) {
  if (!beautyEnabled) {
    refs.qualityLabel.textContent = "Before 模式";
    return;
  }
  refs.qualityLabel.textContent = guidanceForFace(quality, faceTone, pose).label;
}

function recommendLook(landmarks, mirrored, quality, faceTone, pose = measureFacePose(landmarks, mirrored)) {
  const preferenceProfile = buildPreferenceProfile();
  const leftCheek = point(landmarks[234], mirrored);
  const rightCheek = point(landmarks[454], mirrored);
  const faceWidth = Math.max(1, distance(leftCheek, rightCheek));
  const mouthOpen = pose.mouthOpen;
  const luminance = faceTone?.luminance ?? 0.56;
  const warmth = clamp(faceTone?.warmth ?? 0.12, -0.35, 0.45);
  const desiredIntensity = clamp(
    (quality < 0.5 ? 0.34 : 0.44) +
      (luminance > 0.78 ? 0.05 : 0) +
      (preferenceProfile.visibilityFloor - 0.4) -
      clamp(mouthOpen, 0, 0.18) * 0.18,
    0.32,
    0.68
  );
  const desiredWarmth = clamp(warmth * 1.15, -0.26, 0.38);
  const desiredLight = clamp(luminance, 0.34, 0.76);
  const desiredClarity = clamp(quality < 0.52 ? 0.86 : 0.6 + mapRange(faceWidth, 120, 420, 0.08, -0.08), 0.48, 0.92);

  const scored = looks
    .map((look) => {
      const profile = look.profile;
      const faceScore =
        similarity(profile.intensity, desiredIntensity, 0.42) * 0.32 +
        similarity(profile.warmth, desiredWarmth, 0.62) * 0.24 +
        similarity(profile.light, desiredLight, 0.5) * 0.2 +
        similarity(profile.clarity, desiredClarity, 0.5) * 0.24;
      const intentScore = preferenceScore(look, preferenceProfile);
      let score = faceScore * 0.58 + intentScore * 0.42;

      if (quality < 0.48 && profile.intensity > 0.5) score -= 0.12;
      if (luminance > 0.78 && profile.intensity < 0.34) score -= 0.07;
      if (mouthOpen > 0.1 && look.lipIntensity > 0.68) score -= 0.08;
      if (preferenceProfile.existingMakeup === "visible" && profile.intensity < 0.42) score -= 0.12;
      if (warmth > 0.2 && profile.warmth > 0.2) score += 0.04;
      if (warmth < -0.08 && profile.warmth < -0.08) score += 0.04;

      return { look, score: clamp(score, 0, 1) };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const gate = qualityGateFromSignals({ quality, faceTone, pose });
  const confidence = Math.round(mapRange(best.score, 0.42, 0.92, 62, 96));
  const signals = { quality, luminance, warmth, mouthOpen, desiredIntensity, pose, gate };
  const chips = recommendationChips(signals, preferenceProfile);
  return {
    lookId: best.look.id,
    lookName: best.look.name,
    confidence: clamp(Math.min(confidence, recommendationConfidenceCap(gate.id)), 0, 98),
    canApply: gate.id === "good_for_tryon" || gate.id === "usable_but_unstable",
    caveat: gate.id === "good_for_tryon" ? "" : gate.label,
    chips,
    source: "face",
    reason: recommendationReason(best.look, signals, preferenceProfile),
  };
}

function recommendFromPreferences() {
  const preferenceProfile = buildPreferenceProfile();
  const scored = looks
    .map((look) => ({ look, score: preferenceScore(look, preferenceProfile) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  return {
    lookId: best.look.id,
    lookName: best.look.name,
    confidence: null,
    canApply: true,
    chips: preferenceChips(preferenceProfile),
    source: "preference",
    reason: preferenceRecommendationReason(best.look, preferenceProfile),
  };
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
    delete refs.applyRecommendationBtn.dataset.lookId;
    refs.recommendationState.textContent = "等待人脸";
    refs.recommendationTitle.textContent = "等待分析";
    refs.recommendationReason.textContent = "识别人脸后，会根据光线、角度和当前画面自动挑选更适合的妆容。";
    refs.recommendationConfidence.textContent = "匹配度 --";
    refs.recommendationChips.innerHTML = "";
    refs.applyRecommendationBtn.disabled = true;
    updateLookRecommendationMarker(null);
    return;
  }

  activeRecommendation = recommendation;
  updateIntakePreview(recommendation);
  refs.applyRecommendationBtn.dataset.lookId = recommendation.lookId;
  refs.recommendationState.textContent = recommendation.canApply === false ? "建议重拍" : recommendation.source === "face" ? "融合推荐" : "问询推荐";
  refs.recommendationTitle.textContent = recommendation.lookName;
  refs.recommendationReason.textContent = recommendation.reason;
  refs.recommendationConfidence.textContent = recommendation.confidence == null ? "问卷方向" : `匹配度 ${recommendation.confidence}`;
  refs.recommendationChips.innerHTML = recommendation.chips.map((chip) => `<span>${chip}</span>`).join("");
  refs.applyRecommendationBtn.disabled = recommendation.canApply === false;
  updateLookRecommendationMarker(recommendation.lookId);
}

function updateIntakePreview(recommendation) {
  if (!refs.intakePreviewCard) return;

  if (!recommendation) {
    refs.intakePreviewState.textContent = "等待选择";
    refs.intakePreviewTitle.textContent = "等待推荐";
    refs.intakePreviewReason.textContent = "选择场景、目标和妆感后，会先生成一版不需要摄像头的推荐。";
    refs.intakePreviewChips.innerHTML = "";
    refs.intakePreviewSwatches.innerHTML = "";
    return;
  }

  const look = looks.find((item) => item.id === recommendation.lookId);
  refs.intakePreviewState.textContent = recommendation.source === "face" ? "融合推荐" : "问询推荐";
  refs.intakePreviewTitle.textContent = recommendation.lookName;
  refs.intakePreviewReason.textContent = recommendation.reason;
  refs.intakePreviewChips.innerHTML = recommendation.chips.map((chip) => `<span>${chip}</span>`).join("");
  refs.intakePreviewSwatches.innerHTML = look
    ? `
      <span style="background:${look.lip}"></span>
      <span style="background:${look.blush}"></span>
      <span style="background:${look.eye}"></span>
    `
    : "";
}

function updateLookRecommendationMarker(lookId) {
  document.querySelectorAll(".look-card").forEach((card) => {
    card.classList.toggle("recommended", card.dataset.lookId === lookId);
  });
}

function updatePreferenceState() {
  refs.preferenceInputs.forEach((input) => {
    if (input.checked) preferenceState[input.dataset.pref] = input.value;
  });
}

function updatePreferenceSummary() {
  const profile = buildPreferenceProfile();
  refs.preferenceSummaryChips.innerHTML = [...profile.labels, profile.existingMakeupLabel, ...profile.detailLabels]
    .map((label) => `<span>${label}</span>`)
    .join("");
}

function updateProfileSummary(signals) {
  const profile = buildPreferenceProfile();
  const intensityText =
    profile.intensity > 0.52 ? "推荐保留更明确的唇色和眼部存在感" : profile.intensity < 0.34 ? "推荐低负担、低对比度的自然妆效" : "推荐中等显色，优先提气色";
  const budgetText = budgetHint(preferenceState.budget);

  if (!signals) {
    refs.profileState.textContent = "问卷生成";
    refs.profileSummary.innerHTML = `
      <span>${profile.labels.join(" / ")}</span>
      <strong>${intensityText}；${budgetText}。</strong>
    `;
    return;
  }

  const { quality, faceTone, guidance } = signals;
  const toneText = toneLabel(faceTone.warmth);
  const lightText = lightLabel(faceTone.luminance);
  const fitText = guidance?.summary ?? (quality > 0.72 ? "关键点贴合良好" : quality > 0.48 ? "关键点可用" : "角度偏大，推荐会更保守");
  refs.profileState.textContent = "脸部融合";
  refs.profileSummary.innerHTML = `
    <span>${toneText} / ${lightText} / ${fitText}</span>
    <strong>${intensityText}；${budgetText}。</strong>
  `;
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
  refs.stylePlan.innerHTML = currentStyleItems()
    .map(([title, body]) => `<article><span>${title}</span><strong>${body}</strong></article>`)
    .join("");
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
  const plan = currentMakeupPlan();
  const previewCount = plan.filter((step) => step.visualPreview).length;
  refs.makeupPlanSummary.innerHTML = `
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
  refs.productBudgetLabel.textContent = copy.label;
  refs.productList.innerHTML = currentProducts()
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

function setSampleScenario(sampleId) {
  activeSampleScenario = sampleScenarios[sampleId] ? sampleId : "front-natural";
  refs.sampleButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.sample === activeSampleScenario);
  });
}

function renderValidationState() {
  const gate = currentQualityGate();
  refs.qualityGateLabel.textContent = gate.label;
  refs.renderVersionLabel.textContent = renderVersion;
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
  try {
    const runs = JSON.parse(localStorage.getItem(testRunStorageKey) || "[]");
    return Array.isArray(runs) ? runs : [];
  } catch (error) {
    console.warn("Unable to read test runs", error);
    return [];
  }
}

function saveTestRuns(runs) {
  try {
    localStorage.setItem(testRunStorageKey, JSON.stringify(runs));
  } catch (error) {
    console.warn("Unable to save test runs", error);
  }
}

function renderTestRuns() {
  const runs = readTestRuns();
  refs.testRunCount.textContent = `${runs.length} 条`;
  if (!runs.length) {
    refs.testRunList.innerHTML = `<p>上传真实照片后，给样本打标签并记录结果。</p>`;
    return;
  }

  refs.testRunList.innerHTML = runs
    .slice(0, 4)
    .map(
      (run) => `
        <article>
          <strong>${run.sampleLabel}</strong>
          <span>${run.lookName} / ${run.source}</span>
          <small>${testMetricText(run)}</small>
          ${scoreSummaryText(run.scores) ? `<small>${scoreSummaryText(run.scores)}</small>` : ""}
          ${issueSummaryText(run.issueTags) ? `<small>${issueSummaryText(run.issueTags)}</small>` : ""}
          ${run.note ? `<p>${escapeHtml(run.note)}</p>` : ""}
        </article>
      `
    )
    .join("");
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
  try {
    const reviews = JSON.parse(localStorage.getItem(expertReviewStorageKey) || "[]");
    return Array.isArray(reviews) ? reviews : [];
  } catch (error) {
    console.warn("Unable to read expert reviews", error);
    return [];
  }
}

function saveExpertReviews(reviews) {
  try {
    localStorage.setItem(expertReviewStorageKey, JSON.stringify(reviews));
  } catch (error) {
    console.warn("Unable to save expert reviews", error);
  }
}

function renderExpertReviews() {
  const reviews = readExpertReviews();
  refs.expertReviewCount.textContent = `${reviews.length} 条`;
  if (!reviews.length) {
    refs.expertReviewList.innerHTML = `<p>专家评审只保存标签、备注和推荐上下文，不保存照片。</p>`;
    return;
  }

  refs.expertReviewList.innerHTML = reviews
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

function testMetricText(run) {
  const gate = run.qualityGateLabel ?? qualityGateLabels[run.qualityGate] ?? "未分级";
  const version = run.renderVersion ?? renderVersion;
  if (run.quality == null) return `未识别人脸，仅记录问卷推荐 / ${gate} / ${version}`;
  const light = run.luminance < 34 ? "偏暗" : run.luminance > 78 ? "偏亮" : "稳定";
  const tone = run.warmth > 18 ? "偏暖" : run.warmth < -8 ? "偏冷" : "中性";
  return `关键点 ${run.quality}% / 光线${light} / ${tone} / ${gate} / ${version}`;
}

function scoreSummaryText(scores = {}) {
  const entries = Object.entries(validationScoreLabels)
    .filter(([key]) => scores[key] != null && scores[key] !== "")
    .map(([key, label]) => `${label}${scores[key]}`);
  return entries.length ? `评分：${entries.join(" / ")}` : "";
}

function issueSummaryText(issueTags = []) {
  if (!issueTags.length) return "";
  const labels = issueTags.map((tag) => validationIssueLabels[tag] ?? tag);
  return `失败标签：${labels.join(" / ")}`;
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
              <span>${run.lookName} / ${testMetricText(run)}</span>
              ${scoreSummaryText(run.scores) ? `<span>${scoreSummaryText(run.scores)}</span>` : ""}
              ${issueSummaryText(run.issueTags) ? `<span>${issueSummaryText(run.issueTags)}</span>` : ""}
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
  try {
    const history = readFeedbackHistory();
    history.push({
      type,
      label: feedbackLabel(type),
      note: refs.feedbackNoteInput.value.trim(),
      lookId: activeLook.id,
      lookName: activeLook.name,
      recommendationSource: activeRecommendation?.source ?? "preference",
      recommendationConfidence: activeRecommendation?.confidence ?? null,
      preferences: { ...preferenceState },
      signals: feedbackSignals(),
      at: new Date().toISOString(),
    });
    localStorage.setItem(feedbackStorageKey, JSON.stringify(history.slice(-50)));
    refs.feedbackNoteInput.value = "";
  } catch (error) {
    console.warn("Unable to save feedback", error);
  }
}

function readFeedbackHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(feedbackStorageKey) || "[]");
    return Array.isArray(history) ? history : [];
  } catch (error) {
    console.warn("Unable to read feedback", error);
    return [];
  }
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
  try {
    const reviews = JSON.parse(localStorage.getItem(friendReviewStorageKey) || "[]");
    return Array.isArray(reviews) ? reviews : [];
  } catch (error) {
    console.warn("Unable to read friend reviews", error);
    return [];
  }
}

function saveFriendReviews(reviews) {
  try {
    localStorage.setItem(friendReviewStorageKey, JSON.stringify(reviews));
  } catch (error) {
    console.warn("Unable to save friend reviews", error);
  }
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
  refs.friendReviewCount.textContent = `${reviews.length} 条`;
  if (!reviews.length) {
    refs.friendReviewSummary.innerHTML = `<p>还没有朋友试玩总结。完成 5 条后，再根据贴合度、自然度和复用意愿决定是否继续迭代。</p>`;
    return;
  }

  const averageScore = (key) => average(reviews.map((review) => Number(review[key]) || 0)).toFixed(1);
  const describeCounts = (key, labels) =>
    Object.entries(labels)
      .map(([value, label]) => `${label} ${reviews.filter((review) => review[key] === value).length}`)
      .join(" / ");
  const notes = reviews
    .filter((review) => review.note)
    .slice(0, 3)
    .map((review) => `<small>${escapeHtml(String(review.note))}</small>`)
    .join("");

  refs.friendReviewSummary.innerHTML = `
    <article>
      <strong>已收集 ${reviews.length} 条试玩总结</strong>
      <span>推荐贴合度 ${averageScore("fitScore")} / 5；妆效自然度 ${averageScore("naturalnessScore")} / 5</span>
      <small>隐私：${describeCounts("privacyComfort", friendPrivacyComfortLabels)}</small>
      <small>复用：${describeCounts("reuseIntent", friendReuseIntentLabels)}</small>
      ${notes}
    </article>
  `;
}

function readMakeupStepFeedback() {
  try {
    const feedback = JSON.parse(localStorage.getItem(makeupStepFeedbackStorageKey) || "[]");
    return Array.isArray(feedback) ? feedback : [];
  } catch (error) {
    console.warn("Unable to read makeup step feedback", error);
    return [];
  }
}

function saveMakeupStepFeedback(feedback) {
  try {
    localStorage.setItem(makeupStepFeedbackStorageKey, JSON.stringify(feedback.slice(-100)));
  } catch (error) {
    console.warn("Unable to save makeup step feedback", error);
  }
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
      preferences: { ...preferenceState },
      at: new Date().toISOString(),
    });
  }

  saveMakeupStepFeedback(existing);
  refs.feedbackState.textContent = value
    ? `${planStep.category}：${makeupStepFeedbackLabels[value] ?? value}`
    : `${planStep.category}反馈已清除`;
}

function feedbackLabel(type) {
  const labels = {
    like: "喜欢",
    dislike: "不喜欢",
    lighter: "太浓",
    stronger: "太淡",
    "wrong-color": "色不对",
    "wrong-style": "风格不对",
    switch: "换风格",
  };
  return labels[type] ?? "其他";
}

function feedbackSignals() {
  const tone = lastProfileSignals?.faceTone;
  return {
    quality: lastProfileSignals ? Number(lastProfileSignals.quality.toFixed(3)) : null,
    luminance: tone ? Number(tone.luminance.toFixed(3)) : null,
    warmth: tone ? Number(tone.warmth.toFixed(3)) : null,
    mode,
  };
}

function summarizeFeedback(history) {
  if (!history.length) return { total: 0, text: "暂无反馈" };
  const counts = history.reduce((acc, item) => {
    const label = item.label ?? feedbackLabel(item.type);
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});
  const text = Object.entries(counts)
    .map(([label, count]) => `${label} ${count}`)
    .join(" / ");
  return { total: history.length, text };
}

function summarizeExpertReviews(reviews) {
  if (!reviews.length) return { total: 0, text: "暂无专家评审" };
  const counts = reviews.reduce((acc, item) => {
    const label = item.ratingLabel ?? expertRatingLabels[item.rating] ?? "其他";
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});
  const text = Object.entries(counts)
    .map(([label, count]) => `${label} ${count}`)
    .join(" / ");
  return { total: reviews.length, text };
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
  const planStep = (id) => makeupPlan.find((step) => step.id === id)?.recommendation ?? "";
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    intake: { ...preferenceState },
    faceSignals: {
      quality: Number(quality.toFixed(3)),
      luminance: Number((tone.luminance ?? 0.56).toFixed(3)),
      warmth: Number((tone.warmth ?? 0.18).toFixed(3)),
      qualityTier: gate.id,
      notes: lastProfileSignals?.guidance?.summary ? [lastProfileSignals.guidance.summary] : [],
    },
    qualityGate: gate.id,
    recommendation: {
      lookId: activeRecommendation?.lookId ?? activeLook.id,
      lookName: activeRecommendation?.lookName ?? activeLook.name,
      source: activeRecommendation?.source === "face" ? "face_fusion" : "questionnaire",
      confidenceBand: confidenceBand(activeRecommendation?.confidence),
      reason: activeRecommendation?.reason ?? preferenceRecommendationReason(activeLook, buildPreferenceProfile()),
      caveat: gate.id === "good_for_tryon" ? "" : gate.label,
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
        budgetTier: preferenceState.budget,
      })),
    },
    validation: {
      sampleLabel: sampleScenarios[activeSampleScenario],
      renderVersion,
      issueTags: selectedValidationIssues(),
      scores: selectedValidationScores(),
      reviewNote: refs.testNoteInput.value.trim(),
    },
    makeupStepFeedback: readMakeupStepFeedback().map((item) => ({
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

function confidenceBand(confidence) {
  if (confidence >= 84) return "high";
  if (confidence >= 70) return "medium";
  return "low";
}

function buildLocalDataExport() {
  const profile = buildPreferenceProfile();
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    privacy: {
      includesImages: false,
      includesVideoFrames: false,
      source: "browser-local-summary",
    },
    validationMode: {
      renderVersion,
      qualityGate: currentQualityGate(),
      recommendationSchema: "schemas/recommendation-result.schema.json",
    },
    preferences: { ...preferenceState, labels: profile.labels },
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
    recommendation: activeRecommendation,
    recommendationResult: buildRecommendationResultExport(),
    stylePlan: currentStyleItems().map(([title, body]) => ({ title, body })),
    products: currentProducts(),
    testRuns: readTestRuns(),
    feedback: readFeedbackHistory(),
    friendReviews: readFriendReviews(),
    makeupStepFeedback: readMakeupStepFeedback(),
    expertReviews: readExpertReviews(),
  };
}

function exportReviewCsv() {
  const csv = toCsv(buildReviewCsvRows());
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  if (refs.csvDownloadLink.href) URL.revokeObjectURL(refs.csvDownloadLink.href);
  refs.csvDownloadLink.href = URL.createObjectURL(blob);
  refs.csvDownloadLink.classList.add("ready");
  refs.feedbackState.textContent = "评审 CSV 已准备";
}

function buildReviewCsvRows() {
  const feedbackRows = readFeedbackHistory().map((item) => ({
    recordType: "user_feedback",
    recordId: "",
    createdAt: item.at,
    label: item.label ?? feedbackLabel(item.type),
    sampleLabel: "",
    lookName: item.lookName,
    recommendationSource: item.recommendationSource,
    recommendationConfidence: item.recommendationConfidence,
    occasion: item.preferences?.occasion,
    goal: item.preferences?.goal,
    finish: item.preferences?.finish,
    budget: item.preferences?.budget,
    existingMakeup: item.preferences?.existingMakeup,
    baseCoverage: item.preferences?.baseCoverage,
    browStyle: item.preferences?.browStyle,
    eyeFocus: item.preferences?.eyeFocus,
    lipTexture: item.preferences?.lipTexture,
    qualityPercent: signalPercent(item.signals?.quality),
    luminancePercent: signalPercent(item.signals?.luminance),
    warmthPercent: signalPercent(item.signals?.warmth),
    note: item.note ?? "",
    privacy: "no_image_or_video_frame",
  }));

  const testRows = readTestRuns().map((run) => ({
    recordType: "photo_test",
    recordId: run.id,
    createdAt: run.at,
    label: "测试记录",
    sampleLabel: run.sampleLabel,
    lookName: run.lookName,
    recommendationSource: run.source,
    recommendationConfidence: run.recommendationConfidence ?? "",
    occasion: run.preferences?.occasion ?? "",
    goal: run.preferences?.goal ?? "",
    finish: run.preferences?.finish ?? "",
    budget: run.preferences?.budget ?? "",
    existingMakeup: run.preferences?.existingMakeup ?? "",
    baseCoverage: run.preferences?.baseCoverage ?? "",
    browStyle: run.preferences?.browStyle ?? "",
    eyeFocus: run.preferences?.eyeFocus ?? "",
    lipTexture: run.preferences?.lipTexture ?? "",
    qualityPercent: run.quality ?? "",
    luminancePercent: run.luminance ?? "",
    warmthPercent: run.warmth ?? "",
    qualityGate: run.qualityGate ?? "",
    renderVersion: run.renderVersion ?? "",
    issueTags: (run.issueTags ?? []).join(";"),
    landmarkStabilityScore: run.scores?.landmarkStability ?? "",
    lipEdgeScore: run.scores?.lipEdge ?? "",
    blushPlacementScore: run.scores?.blushPlacement ?? "",
    eyeshadowAlignmentScore: run.scores?.eyeshadowAlignment ?? "",
    colorVisibilityScore: run.scores?.colorVisibility ?? "",
    recommendationTasteScore: run.scores?.recommendationTaste ?? "",
    explanationTrustScore: run.scores?.explanationTrust ?? "",
    note: run.note,
    privacy: "no_image_or_video_frame",
  }));

  const makeupStepFeedbackRows = readMakeupStepFeedback().map((item) => ({
    recordType: "makeup_step_feedback",
    recordId: item.id,
    createdAt: item.at,
    label: item.label,
    makeupStepId: item.stepId,
    makeupStepFeedback: item.value,
    sampleLabel: "",
    lookName: item.lookName,
    occasion: item.preferences?.occasion,
    goal: item.preferences?.goal,
    finish: item.preferences?.finish,
    budget: item.preferences?.budget,
    existingMakeup: item.preferences?.existingMakeup,
    baseCoverage: item.preferences?.baseCoverage,
    browStyle: item.preferences?.browStyle,
    eyeFocus: item.preferences?.eyeFocus,
    lipTexture: item.preferences?.lipTexture,
    note: item.stepLabel,
    privacy: "no_image_or_video_frame",
  }));

  const friendReviewRows = readFriendReviews().map((review) => ({
    recordType: "friend_review",
    recordId: review.id,
    createdAt: review.at,
    label: "friend_test_summary",
    lookName: review.lookName,
    recommendationSource: review.recommendationSource,
    recommendationConfidence: review.recommendationConfidence,
    occasion: review.preferences?.occasion,
    goal: review.preferences?.goal,
    finish: review.preferences?.finish,
    budget: review.preferences?.budget,
    existingMakeup: review.preferences?.existingMakeup,
    baseCoverage: review.preferences?.baseCoverage,
    browStyle: review.preferences?.browStyle,
    eyeFocus: review.preferences?.eyeFocus,
    lipTexture: review.preferences?.lipTexture,
    qualityPercent: signalPercent(review.signals?.quality),
    luminancePercent: signalPercent(review.signals?.luminance),
    warmthPercent: signalPercent(review.signals?.warmth),
    privacyComfort: review.privacyComfort,
    fitScore: review.fitScore,
    naturalnessScore: review.naturalnessScore,
    reuseIntent: review.reuseIntent,
    note: review.note,
    privacy: "no_image_or_video_frame",
  }));

  const expertRows = readExpertReviews().map((review) => ({
    recordType: "expert_review",
    recordId: review.id,
    createdAt: review.at,
    label: review.ratingLabel ?? expertRatingLabels[review.rating],
    sampleLabel: review.sampleLabel,
    lookName: review.lookName,
    recommendationSource: review.recommendationSource,
    recommendationConfidence: review.recommendationConfidence,
    occasion: review.preferences?.occasion,
    goal: review.preferences?.goal,
    finish: review.preferences?.finish,
    budget: review.preferences?.budget,
    existingMakeup: review.preferences?.existingMakeup,
    baseCoverage: review.preferences?.baseCoverage,
    browStyle: review.preferences?.browStyle,
    eyeFocus: review.preferences?.eyeFocus,
    lipTexture: review.preferences?.lipTexture,
    qualityPercent: signalPercent(review.signals?.quality),
    luminancePercent: signalPercent(review.signals?.luminance),
    warmthPercent: signalPercent(review.signals?.warmth),
    note: review.note,
    privacy: "no_image_or_video_frame",
  }));

  return [...testRows, ...feedbackRows, ...makeupStepFeedbackRows, ...friendReviewRows, ...expertRows].sort((a, b) =>
    String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
  );
}

function signalPercent(value) {
  if (value == null || value === "") return "";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : "";
}

function toCsv(rows) {
  const columns = [
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
    ["blushPlacementScore", "blush_placement_score"],
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
  ];
  const header = columns.map(([, label]) => csvCell(label)).join(",");
  const body = rows.map((row) => columns.map(([key]) => csvCell(row[key])).join(","));
  return [header, ...body].join("\r\n");
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
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
  if (mode === "photo") drawPhotoFrame();
}

function switchToAlternativeLook() {
  const profile = buildPreferenceProfile();
  const candidates = looks
    .filter((look) => look.id !== activeLook.id)
    .map((look) => ({ look, score: preferenceScore(look, profile) }))
    .sort((a, b) => b.score - a.score);
  if (candidates[0]) setLook(candidates[0].look);
}

function budgetHint(budget) {
  const hints = {
    starter: "产品清单会优先给平价同色系替代",
    balanced: "产品清单会优先给开架与中端的均衡组合",
    premium: "产品清单可以加入更高质感的进阶单品",
    sensitive: "产品清单会优先避开高刺激、高香精表达",
  };
  return hints[budget] ?? hints.starter;
}

function restorePreferenceState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!saved || typeof saved !== "object") return;
    for (const key of Object.keys(preferenceState)) {
      if (preferencePresets[key]?.[saved[key]]) preferenceState[key] = saved[key];
    }
    syncPreferenceInputs();
  } catch (error) {
    console.warn("Unable to restore preferences", error);
  }
}

function savePreferenceState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(preferenceState));
  } catch (error) {
    console.warn("Unable to save preferences", error);
  }
}

function syncPreferenceInputs() {
  refs.preferenceInputs.forEach((input) => {
    input.checked = preferenceState[input.dataset.pref] === input.value;
  });
}

function clearLocalData() {
  try {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(feedbackStorageKey);
    localStorage.removeItem(makeupStepFeedbackStorageKey);
    localStorage.removeItem(testRunStorageKey);
    localStorage.removeItem(expertReviewStorageKey);
    localStorage.removeItem(friendReviewStorageKey);
  } catch (error) {
    console.warn("Unable to clear preferences", error);
  }

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
  const selected = [
    preferencePresets.occasion[preferenceState.occasion],
    preferencePresets.goal[preferenceState.goal],
    preferencePresets.finish[preferenceState.finish],
    preferencePresets.budget[preferenceState.budget],
  ];
  const detailSelected = [
    preferencePresets.baseCoverage[preferenceState.baseCoverage],
    preferencePresets.browStyle[preferenceState.browStyle],
    preferencePresets.eyeFocus[preferenceState.eyeFocus],
    preferencePresets.lipTexture[preferenceState.lipTexture],
  ];
  const existingMakeup = preferencePresets.existingMakeup[preferenceState.existingMakeup] ?? preferencePresets.existingMakeup.bare;
  const moods = [...selected, ...detailSelected].flatMap((item) => item.moods);
  const blendedValue = (key) => average(selected.map((item) => item[key])) * 0.65 + average(detailSelected.map((item) => item[key])) * 0.35;
  return {
    labels: selected.map((item) => item.label),
    detailLabels: detailSelected.map((item) => item.label),
    finish: preferenceState.finish,
    existingMakeup: preferenceState.existingMakeup,
    existingMakeupLabel: existingMakeup.label,
    visibilityFloor: existingMakeup.visibilityFloor,
    options: {
      baseCoverage: preferenceState.baseCoverage,
      browStyle: preferenceState.browStyle,
      eyeFocus: preferenceState.eyeFocus,
      lipTexture: preferenceState.lipTexture,
    },
    moods,
    intensity: blendedValue("intensity"),
    warmth: blendedValue("warmth"),
    clarity: blendedValue("clarity"),
    light: blendedValue("light"),
  };
}

function preferenceScore(look, preferenceProfile) {
  const profile = look.profile;
  const moodScore = preferenceProfile.moods.includes(profile.mood) ? 1 : 0.42;
  return clamp(
    similarity(profile.intensity, preferenceProfile.intensity, 0.48) * 0.28 +
      similarity(profile.warmth, preferenceProfile.warmth, 0.66) * 0.2 +
      similarity(profile.clarity, preferenceProfile.clarity, 0.54) * 0.2 +
      similarity(profile.light, preferenceProfile.light, 0.52) * 0.14 +
      moodScore * 0.18,
    0,
    1
  );
}

function preferenceChips(preferenceProfile) {
  return [
    `场景 ${preferenceProfile.labels[0]}`,
    `目标 ${preferenceProfile.labels[1]}`,
    `妆感 ${preferenceProfile.labels[2]}`,
    `预算 ${preferenceProfile.labels[3]}`,
    `原照 ${preferenceProfile.existingMakeupLabel}`,
    preferenceProfile.intensity > 0.5 ? "偏显色" : preferenceProfile.intensity < 0.34 ? "低负担" : "中等显色",
  ];
}

function recommendationChips({ quality, luminance, warmth, mouthOpen, desiredIntensity, pose, gate }, preferenceProfile) {
  return [
    `目标 ${preferenceProfile.labels[1]}`,
    lightLabel(luminance),
    toneLabel(warmth),
    guidanceForFace(quality, { luminance }, pose).label,
    gate.id === "retake_recommended" || gate.id === "cannot_analyze"
      ? "暂停应用推荐"
      : mouthOpen > 0.28
        ? "暂停唇部覆盖"
        : mouthOpen > 0.1
          ? "唇部保守预览"
          : preferenceProfile.existingMakeup === "visible"
            ? "提高预览对比度"
            : desiredIntensity > 0.48
              ? "提升气色"
              : "低负担妆效",
  ];
}

function preferenceRecommendationReason(look, preferenceProfile) {
  const [occasion, goal, finish, budget] = preferenceProfile.labels;
  const makeupText = preferenceProfile.existingMakeup === "visible" ? "原照片已有明显妆容，后续预览会优先保留可辨认的对比度" : preferenceProfile.existingMakeup === "light" ? "原照片带有淡妆，后续会避免颜色被原妆完全吃掉" : "原照片按素颜处理";
  return `你选择了${occasion}、${goal}、${finish}和${budget}预算，系统先按目标筛出 ${look.name}。${makeupText}。开启摄像头或上传照片后，会继续结合角度、画面条件和肤色采样修正推荐。`;
}

function recommendationReason(look, signals, preferenceProfile) {
  const [occasion, goal, finish, budget] = preferenceProfile.labels;
  const lightText = lightReason(signals.luminance);
  const toneText = toneReason(signals.warmth);
  const fitText = fitReason(signals);
  const makeupText = preferenceProfile.existingMakeup === "visible" ? "你标记了原照片已有明显妆容，因此系统会优先使用更容易区分的颜色和强度" : preferenceProfile.existingMakeup === "light" ? "你标记了原照片带淡妆，预览会保留额外色差" : "原照片按素颜处理";
  const intensityText =
    signals.desiredIntensity > 0.5
      ? "可以保留一点显色度来提气色"
      : signals.desiredIntensity < 0.34
        ? "妆感会压低对比度，避免显得厚重"
        : "整体强度控制在日常可穿的中间值";
  return `你选择的是${occasion}、${goal}、${finish}和${budget}预算；脸部分析显示${lightLabel(signals.luminance)}、${toneLabel(signals.warmth)}、${guidanceForFace(signals.quality, { luminance: signals.luminance }, signals.pose).label}。${makeupText}。因此推荐 ${look.name}：${lightText}，${toneText}，${intensityText}。${fitText}`;
}

function guidanceForFace(quality, faceTone = neutralTone(), pose = {}) {
  if ((pose.mouthOpen ?? 0) > 0.28) {
    return {
      label: "张嘴需重拍",
      tone: "warn",
      summary: "嘴部动作会让唇部覆盖失真",
      message: "检测到张嘴幅度较大。已暂停唇部覆盖，请闭合双唇后重新拍摄或继续测试。",
    };
  }
  if ((pose.mouthOpen ?? 0) > 0.12) {
    return {
      label: "张嘴需重拍",
      tone: "warn",
      summary: "嘴部动作会降低唇部预览可信度",
      message: "检测到轻中度张嘴。系统保留低强度的安全部分预览并避开内唇区域；请闭合双唇后再确认最终唇线。",
    };
  }
  if ((pose.yaw ?? 0) > 0.32) {
    return {
      label: "侧脸需重拍",
      tone: "warn",
      summary: "侧脸会影响遮挡和透视",
      message: "检测到侧脸角度较大。系统只保留可见侧妆效，并暂停高置信度推荐。请转向镜头后重拍。",
    };
  }
  if ((pose.yaw ?? 0) > 0.16) {
    return {
      label: "侧脸需重拍",
      tone: "warn",
      summary: "侧转会降低远侧妆效可信度",
      message: "检测到轻中度侧转。系统保留双侧预览，但会降低远侧妆效强度并暂停高置信度推荐；请转向镜头后再确认位置。",
    };
  }
  if (faceTone?.luminance < 0.26 || faceTone?.luminance > 0.9) {
    return {
      label: "画面亮度待确认",
      tone: "warn",
      summary: "亮度不会直接决定肤色或妆效可信度",
      message: "画面亮度偏离常见范围。系统保留显色补偿，不会把肤色亮度直接当作低质量；请人工确认预览是否清晰。",
    };
  }
  if (quality >= 0.72) {
    return {
      label: "贴合良好",
      tone: "ok",
      summary: "关键点贴合良好",
      message: "识别稳定。可以应用推荐、调整强度，或记录当前样本。",
    };
  }
  if (quality >= 0.48) {
    return {
      label: "轻微降噪",
      tone: "warn",
      summary: "关键点可用，边缘会轻微柔化",
      message: "已识别但贴合一般。请让脸更靠近画面中央，妆效会轻微柔化边缘。",
    };
  }
  return {
    label: "角度偏大",
    tone: "warn",
    summary: "角度或距离影响贴合，推荐会更保守",
    message: "角度或距离影响贴合。请面向镜头，让脸部占画面约三分之一。",
  };
}

function currentQualityGate() {
  return qualityGateFromSignals(lastProfileSignals);
}

function lightLabel(luminance) {
  if (luminance < 0.34) return "光线偏暗";
  if (luminance > 0.78) return "光线偏亮";
  return "光线稳定";
}

function toneLabel(warmth) {
  if (warmth > 0.18) return "画面偏暖";
  if (warmth < -0.08) return "画面偏冷";
  return "中性光感";
}

function lightReason(luminance) {
  if (luminance < 0.34) return "当前画面亮度偏低，系统会保留显色补偿；请以预览可见度而不是肤色亮度判断是否需要重拍";
  if (luminance > 0.78) return "当前画面偏亮，需要稍有存在感的颜色，避免妆效被吃掉";
  return "当前光线稳定，可以保留自然肤感和清晰边界";
}

function toneReason(warmth) {
  if (warmth > 0.18) return "画面偏暖，蜜桃、珊瑚或柔玫瑰会更自然地提气色";
  if (warmth < -0.08) return "画面偏冷，豆沙、梅子或灰调玫瑰能减少突兀感";
  return "光感接近中性，冷暖色都有空间，优先跟随你选择的场景目标";
}

function fitReason(signals) {
  if ((signals.mouthOpen ?? 0) > 0.28) return "嘴部动作较大，系统已暂停唇部覆盖，避免欠填或轮廓变形。";
  if ((signals.pose?.yaw ?? 0) > 0.32) return "侧脸角度较大，系统不会继续渲染远侧妆效，也不会给出高置信度推荐。";
  if ((signals.mouthOpen ?? 0) > 0.12) return "嘴部存在轻中度动作，系统仅保留避开内唇区域的低强度部分预览；最终唇线需要闭嘴重拍后确认。";
  if ((signals.pose?.yaw ?? 0) > 0.16) return "画面存在轻中度侧转，系统会保留双侧预览并降低远侧强度，同时压低推荐置信度。";
  if (signals.quality < 0.48) return "当前贴合质量一般，所以系统会选择边界更柔和、强度更保守的方案。";
  if ((signals.mouthOpen ?? 0) > 0.08) return "嘴部存在轻微动作，系统会降低唇部重量，减少压唇线的问题。";
  return "当前关键点稳定，可以保留唇、腮红和眼影的细节。";
}

function similarity(value, target, range) {
  return clamp(1 - Math.abs(value - target) / range, 0, 1);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function escapeHtml(value) {
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

function drawClosedPath(points) {
  drawClosedPathOn(ctx, points);
}

function drawClosedPathOn(targetCtx, points) {
  if (!points.length) return;
  targetCtx.beginPath();
  targetCtx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    targetCtx.lineTo(points[index].x, points[index].y);
  }
  targetCtx.closePath();
}

function drawOpenPath(points) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index].x, points[index].y);
  }
}

function drawBlushCloud(x, y, radiusX, radiusY, rotation, color, intensity) {
  const lobes = [
    { x: -0.18, y: -0.04, radiusX: 0.82, radiusY: 0.9, intensity: 0.54 },
    { x: 0.08, y: 0.02, radiusX: 1, radiusY: 1, intensity: 0.68 },
    { x: 0.34, y: 0.08, radiusX: 0.68, radiusY: 0.82, intensity: 0.42 },
  ];
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  for (const lobe of lobes) {
    const localX = radiusX * lobe.x;
    const localY = radiusY * lobe.y;
    drawSoftEllipse(
      x + localX * cos - localY * sin,
      y + localX * sin + localY * cos,
      radiusX * lobe.radiusX,
      radiusY * lobe.radiusY,
      rotation,
      color,
      intensity * lobe.intensity
    );
  }
}

function drawSoftEllipse(x, y, radiusX, radiusY, rotation, color, intensity) {
  if (radiusX <= 0 || radiusY <= 0 || intensity <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(radiusX, radiusY);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, colorWithAlpha(color, intensity * 0.42));
  gradient.addColorStop(0.34, colorWithAlpha(color, intensity * 0.31));
  gradient.addColorStop(0.68, colorWithAlpha(color, intensity * 0.105));
  gradient.addColorStop(0.9, colorWithAlpha(color, intensity * 0.024));
  gradient.addColorStop(1, colorWithAlpha(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFeatheredFill({ paths, erasePaths = [], color, blur, eraseBlur = blur, composite }) {
  ensureMakeupLayer();
  makeupLayerCtx.clearRect(0, 0, makeupLayer.width, makeupLayer.height);

  makeupLayerCtx.save();
  makeupLayerCtx.fillStyle = color;
  makeupLayerCtx.filter = `blur(${blur}px)`;
  for (const path of paths) {
    drawClosedPathOn(makeupLayerCtx, path);
    makeupLayerCtx.fill();
  }

  if (erasePaths.length) {
    makeupLayerCtx.globalCompositeOperation = "destination-out";
    makeupLayerCtx.fillStyle = "rgba(0, 0, 0, 1)";
    makeupLayerCtx.filter = `blur(${eraseBlur}px)`;
    for (const path of erasePaths) {
      drawClosedPathOn(makeupLayerCtx, path);
      makeupLayerCtx.fill();
    }
  }
  makeupLayerCtx.restore();

  ctx.save();
  ctx.globalCompositeOperation = composite;
  ctx.drawImage(makeupLayer, 0, 0);
  ctx.restore();
}

function ensureMakeupLayer() {
  if (makeupLayer.width !== refs.canvas.width || makeupLayer.height !== refs.canvas.height) {
    makeupLayer.width = refs.canvas.width;
    makeupLayer.height = refs.canvas.height;
  }
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

function assessCheekReliability(center, radiusX, radiusY, rotation) {
  const stats = sampleEllipseStats(center, radiusX * 0.86, radiusY * 0.92, rotation);
  if (stats.count < 48) {
    return {
      reliable: false,
      reliability: 0,
      edgeEnergy: stats.edgeEnergy,
      luminanceStd: stats.luminanceStd,
      sampleCount: stats.count,
    };
  }

  const edgeRisk = clamp(mapRange(stats.edgeEnergy, 0.035, 0.13, 0, 1), 0, 1);
  const varianceRisk = clamp(mapRange(stats.luminanceStd, 0.07, 0.23, 0, 1), 0, 1);
  const reliability = clamp(1 - edgeRisk * 0.68 - varianceRisk * 0.32, 0, 1);
  const uncertain = stats.edgeEnergy > 0.14 || (stats.edgeEnergy > 0.085 && stats.luminanceStd > 0.115) || reliability < 0.34;
  return {
    reliable: !uncertain,
    reliability: Number(reliability.toFixed(3)),
    edgeEnergy: Number(stats.edgeEnergy.toFixed(3)),
    luminanceStd: Number(stats.luminanceStd.toFixed(3)),
    sampleCount: stats.count,
  };
}

function sampleEllipseStats(center, radiusX, radiusY, rotation) {
  if (refs.canvas.width <= 1 || refs.canvas.height <= 1) {
    return { count: 0, edgeEnergy: 1, luminanceStd: 1 };
  }

  const padding = Math.max(radiusX, radiusY) * 1.08;
  const bounds = getBounds([center], padding);
  try {
    const pixels = ctx.getImageData(bounds.x, bounds.y, bounds.width, bounds.height).data;
    const step = Math.max(1, Math.floor(Math.sqrt((bounds.width * bounds.height) / 900)));
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    let luminanceSum = 0;
    let luminanceSquaredSum = 0;
    let edgeSum = 0;
    let edgeCount = 0;
    let count = 0;

    const luminanceAt = (x, y) => {
      const offset = (y * bounds.width + x) * 4;
      return (0.2126 * pixels[offset] + 0.7152 * pixels[offset + 1] + 0.0722 * pixels[offset + 2]) / 255;
    };
    const inside = (canvasX, canvasY) => {
      const dx = canvasX - center.x;
      const dy = canvasY - center.y;
      const localX = (dx * cos + dy * sin) / Math.max(radiusX, 1);
      const localY = (-dx * sin + dy * cos) / Math.max(radiusY, 1);
      return localX * localX + localY * localY <= 1;
    };

    for (let y = 0; y < bounds.height; y += step) {
      for (let x = 0; x < bounds.width; x += step) {
        const canvasX = bounds.x + x;
        const canvasY = bounds.y + y;
        if (!inside(canvasX, canvasY)) continue;
        const luminance = luminanceAt(x, y);
        luminanceSum += luminance;
        luminanceSquaredSum += luminance * luminance;
        count += 1;

        const rightX = x + step;
        const downY = y + step;
        if (rightX < bounds.width && inside(bounds.x + rightX, canvasY)) {
          edgeSum += Math.abs(luminance - luminanceAt(rightX, y));
          edgeCount += 1;
        }
        if (downY < bounds.height && inside(canvasX, bounds.y + downY)) {
          edgeSum += Math.abs(luminance - luminanceAt(x, downY));
          edgeCount += 1;
        }
      }
    }

    const mean = count ? luminanceSum / count : 0;
    return {
      count,
      edgeEnergy: edgeCount ? edgeSum / edgeCount : 1,
      luminanceStd: count ? Math.sqrt(Math.max(0, luminanceSquaredSum / count - mean * mean)) : 1,
    };
  } catch (error) {
    return { count: 0, edgeEnergy: 1, luminanceStd: 1 };
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

function neutralTone() {
  return { r: 168, g: 136, b: 124, luminance: 0.56, warmth: 0.18 };
}

function makeupVisibilityMultiplier(tone) {
  const luminance = tone?.luminance ?? 0.56;
  const darkContrastBoost = clamp(mapRange(luminance, 0.18, 0.46, 1.28, 1.06), 1.06, 1.28);
  const brightContrastBoost = clamp(mapRange(luminance, 0.76, 0.95, 1, 1.1), 1, 1.1);
  const existingMakeupBoost = {
    bare: 1,
    light: 1.08,
    visible: 1.18,
  }[preferenceState.existingMakeup] ?? 1;
  return darkContrastBoost * brightContrastBoost * existingMakeupBoost;
}

function adaptEyeShadowColor(hex, tone, warmSafe) {
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

function adaptMakeupColor(hex, tone, options = {}) {
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

function ensureColorContrast(color, tone, minimumContrast) {
  const toneLuminance = tone?.luminance ?? 0.56;
  const colorLuminance = (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255;
  if (Math.abs(colorLuminance - toneLuminance) >= minimumContrast) return color;

  const targetLuminance = toneLuminance < 0.46
    ? Math.min(0.93, toneLuminance + minimumContrast)
    : Math.max(0.07, toneLuminance - minimumContrast);
  const scale = targetLuminance / Math.max(colorLuminance, 0.05);
  return {
    r: clamp(color.r * scale, 0, 255),
    g: clamp(color.g * scale, 0, 255),
    b: clamp(color.b * scale, 0, 255),
  };
}

function eyeLidShadowPath(indices, landmarks, mirrored, lift) {
  const lid = indices.map((index) => point(landmarks[index], mirrored));
  const raised = lid.map((p) => raise(p, -lift));
  return [...raised, ...lid.slice().reverse()];
}

function point(landmark, mirrored) {
  const x = (mirrored ? 1 - landmark.x : landmark.x) * refs.canvas.width;
  const y = landmark.y * refs.canvas.height;
  return { x, y };
}

function mixPoints(a, b, amount) {
  const weight = clamp(amount, 0, 1);
  return {
    x: a.x * (1 - weight) + b.x * weight,
    y: a.y * (1 - weight) + b.y * weight,
  };
}

function movePoint(source, offset) {
  return { x: source.x + offset.x, y: source.y + offset.y };
}

function raise(p, amount) {
  return { x: p.x, y: p.y + amount };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleBetween(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function mapRange(value, inMin, inMax, outMin, outMax) {
  const progress = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return outMin + (outMax - outMin) * progress;
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

function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return rgbaFromRgb({ r, g, b }, alpha);
}

function colorWithAlpha(color, alpha) {
  return typeof color === "string" ? withAlpha(color, alpha) : rgbaFromRgb(color, alpha);
}

function rgbaFromRgb(rgb, alpha) {
  const r = Math.round(clamp(rgb.r, 0, 255));
  const g = Math.round(clamp(rgb.g, 0, 255));
  const b = Math.round(clamp(rgb.b, 0, 255));
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

function mixRgb(a, b, amount) {
  const weight = clamp(amount, 0, 1);
  return {
    r: a.r * (1 - weight) + b.r * weight,
    g: a.g * (1 - weight) + b.g * weight,
    b: a.b * (1 - weight) + b.b * weight,
  };
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function lightenHex(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (channel) => Math.round(channel + (255 - channel) * amount);
  return rgbToHex(mix(r), mix(g), mix(b));
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((channel) => Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, "0"))
    .join("")}`;
}

function stopLoop() {
  running = false;
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
