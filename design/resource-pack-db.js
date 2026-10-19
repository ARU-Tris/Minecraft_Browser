(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CraftPackDB = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const NAME = 'craftside:resource-packs:v1';
  const empty = () => ({ schema: 1, revision: 0, packs: [], active: [] });
  function create(indexedDB) {
    let connection;
    function open() {
      if (!indexedDB) return Promise.reject(Error('Resource pack storage is unavailable. Your current resources were kept.'));
      if (!connection) connection = new Promise((resolve, reject) => {
        const request = indexedDB.open(NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('state');
        request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); connection = null; }; resolve(db); };
        request.onerror = () => { connection = null; reject(Error('Could not open resource pack storage. Your current resources were kept.')); };
        request.onblocked = () => { connection = null; reject(Error('Close other resource pack settings and try again.')); };
      });
      return connection;
    }
    async function read() {
      const db = await open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('state', 'readonly'), request = transaction.objectStore('state').get('library'); let result;
        request.onsuccess = () => { result = request.result ?? empty(); };
        transaction.oncomplete = () => {
          if (result?.schema !== 1 || !Number.isSafeInteger(result.revision) || result.revision < 0 || !Array.isArray(result.packs) || !Array.isArray(result.active)) reject(Error('Saved resource packs are damaged. Your existing data was kept.'));
          else resolve(result);
        };
        transaction.onabort = transaction.onerror = () => reject(Error('Could not read resource pack storage. Your existing data was kept.'));
      });
    }
    async function write(next, expected) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('state', 'readwrite'), store = transaction.objectStore('state'), request = store.get('library'); let conflict = false;
        const result = { ...next, schema: 1, revision: expected + 1 };
        request.onsuccess = () => {
          const current = request.result ?? empty();
          if (current.revision !== expected) { conflict = true; transaction.abort(); return; }
          try { store.put(result, 'library'); } catch { transaction.abort(); }
        };
        transaction.oncomplete = () => resolve(result);
        transaction.onabort = transaction.onerror = () => reject(Error(conflict ? 'Resource packs changed in another window. Reopen this screen to reload them.' : 'Could not save resource packs. Your current resources were kept.'));
      });
    }
    return { read, write };
  }
  return { name: NAME, empty, create };
});
