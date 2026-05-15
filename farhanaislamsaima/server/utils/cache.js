const store = new Map();

function getCache(key) {
  const item = store.get(key);

  if (!item) {
    return null;
  }

  if (Date.now() > item.expiresAt) {
    store.delete(key);
    return null;
  }

  return item.value;
}

function setCache(key, value, ttlMs = 30000) {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  });
}

function clearCache(prefix = '') {
  for (const key of store.keys()) {
    if (!prefix || key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

module.exports = {
  clearCache,
  getCache,
  setCache
};
