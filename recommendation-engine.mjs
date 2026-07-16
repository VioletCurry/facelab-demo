import { average, clamp, mapRange, similarity } from "./render/geometry.mjs";

export const PREFERENCE_PRESETS = {
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

export function buildPreferenceProfile({ preferences, presets }) {
  const selected = [
    presets.occasion[preferences.occasion],
    presets.goal[preferences.goal],
    presets.finish[preferences.finish],
    presets.budget[preferences.budget],
  ];
  const detailSelected = [
    presets.baseCoverage[preferences.baseCoverage],
    presets.browStyle[preferences.browStyle],
    presets.eyeFocus[preferences.eyeFocus],
    presets.lipTexture[preferences.lipTexture],
  ];
  const existingMakeup = presets.existingMakeup[preferences.existingMakeup] ?? presets.existingMakeup.bare;
  const blendedValue = (key) =>
    average(selected.map((item) => item[key])) * 0.65 + average(detailSelected.map((item) => item[key])) * 0.35;

  return {
    labels: selected.map((item) => item.label),
    detailLabels: detailSelected.map((item) => item.label),
    finish: preferences.finish,
    existingMakeup: preferences.existingMakeup,
    existingMakeupLabel: existingMakeup.label,
    visibilityFloor: existingMakeup.visibilityFloor,
    options: {
      baseCoverage: preferences.baseCoverage,
      browStyle: preferences.browStyle,
      eyeFocus: preferences.eyeFocus,
      lipTexture: preferences.lipTexture,
    },
    moods: [...selected, ...detailSelected].flatMap((item) => item.moods),
    intensity: blendedValue("intensity"),
    warmth: blendedValue("warmth"),
    clarity: blendedValue("clarity"),
    light: blendedValue("light"),
  };
}

export function preferenceScore(look, preferenceProfile) {
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

export function rankLooksByPreference({ looks, preferenceProfile, excludeLookId = null }) {
  return looks
    .filter((look) => look.id !== excludeLookId)
    .map((look) => ({ look, score: preferenceScore(look, preferenceProfile) }))
    .sort((a, b) => b.score - a.score);
}

export function recommendFromPreferences({ looks, preferenceProfile }) {
  const best = rankLooksByPreference({ looks, preferenceProfile })[0];
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

export function desiredFaceProfile({ quality, luminance, warmth, mouthOpen, faceWidth, visibilityFloor }) {
  return {
    intensity: clamp(
      (quality < 0.5 ? 0.34 : 0.44) +
        (luminance > 0.78 ? 0.05 : 0) +
        (visibilityFloor - 0.4) -
        clamp(mouthOpen, 0, 0.18) * 0.18,
      0.32,
      0.68
    ),
    warmth: clamp(warmth * 1.15, -0.26, 0.38),
    light: clamp(luminance, 0.34, 0.76),
    clarity: clamp(quality < 0.52 ? 0.86 : 0.6 + mapRange(faceWidth, 120, 420, 0.08, -0.08), 0.48, 0.92),
  };
}

export function faceRecommendationScore({ look, preferenceProfile, quality, luminance, warmth, mouthOpen, desiredProfile }) {
  const profile = look.profile;
  const faceScore =
    similarity(profile.intensity, desiredProfile.intensity, 0.42) * 0.32 +
    similarity(profile.warmth, desiredProfile.warmth, 0.62) * 0.24 +
    similarity(profile.light, desiredProfile.light, 0.5) * 0.2 +
    similarity(profile.clarity, desiredProfile.clarity, 0.5) * 0.24;
  const intentScore = preferenceScore(look, preferenceProfile);
  let score = faceScore * 0.58 + intentScore * 0.42;

  if (quality < 0.48 && profile.intensity > 0.5) score -= 0.12;
  if (luminance > 0.78 && profile.intensity < 0.34) score -= 0.07;
  if (mouthOpen > 0.1 && look.lipIntensity > 0.68) score -= 0.08;
  if (preferenceProfile.existingMakeup === "visible" && profile.intensity < 0.42) score -= 0.12;
  if (warmth > 0.2 && profile.warmth > 0.2) score += 0.04;
  if (warmth < -0.08 && profile.warmth < -0.08) score += 0.04;

  return clamp(score, 0, 1);
}

export function rankLooksByFaceSignals({ looks, preferenceProfile, quality, luminance, warmth, mouthOpen, faceWidth }) {
  const desiredProfile = desiredFaceProfile({
    quality,
    luminance,
    warmth,
    mouthOpen,
    faceWidth,
    visibilityFloor: preferenceProfile.visibilityFloor,
  });
  const ranked = looks
    .map((look) => ({
      look,
      score: faceRecommendationScore({
        look,
        preferenceProfile,
        quality,
        luminance,
        warmth,
        mouthOpen,
        desiredProfile,
      }),
    }))
    .sort((a, b) => b.score - a.score);

  return { desiredProfile, ranked };
}

export function recommendFromFaceSignals({ looks, preferenceProfile, quality, faceTone, pose, faceWidth, gate, confidenceCap }) {
  const mouthOpen = pose.mouthOpen;
  const luminance = faceTone?.luminance ?? 0.56;
  const warmth = clamp(faceTone?.warmth ?? 0.12, -0.35, 0.45);
  const { desiredProfile, ranked } = rankLooksByFaceSignals({
    looks,
    preferenceProfile,
    quality,
    luminance,
    warmth,
    mouthOpen,
    faceWidth,
  });
  const best = ranked[0];
  const confidence = Math.round(mapRange(best.score, 0.42, 0.92, 62, 96));
  const signals = {
    quality,
    luminance,
    warmth,
    mouthOpen,
    desiredIntensity: desiredProfile.intensity,
    pose,
    gate,
  };

  return {
    lookId: best.look.id,
    lookName: best.look.name,
    confidence: clamp(Math.min(confidence, confidenceCap), 0, 98),
    canApply: gate.id === "good_for_tryon" || gate.id === "usable_but_unstable",
    caveat: gate.id === "good_for_tryon" ? "" : gate.label,
    chips: recommendationChips(signals, preferenceProfile),
    source: "face",
    reason: recommendationReason(best.look, signals, preferenceProfile),
  };
}

export function preferenceChips(preferenceProfile) {
  return [
    `场景 ${preferenceProfile.labels[0]}`,
    `目标 ${preferenceProfile.labels[1]}`,
    `妆感 ${preferenceProfile.labels[2]}`,
    `预算 ${preferenceProfile.labels[3]}`,
    `原照 ${preferenceProfile.existingMakeupLabel}`,
    preferenceProfile.intensity > 0.5 ? "偏显色" : preferenceProfile.intensity < 0.34 ? "低负担" : "中等显色",
  ];
}

export function recommendationChips({ quality, luminance, warmth, mouthOpen, desiredIntensity, pose, gate }, preferenceProfile) {
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

export function preferenceRecommendationReason(look, preferenceProfile) {
  const [occasion, goal, finish, budget] = preferenceProfile.labels;
  const makeupText =
    preferenceProfile.existingMakeup === "visible"
      ? "原照片已有明显妆容，后续预览会优先保留可辨认的对比度"
      : preferenceProfile.existingMakeup === "light"
        ? "原照片带有淡妆，后续会避免颜色被原妆完全吃掉"
        : "原照片按素颜处理";
  return `你选择了${occasion}、${goal}、${finish}和${budget}预算，系统先按目标筛出 ${look.name}。${makeupText}。开启摄像头或上传照片后，会继续结合角度、画面条件和肤色采样修正推荐。`;
}

export function recommendationReason(look, signals, preferenceProfile) {
  const [occasion, goal, finish, budget] = preferenceProfile.labels;
  const makeupText =
    preferenceProfile.existingMakeup === "visible"
      ? "你标记了原照片已有明显妆容，因此系统会优先使用更容易区分的颜色和强度"
      : preferenceProfile.existingMakeup === "light"
        ? "你标记了原照片带淡妆，预览会保留额外色差"
        : "原照片按素颜处理";
  const intensityText =
    signals.desiredIntensity > 0.5
      ? "可以保留一点显色度来提气色"
      : signals.desiredIntensity < 0.34
        ? "妆感会压低对比度，避免显得厚重"
        : "整体强度控制在日常可穿的中间值";
  return `你选择的是${occasion}、${goal}、${finish}和${budget}预算；脸部分析显示${lightLabel(signals.luminance)}、${toneLabel(signals.warmth)}、${guidanceForFace(signals.quality, { luminance: signals.luminance }, signals.pose).label}。${makeupText}。因此推荐 ${look.name}：${lightReason(signals.luminance)}，${toneReason(signals.warmth)}，${intensityText}。${fitReason(signals)}`;
}

export function guidanceForFace(quality, faceTone = { luminance: 0.56 }, pose = {}) {
  if ((pose.mouthOpen ?? 0) > 0.28) {
    return { label: "张嘴需重拍", tone: "warn", summary: "嘴部动作会让唇部覆盖失真", message: "检测到张嘴幅度较大。已暂停唇部覆盖，请闭合双唇后重新拍摄或继续测试。" };
  }
  if ((pose.mouthOpen ?? 0) > 0.12) {
    return { label: "张嘴需重拍", tone: "warn", summary: "嘴部动作会降低唇部预览可信度", message: "检测到轻中度张嘴。系统保留低强度的安全部分预览并避开内唇区域；请闭合双唇后再确认最终唇线。" };
  }
  if ((pose.yaw ?? 0) > 0.32) {
    return { label: "侧脸需重拍", tone: "warn", summary: "侧脸会影响遮挡和透视", message: "检测到侧脸角度较大。系统只保留可见侧妆效，并暂停高置信度推荐。请转向镜头后重拍。" };
  }
  if ((pose.yaw ?? 0) > 0.16) {
    return { label: "侧脸需重拍", tone: "warn", summary: "侧转会降低远侧妆效可信度", message: "检测到轻中度侧转。系统保留双侧预览，但会降低远侧妆效强度并暂停高置信度推荐；请转向镜头后再确认位置。" };
  }
  if (faceTone?.luminance < 0.26 || faceTone?.luminance > 0.9) {
    return { label: "画面亮度待确认", tone: "warn", summary: "亮度不会直接决定肤色或妆效可信度", message: "画面亮度偏离常见范围。系统保留显色补偿，不会把肤色亮度直接当作低质量；请人工确认预览是否清晰。" };
  }
  if (quality >= 0.72) {
    return { label: "贴合良好", tone: "ok", summary: "关键点贴合良好", message: "识别稳定。可以应用推荐、调整强度，或记录当前样本。" };
  }
  if (quality >= 0.48) {
    return { label: "轻微降噪", tone: "warn", summary: "关键点可用，边缘会轻微柔化", message: "已识别但贴合一般。请让脸更靠近画面中央，妆效会轻微柔化边缘。" };
  }
  return { label: "角度偏大", tone: "warn", summary: "角度或距离影响贴合，推荐会更保守", message: "角度或距离影响贴合。请面向镜头，让脸部占画面约三分之一。" };
}

export function lightLabel(luminance) {
  if (luminance < 0.34) return "光线偏暗";
  if (luminance > 0.78) return "光线偏亮";
  return "光线稳定";
}

export function toneLabel(warmth) {
  if (warmth > 0.18) return "画面偏暖";
  if (warmth < -0.08) return "画面偏冷";
  return "中性光感";
}

export function lightReason(luminance) {
  if (luminance < 0.34) return "当前画面亮度偏低，系统会保留显色补偿；请以预览可见度而不是肤色亮度判断是否需要重拍";
  if (luminance > 0.78) return "当前画面偏亮，需要稍有存在感的颜色，避免妆效被吃掉";
  return "当前光线稳定，可以保留自然肤感和清晰边界";
}

export function toneReason(warmth) {
  if (warmth > 0.18) return "画面偏暖，蜜桃、珊瑚或柔玫瑰会更自然地提气色";
  if (warmth < -0.08) return "画面偏冷，豆沙、梅子或灰调玫瑰能减少突兀感";
  return "光感接近中性，冷暖色都有空间，优先跟随你选择的场景目标";
}

export function fitReason(signals) {
  if ((signals.mouthOpen ?? 0) > 0.28) return "嘴部动作较大，系统已暂停唇部覆盖，避免欠填或轮廓变形。";
  if ((signals.pose?.yaw ?? 0) > 0.32) return "侧脸角度较大，系统不会继续渲染远侧妆效，也不会给出高置信度推荐。";
  if ((signals.mouthOpen ?? 0) > 0.12) return "嘴部存在轻中度动作，系统仅保留避开内唇区域的低强度部分预览；最终唇线需要闭嘴重拍后确认。";
  if ((signals.pose?.yaw ?? 0) > 0.16) return "画面存在轻中度侧转，系统会保留双侧预览并降低远侧强度，同时压低推荐置信度。";
  if (signals.quality < 0.48) return "当前贴合质量一般，所以系统会选择边界更柔和、强度更保守的方案。";
  if ((signals.mouthOpen ?? 0) > 0.08) return "嘴部存在轻微动作，系统会降低唇部重量，减少压唇线的问题。";
  return "当前关键点稳定，可以保留唇、腮红和眼影的细节。";
}

export function budgetHint(budget) {
  const hints = {
    starter: "产品清单会优先给平价同色系替代",
    balanced: "产品清单会优先给开架与中端的均衡组合",
    premium: "产品清单可以加入更高质感的进阶单品",
    sensitive: "产品清单会优先避开高刺激、高香精表达",
  };
  return hints[budget] ?? hints.starter;
}
