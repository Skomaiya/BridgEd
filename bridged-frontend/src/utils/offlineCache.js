const PREFIX = 'bridged_cache_';

function storageKey(key) {
  return PREFIX + key;
}

export function getCached(key) {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey(key)) : null;
    if (!raw) return Promise.resolve(null);
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.cachedAt === 'number') return Promise.resolve(parsed);
    return Promise.resolve(null);
  } catch {
    return Promise.resolve(null);
  }
}

export function setCached(key, data) {
  try {
    const entry = { data, cachedAt: Date.now() };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey(key), JSON.stringify(entry));
    }
  } catch (_) {}
}

export const CACHE_KEYS = {
  student_profile: 'student_profile',
  student_match: 'student_match',
  employer_profile: 'employer_profile',
  employer_my_jobs: 'employer_my_jobs',
  employer_matches: 'employer_matches',
  notifications: 'notifications',
};

export function clearAll() {
  try {
    if (typeof localStorage === 'undefined') return;
    const keys = Object.values(CACHE_KEYS).map((k) => storageKey(k));
    keys.forEach((k) => localStorage.removeItem(k));
  } catch (_) {}
}
