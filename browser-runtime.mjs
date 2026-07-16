export function isIosDevice(navigatorLike = globalThis.navigator) {
  const userAgent = navigatorLike?.userAgent ?? "";
  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (navigatorLike?.platform === "MacIntel" && navigatorLike?.maxTouchPoints > 1)
  );
}

export function isEmbeddedIosBrowser(navigatorLike = globalThis.navigator) {
  if (!isIosDevice(navigatorLike)) return false;
  return !/Version\/[\d.]+.*Safari/.test(navigatorLike?.userAgent ?? "");
}

export function delegateOrderFor(navigatorLike = globalThis.navigator) {
  return isEmbeddedIosBrowser(navigatorLike) ? ["CPU", "GPU"] : ["GPU", "CPU"];
}

export async function createCompatibleFaceLandmarker({
  FaceLandmarker,
  filesetResolver,
  modelAssetPath,
  navigatorLike = globalThis.navigator,
  onDelegate = () => {},
  onError = (delegate, error) => console.warn(`MediaPipe ${delegate} delegate failed`, error),
}) {
  let lastError;

  for (const delegate of delegateOrderFor(navigatorLike)) {
    try {
      onDelegate(delegate);
      const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath,
          delegate,
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: "VIDEO",
        numFaces: 1,
      });
      return { landmarker, delegate };
    } catch (error) {
      onError(delegate, error);
      lastError = error;
    }
  }

  throw lastError || new Error("MediaPipe could not be initialized");
}
