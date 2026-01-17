// Prompt Manager DB (IndexedDB)
(function () {
  const DB_NAME = 'AISidebarPromptsDB';
  const STORE_PROMPTS = 'prompts';
  const DB_VERSION = 1;

  let db = null;

  function openDb() {
    if (db) return Promise.resolve(db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE_PROMPTS)) {
          const os = d.createObjectStore(STORE_PROMPTS, { keyPath: 'id' });
          os.createIndex('category', 'category', { unique: false });
        }
      };
      req.onsuccess = () => { db = req.result; resolve(db); };
    });
  }

  async function withStore(mode, fn) {
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const tx = d.transaction([STORE_PROMPTS], mode);
      const os = tx.objectStore(STORE_PROMPTS);
      const res = fn(os);
      tx.oncomplete = () => resolve(res);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getAll() {
    return withStore('readonly', (os) => new Promise((resolve) => {
      const req = os.getAll();
      req.onsuccess = () => resolve(req.result || []);
    }));
  }
  
  async function getModes() {
    const all = await getAll();
    const modes = new Set();
    all.forEach(p => {
      if (p.category) modes.add(p.category);
    });
    // Ensure "General" exists if there are no modes, or just return what we have
    if (modes.size === 0) modes.add('General');
    return Array.from(modes).sort();
  }

  async function add(prompt) {
    const p = {
      id: prompt.id || 'p_' + Date.now() + Math.random().toString(36).substr(2, 5),
      title: prompt.title || 'Untitled',
      content: prompt.content || '',
      category: prompt.category || 'General',
      updatedAt: Date.now()
    };
    await withStore('readwrite', (os) => os.put(p));
    return p;
  }

  async function update(prompt) {
    if (!prompt.id) return add(prompt);
    prompt.updatedAt = Date.now();
    await withStore('readwrite', (os) => os.put(prompt));
    return prompt;
  }

  async function remove(id) {
    await withStore('readwrite', (os) => os.delete(id));
  }
  
  async function bulkAdd(prompts) {
    if (!Array.isArray(prompts) || prompts.length === 0) return;
    const timestamp = Date.now();
    await withStore('readwrite', (os) => {
       prompts.forEach((p, idx) => {
         const item = {
           id: 'p_' + (timestamp + idx) + Math.random().toString(36).substr(2, 5),
           title: p.title || 'Untitled',
           content: p.content || '',
           category: p.category || 'General',
           updatedAt: timestamp
         };
         os.put(item);
       });
    });
  }

  window.PromptDB = {
    getAll, getModes, add, update, remove, bulkAdd
  };
})();
