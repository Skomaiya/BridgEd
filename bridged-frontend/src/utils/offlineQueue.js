const DB_NAME = 'BridgEdOfflineQueue';
const STORE_NAME = 'offline_queue';
const DB_VERSION = 1;
const MAX_QUEUE_SIZE = 30;

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function enqueue(item) {
  const id = generateId();
  const record = {
    id,
    method: (item.method || 'GET').toUpperCase(),
    url: item.url,
    body: item.body,
    headers: item.headers || {},
    createdAt: Date.now(),
  };
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('createdAt');
      const getAllReq = index.getAll();
      getAllReq.onsuccess = () => {
        const items = getAllReq.result || [];
        if (items.length >= MAX_QUEUE_SIZE) {
          const toRemove = items.length - MAX_QUEUE_SIZE + 1;
          items.slice(0, toRemove).forEach((row) => store.delete(row.id));
        }
        store.add(record);
      };
      tx.oncomplete = () => resolve({ id });
      tx.onerror = () => reject(tx.error);
    });
  }).then(() => ({ id }));
}

export function getAll() {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('createdAt');
      const req = index.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  });
}

export function getCount() {
  return getAll().then((arr) => arr.length);
}

export function remove(id) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

export function clear() {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

function sendOne(item) {
  const { method, url, body, headers } = item;
  const init = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  if (body !== undefined && body !== null && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  return fetch(url, init).then(
    (res) => {
      if (res.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.reload();
        return { ok: false, remove: true };
      }
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        return { ok: res.ok, remove: true };
      }
      return { ok: false, remove: false };
    },
    () => ({ ok: false, remove: false })
  );
}

export function drain(onProgress) {
  return getAll().then((items) => {
    if (items.length === 0) return { synced: 0, failed: 0 };
    let synced = 0;
    let failed = 0;
    const run = (index) => {
      if (index >= items.length) return Promise.resolve();
      const item = items[index];
      if (onProgress) onProgress({ pending: items.length - index, synced, failed });
      return sendOne(item).then(({ ok, remove }) => {
        if (remove) {
          return remove(item.id).then(() => {
            if (ok) synced++;
            else failed++;
            if (onProgress) onProgress({ pending: items.length - index - 1, synced, failed });
            return run(index + 1);
          });
        }
        return run(index + 1);
      });
    };
    return run(0).then(() => ({ synced, failed }));
  });
}
