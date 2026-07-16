import {
  angleBetween,
  average,
  clamp,
  distance,
  mapRange,
  mixPoints,
  movePoint,
  raise,
} from "./render/geometry.mjs";
import {
  adaptEyeShadowColor,
  adaptMakeupColor,
  colorWithAlpha,
  makeupVisibilityMultiplier,
  mixRgb,
  neutralTone,
  rgbaFromRgb,
} from "./render/color.mjs";
import {
  adaptiveBlushColorProfile,
  adaptiveBlushCenters,
  adaptiveBlushProfile,
  adaptiveBlushSideScale,
  lipFitRenderProfile,
  lipTextureRenderProfile,
} from "./render-policy.mjs?v=7.4-lip-fit";

const defaultRenderPolicy = {
  adaptiveBlushColorProfile,
  adaptiveBlushCenters,
  adaptiveBlushProfile,
  adaptiveBlushSideScale,
  lipFitRenderProfile,
  lipTextureRenderProfile,
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

export function makeupSideVisibility(pose = {}) {
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

export function createMakeupRenderer({ ctx, canvas, renderPolicy = {} }) {
  if (!ctx || !canvas) throw new TypeError("createMakeupRenderer requires ctx and canvas");
  const policy = { ...defaultRenderPolicy, ...renderPolicy };
  const makeupLayer = createLayerCanvas(canvas);
  const makeupLayerCtx = makeupLayer.getContext("2d");
  if (!makeupLayerCtx) throw new Error("Unable to create makeup layer context");

  function renderMakeupLayers(options) {
    drawEyeShadow(options);
    drawBlush(options);
    drawLips(options);
  }

  function drawLips({
    landmarks,
    mirrored = false,
    qualityOpacity,
    pose = {},
    diagnostics,
    look,
    preferences,
    mode,
    flags = {},
  }) {
    const lipTextureExperimentEnabled = flags.lipTextureExperimentEnabled ?? false;
    const mouthOpen = pose.mouthOpen ?? 0;
    const yaw = pose.yaw ?? 0;
    const textureProfile = policy.lipTextureRenderProfile(preferences.lipTexture, lipTextureExperimentEnabled);
    const lipDiagnostic = {
      status: "rendered",
      partial: false,
      reason: "",
      mouthOpen: Number(mouthOpen.toFixed(3)),
      yaw: Number(yaw.toFixed(3)),
      texture: textureProfile.id,
      texturePreference: preferences.lipTexture,
      experimental: lipTextureExperimentEnabled,
      glossSpotAlpha: textureProfile.glossSpotAlpha,
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
    const fullLipPath = allOuter;
    const mouthWidth = Math.max(1, distance(point(landmarks[61], mirrored), point(landmarks[291], mirrored)));
    const faceWidth = Math.max(1, distance(point(landmarks[234], mirrored), point(landmarks[454], mirrored)));
    const mouthRatio = mouthWidth / faceWidth;
    const outerTop = point(landmarks[0], mirrored);
    const outerBottom = point(landmarks[17], mirrored);
    const innerTop = point(landmarks[13], mirrored);
    const innerBottom = point(landmarks[14], mirrored);
    const outerHeightRatio = distance(outerTop, outerBottom) / mouthWidth;
    const contourOrdered =
      [...allOuter, ...innerMouth].every((item) => Number.isFinite(item.x) && Number.isFinite(item.y)) &&
      outerTop.y <= outerBottom.y + mouthWidth * 0.03 &&
      innerTop.y <= innerBottom.y + mouthWidth * 0.03;
    const fitProfile = policy.lipFitRenderProfile({
      yaw,
      mouthOpen,
      mouthRatio,
      outerHeightRatio,
      contourOrdered,
    });
    lipDiagnostic.outerHeightRatio = Number(outerHeightRatio.toFixed(3));
    lipDiagnostic.baseOpacityScale = fitProfile.baseOpacityScale;
    lipDiagnostic.centerTintScale = fitProfile.centerTintScale;
    if (fitProfile.status === "skipped") {
      lipDiagnostic.status = fitProfile.status;
      lipDiagnostic.reason = fitProfile.reason;
      return;
    }
    lipDiagnostic.partial = fitProfile.partial;
    lipDiagnostic.reason = fitProfile.reason;
    const lipTone = sampleToneFromPoints([...allOuter, ...innerMouth], Math.max(4, mouthWidth * 0.025));
    const mouthComfort = clamp(mapRange(mouthOpen, 0.06, 0.24, 1, 0.72), 0.72, 1);
    const poseComfort = clamp(mapRange(yaw, 0.1, 0.44, 1, 0.62), 0.62, 1);
    const opacity =
      look.lipIntensity *
      qualityOpacity *
      makeupVisibilityMultiplier(lipTone, preferences.existingMakeup) *
      mouthComfort *
      poseComfort *
      fitProfile.baseOpacityScale *
      (mode === "camera" ? 0.86 : 0.98);
    const edgeBlur = clamp(mouthWidth * 0.012, 0.8, 3.8);
    const eraseBlur = clamp(mouthWidth * mapRange(mouthOpen, 0.02, 0.12, 0.012, 0.032), 1.2, 5.6);
    const lipRgb = adaptMakeupColor(look.lip, lipTone, { mix: 0.04, lightBoost: 0.98, minimumContrast: 0.22 });
    const lipSoftRgb = adaptMakeupColor(look.lip, lipTone, { mix: 0.1, lightBoost: 1.08, minimumContrast: 0.16 });
    const highlightRgb = mixRgb(lipSoftRgb, { r: 255, g: 236, b: 226 }, 0.32);
    const mouthCenter = {
      x: (point(landmarks[61], mirrored).x + point(landmarks[291], mirrored).x) / 2,
      y: (point(landmarks[0], mirrored).y + point(landmarks[17], mirrored).y) / 2,
    };

    drawFeatheredFill({
      paths: [fullLipPath],
      erasePaths: [innerMouth],
      color: rgbaFromRgb(lipSoftRgb, opacity * textureProfile.softAlpha),
      blur: edgeBlur * textureProfile.softBlurScale,
      eraseBlur,
      composite: "source-over",
    });

    drawFeatheredFill({
      paths: [fullLipPath],
      erasePaths: [innerMouth],
      color: rgbaFromRgb(lipRgb, opacity * textureProfile.pigmentAlpha),
      blur: edgeBlur * textureProfile.pigmentBlurScale,
      eraseBlur,
      composite: "multiply",
    });

    const centerTintOpacity = opacity * textureProfile.centerAlpha * fitProfile.centerTintScale;
    const highlightProfile = {
      ...textureProfile,
      innerHighlightAlpha: textureProfile.innerHighlightAlpha * Math.max(0.42, fitProfile.centerTintScale),
      glossSpotAlpha: textureProfile.glossSpotAlpha * fitProfile.centerTintScale,
    };
    lipDiagnostic.centerTintOpacity = Number(centerTintOpacity.toFixed(3));
    lipDiagnostic.glossSpotAlpha = Number(highlightProfile.glossSpotAlpha.toFixed(3));
    if (centerTintOpacity > 0) {
      drawLipCenterTint({
        paths: [fullLipPath],
        erasePaths: [innerMouth],
        center: mouthCenter,
        radius: mouthWidth * textureProfile.centerRadiusScale,
        color: lipRgb,
        opacity: centerTintOpacity,
        blur: edgeBlur * textureProfile.centerBlurScale,
        eraseBlur,
      });
    }

    const innerHighlightPoints = lowerLipInner.slice(2, 9).map((index) => point(landmarks[index], mirrored));
    if (!lipTextureExperimentEnabled) {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = rgbaFromRgb(highlightRgb, opacity * textureProfile.outlineHighlightAlpha);
      ctx.lineWidth = clamp(mouthWidth * textureProfile.highlightWidthScale, 1.1, 3.2);
      ctx.filter = `blur(${textureProfile.highlightBlur}px)`;
      drawClosedPath(allOuter);
      ctx.stroke();
      drawOpenPath(innerHighlightPoints);
      ctx.stroke();
      ctx.restore();
      return;
    }

    drawMaskedLipHighlights({
      lipPaths: [upperPath, lowerPath],
      innerMouth,
      outerPoints: allOuter,
      innerPoints: innerHighlightPoints,
      color: highlightRgb,
      opacity,
      profile: highlightProfile,
      mouthWidth,
      eraseBlur,
    });
  }

  function drawMaskedLipHighlights({ lipPaths, innerMouth, outerPoints, innerPoints, color, opacity, profile, mouthWidth, eraseBlur }) {
    if (profile.outlineHighlightAlpha <= 0 && profile.innerHighlightAlpha <= 0) return;
    ensureMakeupLayer();
    makeupLayerCtx.clearRect(0, 0, makeupLayer.width, makeupLayer.height);

    makeupLayerCtx.save();
    makeupLayerCtx.globalCompositeOperation = "source-over";
    makeupLayerCtx.lineCap = "round";
    makeupLayerCtx.lineJoin = "round";
    makeupLayerCtx.lineWidth = clamp(mouthWidth * profile.highlightWidthScale, 1.1, 3.2);
    makeupLayerCtx.filter = `blur(${profile.highlightBlur}px)`;
    if (profile.outlineHighlightAlpha > 0) {
      makeupLayerCtx.strokeStyle = rgbaFromRgb(color, opacity * profile.outlineHighlightAlpha);
      drawClosedPathOn(makeupLayerCtx, outerPoints);
      makeupLayerCtx.stroke();
    }
    if (profile.innerHighlightAlpha > 0) {
      makeupLayerCtx.strokeStyle = rgbaFromRgb(color, opacity * profile.innerHighlightAlpha);
      drawOpenPathOn(makeupLayerCtx, innerPoints);
      makeupLayerCtx.stroke();
    }
    if (profile.glossSpotAlpha > 0 && lipPaths[1]?.length) {
      const lowerLipPoints = lipPaths[1];
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const item of lowerLipPoints) {
        minX = Math.min(minX, item.x);
        maxX = Math.max(maxX, item.x);
        minY = Math.min(minY, item.y);
        maxY = Math.max(maxY, item.y);
      }
      const spotX = (minX + maxX) / 2 + mouthWidth * 0.04;
      const spotY = minY + (maxY - minY) * 0.58;
      makeupLayerCtx.filter = `blur(${profile.glossSpotBlur}px)`;
      makeupLayerCtx.fillStyle = rgbaFromRgb(color, opacity * profile.glossSpotAlpha);
      makeupLayerCtx.beginPath();
      makeupLayerCtx.ellipse(
        spotX,
        spotY,
        Math.max(1, mouthWidth * profile.glossSpotWidthScale),
        Math.max(0.45, mouthWidth * profile.glossSpotHeightScale),
        -0.08,
        0,
        Math.PI * 2
      );
      makeupLayerCtx.fill();
    }

    makeupLayerCtx.globalCompositeOperation = "destination-in";
    makeupLayerCtx.fillStyle = "rgba(0, 0, 0, 1)";
    makeupLayerCtx.filter = "none";
    makeupLayerCtx.beginPath();
    for (const path of lipPaths) {
      addClosedSubpathOn(makeupLayerCtx, path);
    }
    makeupLayerCtx.fill();

    makeupLayerCtx.globalCompositeOperation = "destination-out";
    makeupLayerCtx.filter = `blur(${Math.max(0.45, eraseBlur * 0.35)}px)`;
    drawClosedPathOn(makeupLayerCtx, innerMouth);
    makeupLayerCtx.fill();
    makeupLayerCtx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(makeupLayer, 0, 0);
    ctx.restore();
  }

  function drawLipCenterTint({ paths, erasePaths, center, radius, color, opacity, blur, eraseBlur }) {
    if (opacity <= 0 || radius <= 0) return;
    ensureMakeupLayer();
    makeupLayerCtx.clearRect(0, 0, makeupLayer.width, makeupLayer.height);

    makeupLayerCtx.save();
    makeupLayerCtx.fillStyle = "rgba(0, 0, 0, 1)";
    makeupLayerCtx.filter = `blur(${blur}px)`;
    for (const path of paths) {
      drawClosedPathOn(makeupLayerCtx, path);
      makeupLayerCtx.fill();
    }

    makeupLayerCtx.globalCompositeOperation = "destination-out";
    makeupLayerCtx.filter = `blur(${eraseBlur}px)`;
    for (const path of erasePaths) {
      drawClosedPathOn(makeupLayerCtx, path);
      makeupLayerCtx.fill();
    }

    makeupLayerCtx.globalCompositeOperation = "source-in";
    makeupLayerCtx.filter = "none";
    const gradient = makeupLayerCtx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
    gradient.addColorStop(0, rgbaFromRgb(color, opacity));
    gradient.addColorStop(0.58, rgbaFromRgb(color, opacity * 0.58));
    gradient.addColorStop(1, rgbaFromRgb(color, 0));
    makeupLayerCtx.fillStyle = gradient;
    makeupLayerCtx.fillRect(center.x - radius, center.y - radius * 0.52, radius * 2, radius * 1.04);
    makeupLayerCtx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(makeupLayer, 0, 0);
    ctx.restore();
  }

  function drawBlush({
    landmarks,
    mirrored = false,
    qualityOpacity,
    pose = {},
    diagnostics,
    look,
    preferences,
    mode,
    flags = {},
  }) {
    const blushPlacementExperimentEnabled = flags.blushPlacementExperimentEnabled ?? false;
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
    const leftMouth = point(landmarks[61], mirrored);
    const rightMouth = point(landmarks[291], mirrored);
    const leftJaw = point(landmarks[132], mirrored);
    const rightJaw = point(landmarks[361], mirrored);
    const legacyLeft = movePoint(mixPoints(leftAnchor, leftReference, 0.28), { x: 0, y: -faceWidth * 0.012 });
    const legacyRight = movePoint(mixPoints(rightAnchor, rightReference, 0.28), { x: 0, y: -faceWidth * 0.012 });
    const blushPlacement = policy.adaptiveBlushProfile({
      faceHeight: distance(point(landmarks[10], mirrored), point(landmarks[152], mirrored)),
      faceWidth,
      foreheadWidth: distance(point(landmarks[127], mirrored), point(landmarks[356], mirrored)),
      jawWidth: distance(point(landmarks[172], mirrored), point(landmarks[397], mirrored)),
    });
    const eyeLineY = average([leftEye.y, rightEye.y]);
    const adaptiveCenters = policy.adaptiveBlushCenters({
      nose,
      leftOuter,
      rightOuter,
      leftLegacy: legacyLeft,
      rightLegacy: legacyRight,
      eyeLineY,
      profile: blushPlacement,
    });
    const left = blushPlacementExperimentEnabled ? adaptiveCenters.left : legacyLeft;
    const right = blushPlacementExperimentEnabled ? adaptiveCenters.right : legacyRight;
    const sides = makeupSideVisibility(pose);
    const leftSideSpan = distance(nose, leftOuter);
    const rightSideSpan = distance(nose, rightOuter);
    const averageSideSpan = average([leftSideSpan, rightSideSpan]);
    const leftSideScale = policy.adaptiveBlushSideScale({
      sideSpan: leftSideSpan,
      averageSpan: averageSideSpan,
      sideOpacity: sides.leftOpacity,
    });
    const rightSideScale = policy.adaptiveBlushSideScale({
      sideSpan: rightSideSpan,
      averageSpan: averageSideSpan,
      sideOpacity: sides.rightOpacity,
    });
    const leftRadiusX = blushPlacementExperimentEnabled
      ? faceWidth * blushPlacement.radiusXScale * leftSideScale.radiusXScale
      : clamp(distance(left, nose) * 0.58, faceWidth * 0.095, faceWidth * 0.14);
    const rightRadiusX = blushPlacementExperimentEnabled
      ? faceWidth * blushPlacement.radiusXScale * rightSideScale.radiusXScale
      : clamp(distance(right, nose) * 0.58, faceWidth * 0.095, faceWidth * 0.14);
    const leftRadiusY = blushPlacementExperimentEnabled
      ? faceWidth * blushPlacement.radiusYScale * leftSideScale.radiusYScale
      : clamp(Math.abs(left.y - leftEye.y) * 0.56, faceWidth * 0.06, faceWidth * 0.092);
    const rightRadiusY = blushPlacementExperimentEnabled
      ? faceWidth * blushPlacement.radiusYScale * rightSideScale.radiusYScale
      : clamp(Math.abs(right.y - rightEye.y) * 0.56, faceWidth * 0.06, faceWidth * 0.092);
    const leftAngle = blushPlacementExperimentEnabled
      ? Math.PI * blushPlacement.tilt * (left.x < nose.x ? 1 : -1)
      : angleBetween(leftOuter, left);
    const rightAngle = blushPlacementExperimentEnabled
      ? Math.PI * blushPlacement.tilt * (right.x < nose.x ? 1 : -1)
      : angleBetween(rightOuter, right);
    const leftTone = blushPlacementExperimentEnabled
      ? sampleToneFromEllipse(left, leftRadiusX * 0.62, leftRadiusY * 0.68, leftAngle)
      : sampleToneFromPoints([left, leftReference], leftRadiusX * 0.42);
    const rightTone = blushPlacementExperimentEnabled
      ? sampleToneFromEllipse(right, rightRadiusX * 0.62, rightRadiusY * 0.68, rightAngle)
      : sampleToneFromPoints([right, rightReference], rightRadiusX * 0.42);
    const sharedBlushTone = {
      r: average([leftTone.r, rightTone.r]),
      g: average([leftTone.g, rightTone.g]),
      b: average([leftTone.b, rightTone.b]),
      luminance: average([leftTone.luminance, rightTone.luminance]),
      warmth: average([leftTone.warmth, rightTone.warmth]),
    };
    const blushColorProfile = policy.adaptiveBlushColorProfile(sharedBlushTone);
    const baseBlushColor = adaptMakeupColor(look.blush, sharedBlushTone, {
      mix: blushPlacementExperimentEnabled ? blushColorProfile.toneMix : 0.1,
      lightBoost: blushPlacementExperimentEnabled ? blushColorProfile.lightBoost : 1.08,
      minimumContrast: blushPlacementExperimentEnabled ? blushColorProfile.minimumContrast : 0.18,
    });
    const blushColor = blushPlacementExperimentEnabled
      ? mixRgb(baseBlushColor, blushColorProfile.tint, blushColorProfile.tintMix)
      : baseBlushColor;
    const leftContour = cheekContourPath({
      center: left,
      eye: leftEye,
      nose,
      outer: leftOuter,
      mouth: leftMouth,
      jaw: leftJaw,
      radiusX: leftRadiusX,
      radiusY: leftRadiusY,
    });
    const rightContour = cheekContourPath({
      center: right,
      eye: rightEye,
      nose,
      outer: rightOuter,
      mouth: rightMouth,
      jaw: rightJaw,
      radiusX: rightRadiusX,
      radiusY: rightRadiusY,
    });
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
      adaptive: blushPlacementExperimentEnabled,
      faceShape: blushPlacementExperimentEnabled ? blushPlacement.id : "fixed",
      geometry: blushPlacementExperimentEnabled
        ? {
            lengthRatio: blushPlacement.lengthRatio,
            foreheadRatio: blushPlacement.foreheadRatio,
            jawRatio: blushPlacement.jawRatio,
            weights: blushPlacement.weights,
          }
        : null,
      colorFamily: blushPlacementExperimentEnabled ? blushColorProfile.family : "legacy",
      left: {
        ...leftReliability,
        rendered: false,
        toneLuminance: Number((leftTone.luminance ?? 0.56).toFixed(3)),
        projection: leftSideScale.projection,
        blendMode: blushPlacementExperimentEnabled
          ? "contoured-soft-light"
          : (sharedBlushTone.luminance ?? 0.56) < 0.3 ? "shadow-preserving" : "source-over",
      },
      right: {
        ...rightReliability,
        rendered: false,
        toneLuminance: Number((rightTone.luminance ?? 0.56).toFixed(3)),
        projection: rightSideScale.projection,
        blendMode: blushPlacementExperimentEnabled
          ? "contoured-soft-light"
          : (sharedBlushTone.luminance ?? 0.56) < 0.3 ? "shadow-preserving" : "source-over",
      },
    };
    if (diagnostics) diagnostics.blush = blushDiagnostic;

    ctx.save();
    const blushBoost = blushPlacementExperimentEnabled
      ? mode === "camera" ? 0.94 : 1.22
      : mode === "camera" ? 1.05 : 1.42;
    const blushPlacementIntensity = blushPlacementExperimentEnabled ? blushPlacement.intensityScale : 1;
    const drawOneBlush = (center, radiusX, radiusY, angle, color, intensity, tone, contour) => {
      if (blushPlacementExperimentEnabled) {
        const outwardDirection = center.x < nose.x ? -1 : 1;
        ctx.globalCompositeOperation = "soft-light";
        drawContouredBlush(center, radiusX, radiusY, angle, color, intensity * 0.9, contour, outwardDirection);
        ctx.globalCompositeOperation = "source-over";
        drawContouredBlush(center, radiusX, radiusY, angle, color, intensity * 0.62, contour, outwardDirection);
        return;
      }
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
          look.blushIntensity * qualityOpacity * makeupVisibilityMultiplier(sharedBlushTone, preferences.existingMakeup) * blushBoost * blushPlacementIntensity * (blushPlacementExperimentEnabled ? leftSideScale.opacityScale : sides.leftOpacity),
          0,
          1
        ),
        sharedBlushTone,
        leftContour
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
          look.blushIntensity * qualityOpacity * makeupVisibilityMultiplier(sharedBlushTone, preferences.existingMakeup) * blushBoost * blushPlacementIntensity * (blushPlacementExperimentEnabled ? rightSideScale.opacityScale : sides.rightOpacity),
          0,
          1
        ),
        sharedBlushTone,
        rightContour
      );
      blushDiagnostic.right.rendered = true;
    } else if (!sides.right) {
      blushDiagnostic.right.reason = "profile-far-side-hidden";
    } else {
      blushDiagnostic.right.reason = rightReliability.reason || "occlusion-uncertain";
    }
    ctx.restore();
  }

  function drawEyeShadow({
    landmarks,
    mirrored = false,
    qualityOpacity,
    pose = {},
    diagnostics,
    look,
    preferences,
    mode,
  }) {
    const faceWidth = distance(point(landmarks[234], mirrored), point(landmarks[454], mirrored));
    const lift = clamp(faceWidth * 0.028, 4, 14);
    const blur = clamp(faceWidth * 0.014, 1.5, 5.5);
    const leftPath = eyeLidShadowPath([33, 246, 161, 160, 159, 158, 157, 173, 133], landmarks, mirrored, lift);
    const rightPath = eyeLidShadowPath([263, 466, 388, 387, 386, 385, 384, 398, 362], landmarks, mirrored, lift);
    const leftTone = sampleToneFromPoints(leftPath, lift * 1.2);
    const rightTone = sampleToneFromPoints(rightPath, lift * 1.2);
    const warmSafe = (diagnostics?.faceTone?.warmth ?? 0) > 0.08 && (look.profile?.warmth ?? 0) >= -0.08;
    const leftColor = adaptEyeShadowColor(look.eye, leftTone, warmSafe);
    const rightColor = adaptEyeShadowColor(look.eye, rightTone, warmSafe);
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
      const opacity = clamp(look.eyeIntensity * qualityOpacity * makeupVisibilityMultiplier(tone, preferences.existingMakeup) * eyeBoost * sideOpacity * darkSceneFactor, 0, 1);
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

  function drawClosedPath(points) {
    drawClosedPathOn(ctx, points);
  }

  function drawClosedPathOn(targetCtx, points) {
    if (!points.length) return;
    targetCtx.beginPath();
    addClosedSubpathOn(targetCtx, points);
  }

  function addClosedSubpathOn(targetCtx, points) {
    if (!points.length) return;
    targetCtx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      targetCtx.lineTo(points[index].x, points[index].y);
    }
    targetCtx.closePath();
  }

  function drawOpenPath(points) {
    drawOpenPathOn(ctx, points);
  }

  function drawOpenPathOn(targetCtx, points) {
    if (!points.length) return;
    targetCtx.beginPath();
    targetCtx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      targetCtx.lineTo(points[index].x, points[index].y);
    }
  }

  function cheekContourPath({ center, eye, nose, outer, mouth, jaw, radiusX, radiusY }) {
    const outwardDirection = outer.x < nose.x ? -1 : 1;
    return [
      movePoint(mixPoints(center, eye, 0.32), { x: outwardDirection * radiusX * 0.05, y: -radiusY * 0.32 }),
      movePoint(mixPoints(center, outer, 0.48), { x: 0, y: -radiusY * 0.42 }),
      movePoint(mixPoints(center, outer, 0.88), { x: 0, y: radiusY * 0.06 }),
      movePoint(mixPoints(center, jaw, 0.32), { x: outwardDirection * radiusX * 0.08, y: radiusY * 0.34 }),
      movePoint(mixPoints(center, mouth, 0.3), { x: 0, y: radiusY * 0.38 }),
      movePoint(mixPoints(center, nose, 0.42), { x: -outwardDirection * radiusX * 0.04, y: radiusY * 0.08 }),
    ];
  }

  function drawContouredBlush(center, radiusX, radiusY, rotation, color, intensity, contour, outwardDirection) {
    ensureMakeupLayer();
    makeupLayerCtx.clearRect(0, 0, makeupLayer.width, makeupLayer.height);
    drawBlushCloudOn(
      makeupLayerCtx,
      center.x,
      center.y,
      radiusX,
      radiusY,
      rotation,
      color,
      intensity,
      outwardDirection,
      true
    );

    makeupLayerCtx.save();
    makeupLayerCtx.globalCompositeOperation = "destination-in";
    makeupLayerCtx.fillStyle = "rgba(0, 0, 0, 1)";
    makeupLayerCtx.filter = `blur(${clamp(Math.min(radiusX, radiusY) * 0.2, 1.2, 6)}px)`;
    drawClosedPathOn(makeupLayerCtx, contour);
    makeupLayerCtx.fill();
    makeupLayerCtx.restore();
    ctx.drawImage(makeupLayer, 0, 0);
  }

  function drawBlushCloud(x, y, radiusX, radiusY, rotation, color, intensity) {
    drawBlushCloudOn(ctx, x, y, radiusX, radiusY, rotation, color, intensity);
  }

  function drawBlushCloudOn(
    targetCtx,
    x,
    y,
    radiusX,
    radiusY,
    rotation,
    color,
    intensity,
    outwardDirection = 1,
    contoured = false
  ) {
    const lobes = contoured
      ? [
          { x: -0.16, y: 0.01, radiusX: 0.74, radiusY: 0.86, intensity: 0.4 },
          { x: 0.04, y: 0, radiusX: 1, radiusY: 1, intensity: 0.82 },
          { x: 0.36, y: 0.05, radiusX: 0.72, radiusY: 0.8, intensity: 0.34 },
        ]
      : [
          { x: -0.18, y: -0.04, radiusX: 0.82, radiusY: 0.9, intensity: 0.54 },
          { x: 0.08, y: 0.02, radiusX: 1, radiusY: 1, intensity: 0.68 },
          { x: 0.34, y: 0.08, radiusX: 0.68, radiusY: 0.82, intensity: 0.42 },
        ];
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    for (const lobe of lobes) {
      const localX = radiusX * lobe.x * outwardDirection;
      const localY = radiusY * lobe.y;
      drawSoftEllipseOn(
        targetCtx,
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

  function drawSoftEllipseOn(targetCtx, x, y, radiusX, radiusY, rotation, color, intensity) {
    if (radiusX <= 0 || radiusY <= 0 || intensity <= 0) return;
    targetCtx.save();
    targetCtx.translate(x, y);
    targetCtx.rotate(rotation);
    targetCtx.scale(radiusX, radiusY);
    const gradient = targetCtx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, colorWithAlpha(color, intensity * 0.42));
    gradient.addColorStop(0.34, colorWithAlpha(color, intensity * 0.31));
    gradient.addColorStop(0.68, colorWithAlpha(color, intensity * 0.105));
    gradient.addColorStop(0.9, colorWithAlpha(color, intensity * 0.024));
    gradient.addColorStop(1, colorWithAlpha(color, 0));
    targetCtx.fillStyle = gradient;
    targetCtx.beginPath();
    targetCtx.arc(0, 0, 1, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.restore();
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
    if (makeupLayer.width !== canvas.width || makeupLayer.height !== canvas.height) {
      makeupLayer.width = canvas.width;
      makeupLayer.height = canvas.height;
    }
  }

  function sampleToneFromPoints(points, padding = 10) {
    if (!points.length || canvas.width <= 1 || canvas.height <= 1) return neutralTone();

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

  function sampleToneFromEllipse(center, radiusX, radiusY, rotation) {
    if (canvas.width <= 1 || canvas.height <= 1) return neutralTone();
    const padding = Math.max(radiusX, radiusY) * 1.05;
    const bounds = getBounds([center], padding);
    try {
      const pixels = ctx.getImageData(bounds.x, bounds.y, bounds.width, bounds.height).data;
      const step = Math.max(1, Math.floor(Math.sqrt((bounds.width * bounds.height) / 900)));
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;

      for (let y = 0; y < bounds.height; y += step) {
        for (let x = 0; x < bounds.width; x += step) {
          const dx = bounds.x + x - center.x;
          const dy = bounds.y + y - center.y;
          const localX = (dx * cos + dy * sin) / Math.max(radiusX, 1);
          const localY = (-dx * sin + dy * cos) / Math.max(radiusY, 1);
          if (localX * localX + localY * localY > 1) continue;
          const offset = (y * bounds.width + x) * 4;
          const red = pixels[offset];
          const green = pixels[offset + 1];
          const blue = pixels[offset + 2];
          const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
          if (luminance < 0.05 || luminance > 0.96) continue;
          r += red;
          g += green;
          b += blue;
          count += 1;
        }
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
    if (canvas.width <= 1 || canvas.height <= 1) {
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
    const xs = points.map((item) => item.x);
    const ys = points.map((item) => item.y);
    const xMin = Math.floor(clamp(Math.min(...xs) - padding, 0, canvas.width - 1));
    const yMin = Math.floor(clamp(Math.min(...ys) - padding, 0, canvas.height - 1));
    const xMax = Math.ceil(clamp(Math.max(...xs) + padding, 0, canvas.width));
    const yMax = Math.ceil(clamp(Math.max(...ys) + padding, 0, canvas.height));
    return {
      x: xMin,
      y: yMin,
      width: Math.max(1, xMax - xMin),
      height: Math.max(1, yMax - yMin),
    };
  }

  function eyeLidShadowPath(indices, landmarks, mirrored, lift) {
    const lid = indices.map((index) => point(landmarks[index], mirrored));
    const raised = lid.map((item) => raise(item, -lift));
    return [...raised, ...lid.slice().reverse()];
  }

  function point(landmark, mirrored) {
    const x = (mirrored ? 1 - landmark.x : landmark.x) * canvas.width;
    const y = landmark.y * canvas.height;
    return { x, y };
  }

  return {
    renderMakeupLayers,
    drawLips,
    drawBlush,
    drawEyeShadow,
  };
}

function createLayerCanvas(canvas) {
  const layer = canvas.ownerDocument?.createElement?.("canvas")
    ?? (typeof OffscreenCanvas === "function" ? new OffscreenCanvas(1, 1) : null);
  if (!layer) throw new Error("A canvas ownerDocument or OffscreenCanvas is required");
  return layer;
}
