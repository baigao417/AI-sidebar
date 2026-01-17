const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__AISB_BRIDGE', {
  send: (payload) => {
    try {
      ipcRenderer.send('aisb-bridge', payload);
    } catch (e) {
      console.error('[BrowserView Preload] Send error:', e);
    }
  },
  onMessage: (callback) => {
    ipcRenderer.on('aisb-bridge-message', (event, payload) => {
      try {
        callback(payload);
      } catch (e) {
        console.error('[BrowserView Preload] Callback error:', e);
      }
    });
  }
});

// Also expose a simplified console for debugging if needed
contextBridge.exposeInMainWorld('__AISB_LOG', {
  log: (...args) => console.log('[Content]', ...args),
  warn: (...args) => console.warn('[Content]', ...args),
  error: (...args) => console.error('[Content]', ...args)
});
