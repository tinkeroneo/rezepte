// src/services/locks.js
// Simple in-memory mutex by key to avoid parallel operations (double-click etc.)
const locks = new Map();

export async function runExclusive(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  let release;
  const next = new Promise((res) => (release = res));
  locks.set(key, prev.then(() => next));

  try {
    await prev;
    return await fn();
  } finally {
    release();
    // cleanup when this is the tail
    if (locks.get(key) === next) locks.delete(key);
  }
}
