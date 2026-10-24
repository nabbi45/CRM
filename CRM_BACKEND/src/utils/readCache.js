// Small, process-local read cache. It never caches authorization or mutations.
// A generation prevents an in-flight read from repopulating after a write.
const entries = new Map();
let generation = 0;
export const readCacheGeneration = () => generation;
export function invalidateReadCaches() {
  generation++;
  entries.clear();
}
export function cachedRead(key, load, ttlMs = 15000) {
  const current = entries.get(key);
  if (current && (current.pending || current.expires > Date.now())) return current.promise;
  if (entries.size >= 128) entries.delete(entries.keys().next().value);
  const epoch = generation;
  const entry = { pending: true, expires: 0 };
  entry.promise = Promise.resolve().then(load).then((result) => {
    entry.pending = false;
    entry.expires = Date.now() + ttlMs;
    if (epoch !== generation && entries.get(key) === entry) entries.delete(key);
    return result;
  }).catch((error) => {
    if (entries.get(key) === entry) entries.delete(key);
    throw error;
  });
  entries.set(key, entry);
  return entry.promise;
}
export function invalidateReadsAfterWrite(req, res, next) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      /^\/(booking(?:\/|$)|booking-approvals(?:\/|$)|user(?:\/|$)|services(?:\/|$)|employee(?:\/|$))/.test(req.path) &&
      !/^\/user\/(?:ping|login|logout)(?:\/|$)/.test(req.path)) {
    res.on('finish', () => { if (res.statusCode < 400) invalidateReadCaches(); });
  }
  next();
}
