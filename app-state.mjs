const baseState = {
  mode: "idle",
  running: false,
  modelState: "loading",
  beautyEnabled: true,
  activeLook: null,
  activeRecommendation: null,
  profileSignals: null,
  renderDiagnostics: null,
};

export function createInitialAppState(overrides = {}) {
  return cloneValue({ ...baseState, ...overrides });
}

// Keep only cloneable product state here. MediaPipe, Image and RAF handles remain
// owned by the browser controller rather than becoming shared application state.
export function createAppState(initialState = createInitialAppState()) {
  let state = cloneValue(initialState);
  let snapshot = immutableSnapshot(state);
  const listeners = new Set();

  return {
    getState() {
      return snapshot;
    },

    update(patchOrUpdater) {
      const patch =
        typeof patchOrUpdater === "function"
          ? patchOrUpdater(snapshot)
          : patchOrUpdater;

      if (!isPlainObject(patch)) {
        throw new TypeError("State update must be a plain object or updater function");
      }

      const nextState = { ...state };
      const changedKeys = [];
      for (const [key, value] of Object.entries(patch)) {
        if (valuesEqual(state[key], value)) continue;
        nextState[key] = cloneValue(value);
        changedKeys.push(key);
      }

      if (changedKeys.length === 0) return false;

      const previousSnapshot = snapshot;
      state = nextState;
      snapshot = immutableSnapshot(state);
      for (const listener of [...listeners]) {
        listener(snapshot, previousSnapshot, changedKeys);
      }
      return true;
    },

    subscribe(listener) {
      if (typeof listener !== "function") {
        throw new TypeError("State listener must be a function");
      }
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function immutableSnapshot(value) {
  return deepFreeze(cloneValue(value));
}

function cloneValue(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  if (Array.isArray(value)) return value.map(cloneValue);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)])
  );
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const entry of Object.values(value)) deepFreeze(entry);
  return value;
}

function valuesEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((entry, index) => valuesEqual(entry, right[index]))
    );
  }
  if (!isPlainObject(left) || !isPlainObject(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) => Object.hasOwn(right, key) && valuesEqual(left[key], right[key])
    )
  );
}

function isPlainObject(value) {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
