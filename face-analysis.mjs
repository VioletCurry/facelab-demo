import { average, clamp, distance, mapRange } from "./render/geometry.mjs";

export function landmarkToCanvas(landmark, mirrored, canvasSize) {
  const x = (mirrored ? 1 - landmark.x : landmark.x) * canvasSize.width;
  const y = landmark.y * canvasSize.height;
  return { x, y };
}

export function measureFacePose({ landmarks, mirrored = false, canvasSize }) {
  const point = (landmark) => landmarkToCanvas(landmark, mirrored, canvasSize);
  const leftCheek = point(landmarks[234]);
  const rightCheek = point(landmarks[454]);
  const nose = point(landmarks[1] ?? landmarks[4]);
  const faceWidth = Math.max(1, distance(leftCheek, rightCheek));
  const centerX = (leftCheek.x + rightCheek.x) / 2;
  const mouthWidth = Math.max(1, distance(point(landmarks[61]), point(landmarks[291])));
  const mouthOpen = distance(point(landmarks[13]), point(landmarks[14])) / mouthWidth;
  const leftVisibility = distance(nose, leftCheek) / faceWidth;
  const rightVisibility = distance(nose, rightCheek) / faceWidth;

  return {
    yaw: Math.abs(nose.x - centerX) / faceWidth,
    mouthOpen,
    visibleSide: leftVisibility >= rightVisibility ? "left" : "right",
  };
}

export function estimateFaceQuality({ landmarks, mirrored = false, canvasSize, pose }) {
  const measuredPose = pose ?? measureFacePose({ landmarks, mirrored, canvasSize });
  const point = (landmark) => landmarkToCanvas(landmark, mirrored, canvasSize);
  const leftCheek = point(landmarks[234]);
  const rightCheek = point(landmarks[454]);
  const chin = point(landmarks[152]);
  const forehead = point(landmarks[10]);
  const faceWidth = Math.max(1, distance(leftCheek, rightCheek));
  const faceHeight = Math.max(1, distance(chin, forehead));
  const sizeScore = clamp(faceWidth / (canvasSize.width * 0.22), 0, 1);
  const proportionScore = clamp(faceHeight / faceWidth / 1.15, 0, 1);
  const yawScore = clamp(1 - mapRange(measuredPose.yaw, 0.04, 0.22, 0, 0.72), 0.28, 1);

  return clamp(sizeScore * 0.4 + proportionScore * 0.2 + yawScore * 0.4, 0, 1);
}

export function smoothFaceLandmarks({ rawLandmarks, previousLandmarks, lastQuality = 0 }) {
  if (!previousLandmarks || previousLandmarks.length !== rawLandmarks.length) {
    return {
      landmarks: rawLandmarks.map((landmark) => ({ ...landmark })),
      motion: 0,
      smoothing: null,
    };
  }

  const anchorIndices = [1, 33, 263, 61, 291, 152];
  const faceWidth = Math.max(
    0.001,
    Math.hypot(rawLandmarks[234].x - rawLandmarks[454].x, rawLandmarks[234].y - rawLandmarks[454].y)
  );
  const motion = average(
    anchorIndices.map((index) => {
      const previous = previousLandmarks[index] ?? rawLandmarks[index];
      const current = rawLandmarks[index];
      return Math.hypot(previous.x - current.x, previous.y - current.y) / faceWidth;
    })
  );
  const smoothing = motion > 0.022 ? 0.5 : lastQuality < 0.55 ? 0.74 : 0.68;
  const landmarks = rawLandmarks.map((landmark, index) => {
    const previous = previousLandmarks[index] ?? landmark;
    return {
      x: previous.x * smoothing + landmark.x * (1 - smoothing),
      y: previous.y * smoothing + landmark.y * (1 - smoothing),
      z: (previous.z ?? 0) * smoothing + (landmark.z ?? 0) * (1 - smoothing),
    };
  });

  return { landmarks, motion, smoothing };
}

export function realtimeMakeupMultiplier({ mode, landmarkMotion, pose }) {
  if (mode !== "camera") return 1;
  const movementComfort = clamp(mapRange(landmarkMotion, 0.004, 0.038, 1, 0.56), 0.56, 1);
  const poseComfort = clamp(
    mapRange(Math.max(pose.yaw ?? 0, pose.mouthOpen ?? 0), 0.04, 0.24, 1, 0.72),
    0.72,
    1
  );
  return clamp(0.8 * movementComfort * poseComfort, 0.42, 0.8);
}
