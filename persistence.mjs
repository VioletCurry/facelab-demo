function resolveStorage(storage) {
  return storage ?? globalThis.localStorage;
}

function report(onError, operation, key, error) {
  onError(`Unable to ${operation} ${key}`, error);
}

export function createArrayStore(
  key,
  { limit = Infinity, storage, onError = console.warn } = {}
) {
  return {
    read() {
      try {
        const value = JSON.parse(resolveStorage(storage).getItem(key) || "[]");
        return Array.isArray(value) ? value : [];
      } catch (error) {
        report(onError, "read", key, error);
        return [];
      }
    },
    write(items) {
      try {
        const value = Number.isFinite(limit) ? items.slice(-limit) : items;
        resolveStorage(storage).setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        report(onError, "save", key, error);
        return false;
      }
    },
    clear() {
      try {
        resolveStorage(storage).removeItem(key);
        return true;
      } catch (error) {
        report(onError, "clear", key, error);
        return false;
      }
    },
  };
}

export function createObjectStore(key, { storage, onError = console.warn } = {}) {
  return {
    read() {
      try {
        const value = JSON.parse(resolveStorage(storage).getItem(key) || "null");
        return value && typeof value === "object" && !Array.isArray(value) ? value : null;
      } catch (error) {
        report(onError, "read", key, error);
        return null;
      }
    },
    write(value) {
      try {
        resolveStorage(storage).setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        report(onError, "save", key, error);
        return false;
      }
    },
    clear() {
      try {
        resolveStorage(storage).removeItem(key);
        return true;
      } catch (error) {
        report(onError, "clear", key, error);
        return false;
      }
    },
  };
}

export function clearStores(stores) {
  return stores.every((store) => store.clear());
}
