const cameraConstraints = Object.freeze({
  video: {
    facingMode: "user",
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
  audio: false,
});

export function describeCameraFailure(error) {
  switch (error?.name) {
    case "NotAllowedError":
      return {
        status: "摄像头未授权",
        guidance: "请在浏览器设置中允许摄像头权限，或改用上传照片继续测试。",
      };
    case "NotFoundError":
      return {
        status: "未找到摄像头",
        guidance: "当前设备没有可用摄像头，可以改用上传照片继续测试。",
      };
    case "NotReadableError":
      return {
        status: "摄像头正被占用",
        guidance: "请关闭其他正在使用摄像头的应用，然后重试；也可以改用上传照片。",
      };
    case "SecurityError":
    case "NotSupportedError":
      return {
        status: "浏览器不支持摄像头",
        guidance: "请使用 Safari 或 Chrome 打开 HTTPS 页面，或改用上传照片继续测试。",
      };
    default:
      return {
        status: "摄像头不可用",
        guidance: "摄像头不可用。可以改用上传照片继续测试。",
      };
  }
}

export function createMediaController({
  appState,
  video,
  getFaceLandmarker,
  onCameraFrame,
  onPhotoFrame,
  mediaDevices = globalThis.navigator?.mediaDevices,
  requestFrame = (callback) => globalThis.requestAnimationFrame(callback),
  cancelFrame = (id) => globalThis.cancelAnimationFrame(id),
  now = () => globalThis.performance.now(),
  imageFactory = () => new globalThis.Image(),
  createObjectUrl = (file) => globalThis.URL.createObjectURL(file),
  revokeObjectUrl = (url) => globalThis.URL.revokeObjectURL(url),
  currentDataReadyState = 2,
}) {
  let generation = 0;
  let rafId = null;
  let photoImage = null;
  let lastVideoTime = -1;
  let lastCameraResults = null;
  let latestPhotoRequest = 0;
  let landmarkerModeQueue = Promise.resolve();

  async function startCamera() {
    const operation = beginOperation("camera");
    photoImage = null;
    lastVideoTime = -1;
    lastCameraResults = null;

    if (!mediaDevices?.getUserMedia) {
      const error = new Error("Camera API is unavailable");
      error.name = "NotSupportedError";
      throw error;
    }

    const stream = await mediaDevices.getUserMedia(cameraConstraints);
    if (!isCurrent(operation, "camera")) {
      stopStream(stream);
      return { started: false };
    }

    video.srcObject = stream;
    try {
      await video.play();
      await landmarkerModeQueue.catch(() => {});
    } catch (error) {
      stopStream(stream);
      if (video.srcObject === stream) video.srcObject = null;
      throw error;
    }

    if (!isCurrent(operation, "camera")) {
      stopStream(stream);
      if (video.srcObject === stream) video.srcObject = null;
      return { started: false };
    }

    appState.update({ running: true });
    scheduleCameraFrame();
    return { started: true, stream };
  }

  async function loadPhotoFile(file) {
    const objectUrl = createObjectUrl(file);
    try {
      return await loadPhotoSource(objectUrl);
    } finally {
      revokeObjectUrl(objectUrl);
    }
  }

  async function loadPhotoSource(source) {
    const operation = beginOperation("photo");
    photoImage = null;
    const image = await loadImage(source);
    if (!isCurrent(operation, "photo")) return { loaded: false };
    photoImage = image;
    return redrawPhoto();
  }

  async function redrawPhoto() {
    if (!photoImage || appState.getState().mode !== "photo") {
      return { loaded: false };
    }
    const image = photoImage;
    const request = ++latestPhotoRequest;
    const results = await detectPhoto(image);
    if (
      request !== latestPhotoRequest ||
      image !== photoImage ||
      appState.getState().mode !== "photo"
    ) {
      return { loaded: false };
    }
    await onPhotoFrame({ image, results });
    return { loaded: true, image, results };
  }

  function stop() {
    generation += 1;
    latestPhotoRequest += 1;
    stopLoop();
    stopCameraTracks();
  }

  function clearPhoto() {
    photoImage = null;
    latestPhotoRequest += 1;
  }

  function beginOperation(mode) {
    stop();
    const operation = generation;
    appState.update({ mode, running: false });
    return operation;
  }

  function isCurrent(operation, mode) {
    return operation === generation && appState.getState().mode === mode;
  }

  function scheduleCameraFrame() {
    rafId = requestFrame(loopCamera);
  }

  function loopCamera() {
    if (!appState.getState().running || appState.getState().mode !== "camera") return;

    if (video.readyState >= currentDataReadyState) {
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        lastCameraResults = getFaceLandmarker().detectForVideo(video, now());
      }
      onCameraFrame({ video, results: lastCameraResults });
    }

    scheduleCameraFrame();
  }

  function stopLoop() {
    appState.update({ running: false });
    if (rafId != null) cancelFrame(rafId);
    rafId = null;
  }

  function stopCameraTracks() {
    const stream = video.srcObject;
    if (stream) stopStream(stream);
    video.srcObject = null;
  }

  function detectPhoto(image) {
    const run = landmarkerModeQueue.catch(() => {}).then(async () => {
      const landmarker = getFaceLandmarker();
      await landmarker.setOptions({ runningMode: "IMAGE" });
      try {
        return landmarker.detect(image);
      } finally {
        await landmarker.setOptions({ runningMode: "VIDEO" });
      }
    });
    landmarkerModeQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = imageFactory();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Photo could not be loaded"));
      image.src = source;
    });
  }

  return {
    startCamera,
    loadPhotoFile,
    loadPhotoSource,
    redrawPhoto,
    stop,
    clearPhoto,
  };
}

function stopStream(stream) {
  stream.getTracks().forEach((track) => track.stop());
}
