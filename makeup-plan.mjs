export const makeupStepIds = [
  "base",
  "concealer",
  "brows",
  "eyeliner",
  "lashes",
  "eye",
  "blush",
  "highlightContour",
  "setting",
  "lip",
];

const budgetDirections = {
  starter: {
    tier: "开架友好",
    base: "轻薄持妆底妆",
    concealer: "保湿型局部遮瑕",
    brows: "细芯眉笔与透明眉胶",
    eyeliner: "棕灰色眼线笔",
    lashes: "自然卷翘睫毛膏",
    eye: "三色日常眼影盘",
    blush: "低饱和单色腮红",
    sculpt: "细腻哑光高光修容",
    setting: "局部散粉与定妆喷雾",
    lip: "同色系水润唇釉",
  },
  balanced: {
    tier: "开架 + 中端",
    base: "自然柔焦底妆",
    concealer: "薄层提亮遮瑕",
    brows: "顺毛眉笔与染眉膏",
    eyeliner: "极细眼线液笔",
    lashes: "纤长卷翘睫毛膏",
    eye: "四色通勤眼影盘",
    blush: "膏状腮红",
    sculpt: "低闪高光与自然修容",
    setting: "轻薄散粉与保湿定妆喷雾",
    lip: "细管显色口红",
  },
  premium: {
    tier: "质感优先",
    base: "精华型自然光泽底妆",
    concealer: "高延展局部遮瑕",
    brows: "眉笔、眉粉与定型眉胶",
    eyeliner: "持久极细眼线液",
    lashes: "纤长浓密睫毛膏",
    eye: "高贴合粉质眼影",
    blush: "细闪提亮腮红",
    sculpt: "柔光高光与阴影修容",
    setting: "定妆粉与长效定妆喷雾",
    lip: "丝绒或缎光唇膏",
  },
  sensitive: {
    tier: "低刺激表达",
    base: "温和妆前与轻遮瑕底妆",
    concealer: "少量低刺激局部遮瑕",
    brows: "低香精眉笔与透明眉胶",
    eyeliner: "柔和棕色眼线笔",
    lashes: "温和易卸睫毛膏",
    eye: "低闪片哑光眼影",
    blush: "轻薄膏状腮红",
    sculpt: "低刺激细腻修容高光",
    setting: "少量散粉或保湿定妆喷雾",
    lip: "滋润型低香精唇膏",
  },
};

const moodDirections = {
  clean: {
    brows: "顺着原生毛流轻填，保留眉头空气感。",
    eyeliner: "以内眼线或贴根细线为主，眼尾不拉长。",
    lashes: "夹翘后刷一层，重点拉开而不是堆叠。",
    sculpt: "在颧骨高点和鼻梁中央少量提亮，轮廓只做轻扫。",
  },
  rose: {
    brows: "保持柔和弧度，眉尾比原生长度略微延长。",
    eyeliner: "用棕色细线顺着睫毛根部，眼尾轻轻平拉。",
    lashes: "强调中段卷翘，让眼神更柔和。",
    sculpt: "高光放在颧骨前段，修容从耳侧向前少量晕开。",
  },
  sharp: {
    brows: "眉峰清晰但不加深眉头，眉尾收得干净。",
    eyeliner: "从眼尾三分之一开始，做短而平的提拉线。",
    lashes: "拉长眼尾睫毛，避免整体过厚。",
    sculpt: "颧骨下方和下颌线做低饱和阴影，避免大面积深色。",
  },
  fresh: {
    brows: "眉毛保持圆润柔和，用浅一阶颜色轻填空隙。",
    eyeliner: "用深棕色贴根描绘，眼尾不强调锐角。",
    lashes: "集中刷上睫毛中段，制造轻盈放大感。",
    sculpt: "高光点到为止，修容从外侧向内柔和过渡。",
  },
  bold: {
    brows: "眉形保持利落，颜色不超过发色的深度。",
    eyeliner: "眼尾可以更清晰，但线条要贴合睫毛根部。",
    lashes: "先拉长再增加一点根部浓密，避免结块。",
    sculpt: "高光和修容都控制在局部，让唇眼保留主视觉。",
  },
};

function lipTexture(texture, finish, intensity) {
  if (texture === "stain") return "轻薄染唇质地，从唇中央向外轻拍开。";
  if (texture === "satin") return "缎光质地，薄涂后在唇峰和下唇中央补一层。";
  if (texture === "mist") return "柔雾质地，边缘用唇刷柔化，保留轻薄层次。";
  if (texture === "glow") return "水光或玻璃唇质地，中心叠一层透明光泽。";
  if (finish === "glow") return "水光或玻璃唇质地，中心叠一层透明光泽。";
  if (finish === "mist") return "柔雾或缎雾质地，边缘用唇刷柔化。";
  if (finish === "bold" || intensity > 0.54) return "缎光或丝绒质地，先勾清边缘再薄涂叠色。";
  return "轻薄缎光或染唇质地，保留原生唇纹。";
}

function baseDirection(profile, existingMakeup) {
  const finish = profile.labels[2];
  const coverage = {
    sheer: "轻薄覆盖，只做均匀和提气色。",
    natural: "自然覆盖，按需要局部叠加。",
    medium: "中等覆盖，先薄铺再局部补足。",
  }[profile.options?.baseCoverage] ?? "轻薄覆盖，只做均匀和提气色。";
  const existingText = existingMakeup === "visible" ? "原照片已有明显妆容，优先薄叠而不是覆盖。" : existingMakeup === "light" ? "原照片带淡妆，薄层补足均匀感即可。" : "以薄层均匀肤色为目标，保留真实皮肤纹理。";
  return `${finish}方向，${coverage}${existingText}`;
}

function browDirection(mood, browStyle) {
  const direction = {
    natural: "顺着原生毛流轻填，保留眉头空气感。",
    defined: "眉尾和下缘更清晰，眉头仍保持轻柔过渡。",
    sharp: "保留清晰眉峰和利落眉尾，但不加深眉头。",
  }[browStyle];
  return direction ?? mood.brows;
}

function eyeFocusDirection(mood, eyeFocus) {
  const direction = {
    natural: {
      eyeliner: "以内眼线或贴根细线为主，眼尾不拉长。",
      lashes: "夹翘后刷一层，重点拉开而不是堆叠。",
      shadow: "先铺浅色，再在上眼睑中央轻压主色。",
    },
    bright: {
      eyeliner: "从睫毛根部开始描绘，眼尾只做短线，留出明亮感。",
      lashes: "重点刷上睫毛中段，让眼睛更有打开感。",
      shadow: "主色放在上眼睑中央和卧蚕外侧，边缘充分晕开。",
    },
    lifted: {
      eyeliner: "从眼尾三分之一开始，做短而平的提拉线。",
      lashes: "拉长眼尾睫毛，整体保持根根分明。",
      shadow: "主色向眼尾延伸，避免把深色压到整个眼窝。",
    },
  }[eyeFocus];
  return direction ?? { eyeliner: mood.eyeliner, lashes: mood.lashes, shadow: "先铺浅色再把主色压在上眼睑和眼尾三分之一。" };
}

function qualityCaution(qualityGate) {
  if (qualityGate === "good_for_tryon") return "可按推荐调整，再以镜前真实效果为准。";
  if (qualityGate === "usable_but_unstable") return "当前照片条件一般，颜色和位置请在镜前复核。";
  return "当前照片不适合作为精确位置依据；保留方案方向，重拍后再看预览。";
}

export function buildCompleteMakeupPlan({ look, profile, budget = "starter", qualityGate = "cannot_analyze" }) {
  const copy = budgetDirections[budget] ?? budgetDirections.starter;
  const mood = moodDirections[look.profile?.mood] ?? moodDirections.clean;
  const warmth = look.profile?.warmth ?? 0;
  const intensity = look.profile?.intensity ?? 0.4;
  const options = profile.options ?? {};
  const browGuidance = browDirection(mood, options.browStyle);
  const eyeFocus = eyeFocusDirection(mood, options.eyeFocus);
  const selectedLipTexture = lipTexture(options.lipTexture, profile.finish, intensity);
  const warmPalette = warmth > 0.16 ? "暖杏、赤陶或蜜桃" : warmth < -0.08 ? "灰粉、梅子或冷棕" : "米棕、玫瑰或香槟";
  const blushPlacement = look.profile?.mood === "bold" ? "颧骨外侧低面积晕开" : look.profile?.mood === "sharp" ? "从颧骨后侧向前收束" : "从苹果肌向颧骨轻扫";
  const caution = qualityCaution(qualityGate);

  return [
    {
      id: "base",
      category: "底妆",
      recommendation: copy.base,
      guidance: baseDirection(profile, profile.existingMakeup),
      caution,
      productDirection: `${copy.tier} / ${profile.labels[2]}`,
      visualPreview: false,
      color: "#dfbea5",
    },
    {
      id: "concealer",
      category: "遮瑕",
      recommendation: copy.concealer,
      guidance: "只在你想要提亮或均匀的局部少量点涂，边缘向外拍开，不把皮肤特征当作需要消除的问题。",
      caution: "少量多次，避免在纹理明显处堆叠。",
      productDirection: copy.tier,
      visualPreview: false,
      color: "#d5b293",
    },
    {
      id: "brows",
      category: "眉妆",
      recommendation: copy.brows,
      guidance: browGuidance,
      caution: "眉色以接近发根或略浅一阶为宜，不需要刻意改变原生眉形。",
      productDirection: copy.tier,
      visualPreview: false,
      color: "#71584d",
    },
    {
      id: "eyeliner",
      category: "眼线",
      recommendation: copy.eyeliner,
      guidance: eyeFocus.eyeliner,
      caution: "先确认左右眼线角度，再补足颜色；当前版本不做眼线视觉叠加。",
      productDirection: copy.tier,
      visualPreview: false,
      color: "#463e3b",
    },
    {
      id: "lashes",
      category: "睫毛",
      recommendation: copy.lashes,
      guidance: eyeFocus.lashes,
      caution: "避免一次叠太多层，睫毛结块会压低整体轻盈感。",
      productDirection: copy.tier,
      visualPreview: false,
      color: "#332d2c",
    },
    {
      id: "eye",
      category: "眼妆",
      recommendation: copy.eye,
      guidance: `以${warmPalette}为主色，${eyeFocus.shadow}`,
      caution: "当前照片预览支持眼影范围；真实上妆时先从低饱和强度开始。",
      productDirection: `已预览 / ${warmPalette}`,
      visualPreview: true,
      color: look.eye,
    },
    {
      id: "blush",
      category: "腮红",
      recommendation: copy.blush,
      guidance: `${blushPlacement}，颜色与唇色保持同一冷暖方向。`,
      caution: "当前照片预览支持腮红；如颜色显脏，先减小面积再降低强度。",
      productDirection: "已预览 / 与唇色同调",
      visualPreview: true,
      color: look.blush,
    },
    {
      id: "highlightContour",
      category: "高光/修容",
      recommendation: copy.sculpt,
      guidance: mood.sculpt,
      caution: "以光影平衡为目的，不用它修正或评价脸型。",
      productDirection: copy.tier,
      visualPreview: false,
      color: "#b78d72",
    },
    {
      id: "setting",
      category: "定妆",
      recommendation: copy.setting,
      guidance: profile.labels[2] === "水光" ? "只在容易出油的位置少量定妆，其余区域用喷雾保留光泽。" : "先局部压住容易移动的位置，再用喷雾融合粉感。",
      caution: "先少量再叠加，避免把底妆压得干或失去层次。",
      productDirection: copy.tier,
      visualPreview: false,
      color: "#e5ddd6",
    },
    {
      id: "lip",
      category: "唇妆",
      recommendation: copy.lip,
      guidance: `${selectedLipTexture} 颜色建议沿用当前${warmPalette}方向。`,
      caution: "当前照片预览支持唇色；张嘴、侧脸或强阴影时请以镜前试色为准。",
      productDirection: `已预览 / ${selectedLipTexture.split("，")[0]}`,
      visualPreview: true,
      color: look.lip,
    },
  ];
}
