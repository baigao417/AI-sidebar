// Robust URL + title reporter for provider iframes (ChatGPT, Gemini, etc.)
// Posts { type: 'ai-url-changed', href, title, origin } to the top window.

(function () {
  try {
    const dbg = (...args) => {
      try {
        if (localStorage.getItem('insidebar_debug') === '1' || localStorage.getItem('insidebar_debug_gemini') === '1') {
          console.log('[insidebar][url-sync]', ...args);
        }
      } catch (_) {}
    };

    // Helper: Send message to host
    const sendMessageToHost = (payload) => {
      try {
        if (window.__AISB_BRIDGE && typeof window.__AISB_BRIDGE.send === 'function') {
          window.__AISB_BRIDGE.send(payload);
        } else if (window.top) {
           window.top.postMessage(payload, '*');
        } else if (window.parent) {
           window.parent.postMessage(payload, '*');
        }
      } catch (e) {
        console.error('sendMessageToHost error:', e);
      }
    };

    // BFS across DOM
    const deepFind = (root, predicate, max = 500) => {
      try {
        const q = [root];
        let seen = 0;
        const startTime = Date.now();
        while (q.length && seen < max) {
          if (Date.now() - startTime > 10) break;
          const n = q.shift();
          seen++;
          if (!n) continue;
          try { if (predicate(n)) return n; } catch (_) {}
          try { if (n.shadowRoot) q.push(n.shadowRoot); } catch (_) {}
          try { if (n.children && n.children.length) q.push(...n.children); } catch (_) {}
        }
      } catch (_) {}
      return null;
    };

    // Gemini helpers
    const resolveGeminiHref = () => {
      try {
        if (location.origin !== 'https://gemini.google.com') return null;
        const anchor = deepFind(document, (el) => {
          if (!(el && el.tagName === 'A')) return false;
          const h = el.getAttribute('href') || '';
          if (!h) return false;
          const abs = h.startsWith('http') ? h : new URL(h, location.origin).href;
          return /^https:\/\/gemini\.google\.com\/app\//.test(abs) && abs !== 'https://gemini.google.com/app';
        });
        if (anchor) {
          const h = anchor.getAttribute('href');
          const abs = h && h.startsWith('http') ? h : (h ? new URL(h, location.origin).href : '');
          return abs || null;
        }
        const share = deepFind(document, (n)=> n && (n.getAttribute && (n.getAttribute('data-clipboard-text') || n.getAttribute('data-share-url'))));
        if (share) {
          const v = share.getAttribute('data-clipboard-text') || share.getAttribute('data-share-url');
          if (v && /^https:\/\/gemini\.google\.com\/app\//.test(v)) return v;
        }
      } catch (_) {}
      return null;
    };
    const geminiIdFromUrl = (uStr) => {
      try {
        const u = new URL(uStr || location.href, location.origin);
        const m = u.pathname.match(/\/app\/(?:conversation\/)?([^\/?#]+)/);
        return m && m[1] ? m[1] : '';
      } catch (_) { return ''; }
    };
    const resolveGeminiTitle = () => {
      try {
        if (location.origin !== 'https://gemini.google.com') return null;
        const canonical = resolveGeminiHref() || location.href;
        const convId = geminiIdFromUrl(canonical);
        const notUseful = (t) => {
          if (!t) return true;
          const s = t.trim().toLowerCase();
          return (
            s.length === 0 ||
            s === 'recent' || s === 'gemini' || s === 'google gemini' ||
            s === 'conversation with gemini' ||
            s === 'new chat' || s === 'start a new chat' ||
            /^(新?聊天|新?对话|最近)$/.test(s)
          );
        };
        if (convId) {
          const link = deepFind(document, (el)=> el && el.tagName === 'A' && (el.getAttribute('href')||'').includes(`/app/${convId}`));
          if (link && link.textContent && !notUseful(link.textContent)) {
            return link.textContent.trim();
          }
        }
        const hasConvTitleClass = (el) => {
          try { return el && el.classList && Array.from(el.classList).some(c => /conversation-title/i.test(c)); } catch (_) { return false; }
        };
        const navScope = deepFind(document, (el)=> el && (el.tagName==='NAV' || el.tagName==='ASIDE' || (el.getAttribute && el.getAttribute('role')==='navigation')));
        if (navScope) {
          const activeTitle = deepFind(navScope, (el)=> {
            if (!hasConvTitleClass(el) || !el.textContent || !el.textContent.trim()) return false;
            const container = el.closest('[aria-selected="true"], [aria-current="page"], [data-active="true"], [data-selected="true"], [class*="active"], [class*="selected"]');
            return !!container;
          });
          if (activeTitle && activeTitle.textContent && !notUseful(activeTitle.textContent)) {
            return activeTitle.textContent.trim();
          }
        }
        const globalTitle = deepFind(document, (el)=> hasConvTitleClass(el) && el.textContent && el.textContent.trim().length > 0);
        if (globalTitle && globalTitle.textContent && !notUseful(globalTitle.textContent)) {
          return globalTitle.textContent.trim();
        }
        return document.title; 
      } catch (_) { return null; }
    };

    // ChatGPT helpers
    const resolveChatGPTTitle = () => {
      try {
        if (location.origin !== 'https://chatgpt.com') return null;
        const h1 = document.querySelector('h1');
        if (h1 && h1.textContent) return h1.textContent.trim();
      } catch (_) {}
      return null;
    };

    // Sender
    let lastSent = '';
    let timer = null;
    const send = (immediate = false, reason = 'tick') => {
      const maybeGemini = resolveGeminiHref();
      const hrefNow = String(maybeGemini || location.href);
      const title = String(resolveGeminiTitle() || resolveChatGPTTitle() || document.title || '');
      const payload = { type: 'ai-url-changed', href: hrefNow, title, origin: String(location.origin) };
      const toSend = JSON.stringify(payload);
      const doPost = () => {
        try {
          sendMessageToHost(payload);
          lastSent = toSend;
        } catch (_) {}
      };
      if (immediate) return doPost();
      if (toSend === lastSent) return;
      clearTimeout(timer);
      timer = setTimeout(doPost, 100);
    };

    // Initial emit
    send(true, 'init');

    // Hook History API
    const wrapHistory = (method) => {
      const orig = history[method];
      if (typeof orig !== 'function') return;
      history[method] = function () {
        const ret = orig.apply(this, arguments);
        try { window.dispatchEvent(new Event('locationchange')); } catch (_) {}
        send(false, method);
        setTimeout(initChatTimeline, 1000); 
        return ret;
      };
    };
    wrapHistory('pushState');
    wrapHistory('replaceState');
    window.addEventListener('popstate', () => {
      send(false, 'popstate');
      setTimeout(initChatTimeline, 1000);
    });
    window.addEventListener('locationchange', () => {
      send(false, 'locationchange');
      setTimeout(initChatTimeline, 1000);
    });

    // Mutation observer for title and DOM
    try {
      if (window.MutationObserver) {
        new MutationObserver(() => send(false, 'title-mutation')).observe(document.querySelector('title') || document.body, { subtree: true, characterData: true, childList: true });
        new MutationObserver(() => {
           send(false, 'dom-mutation');
           initChatTimeline(); 
        }).observe(document.body, { childList: true, subtree: true });
      }
    } catch (_) {}
  } catch (_) {}
})();

// ============== Slash Command Trigger & Picker (Injected) ==============
(function initSlashFeature() {
  function findPromptElement() {
    const els = document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"], .ql-editor');
    let best = null; let maxArea = 0;
    els.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        const area = r.width * r.height;
        if (area > maxArea) { maxArea = area; best = el; }
      }
    });
    return best;
  }

  function triggerPromptManager() {
    if (window.__AISB_BRIDGE && typeof window.__AISB_BRIDGE.send === 'function') {
      window.__AISB_BRIDGE.send({ type: 'trigger-prompt-manager' });
    }
  }

  function insertText(text) {
     const el = findPromptElement();
     if (!el) return;
     el.focus();
     document.execCommand('insertText', false, text);
  }

  const checkInput = () => {
    const el = findPromptElement();
    if (!el || el.dataset.aisbSlashHooked) return;
    el.dataset.aisbSlashHooked = 'true';
    
    // Use keydown to prevent the slash from being typed if we want? 
    // Or input? The requirement says "triggered by / or \".
    // Usually input is better for capturing the char.
    // But if we want to prevent the slash from appearing, we need keydown (and preventDefault).
    // However, user might WANT to type slash.
    // Let's use input for now, and just open the manager.
    // User can continue typing in the manager or back in the editor.
    // If they select a prompt, it inserts.
    
    el.addEventListener('input', (e) => {
      const val = el.value || el.textContent || '';
      const char = e.data || val.slice(-1);
      if (char === '\\' || char === '/') {
         triggerPromptManager();
      }
    });
    
    // Also listen for keydown to support non-input elements or capture earlier?
    // Some editors like Gemini might consume events.
    el.addEventListener('keydown', (e) => {
      if (e.key === '\\' || e.key === '/') {
        // We don't prevent default, just trigger
        // triggerPromptManager(); 
        // Duplicate trigger if input also fires? Let's stick to input for now.
      }
    });
  };
  setInterval(checkInput, 1000);
  
  // Listen for IPC trigger from main process (via "Prompt" button or Insert action)
  if (window.__AISB_BRIDGE && window.__AISB_BRIDGE.onMessage) {
     window.__AISB_BRIDGE.onMessage((payload) => {
        if (payload && payload.type === 'SHOW_SLASH_PICKER') {
           triggerPromptManager();
        }
        if (payload && payload.type === 'INSERT_TEXT') {
           insertText(payload.text);
        }
     });
  }
})();

// ============== In-Chat Timeline Injection (Minimap Style) ==============
(function initChatTimelineWrapper() {
  const isEnabled = true; // Could be controlled by settings
  if (!isEnabled) return;
  
  // Inject CSS from css/timeline.css (inlined here for Electron context simplicity)
  const CSS_TEXT = `
    /* Copied from css/timeline.css */
    :root {
        --timeline-dot-color: #D1D5DB; --timeline-dot-active-color: #10A37F; --timeline-star-color: #F59E0B;
        --timeline-tooltip-bg: #FFFFFF; --timeline-tooltip-text: #1F2937; --timeline-tooltip-border: #E5E7EB;
        --timeline-bar-bg: rgba(240, 240, 240, 0.8);
        --timeline-track-padding: 16px; --timeline-hit-size: 30px; --timeline-dot-size: 12px;
    }
    html.dark { --timeline-dot-color: #555555; --timeline-dot-active-color: #19C37D; --timeline-bar-bg: rgba(50, 50, 50, 0.8); --timeline-tooltip-bg: #2B2B2B; --timeline-tooltip-text: #EAEAEA; }
    
    .chatgpt-timeline-bar { position: fixed; top: 60px; right: 15px; width: 24px; height: calc(100vh - 100px); z-index: 2147483646; display: flex; flex-direction: column; align-items: center; border-radius: 10px; background-color: var(--timeline-bar-bg); backdrop-filter: blur(4px); transition: background-color 0.3s ease; }
    .timeline-track { position: relative; width: 100%; height: 100%; overflow-y: auto; overflow-x: hidden; scrollbar-width: none; }
    .timeline-track-content { position: relative; width: 100%; height: 100%; }
    .timeline-dot { position: absolute; left: 50%; transform: translate(-50%, -50%); width: var(--timeline-hit-size); height: var(--timeline-hit-size); background: transparent; border: none; cursor: pointer; padding: 0; top: calc(var(--timeline-track-padding) + (100% - 2 * var(--timeline-track-padding)) * var(--n, 0)); }
    .timeline-dot::after { content: ''; position: absolute; left: 50%; top: 50%; width: var(--timeline-dot-size); height: var(--timeline-dot-size); transform: translate(-50%, -50%); border-radius: 50%; background-color: var(--timeline-dot-color); transition: transform 0.15s; }
    .timeline-dot:hover::after { transform: translate(-50%, -50%) scale(1.3); }
    .timeline-dot.active::after { box-shadow: 0 0 0 3px var(--timeline-dot-active-color); }
    .timeline-dot.starred::after { background-color: var(--timeline-star-color); }
    .timeline-tooltip { position: fixed; max-width: 280px; background: var(--timeline-tooltip-bg); color: var(--timeline-tooltip-text); padding: 8px 12px; border-radius: 8px; font-size: 12px; pointer-events: none; z-index: 2147483647; opacity: 0; transition: opacity 0.1s; border: 1px solid var(--timeline-tooltip-border); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .timeline-tooltip.visible { opacity: 1; }
  `;

  let styleEl = document.createElement('style');
  styleEl.textContent = CSS_TEXT;
  document.head.appendChild(styleEl);

  // Selector Config
  const CONFIG = {
    chatgpt: { msg: '[data-message-author-role="user"]', scroll: true },
    claude: { msg: 'div[data-testid="user-message"]', scroll: true },
    // Updated selectors based on extension reference
    gemini: { 
      msg: [
        '.user-query-bubble-with-background',
        '.user-query-container.right-align-content',
        'user-query',
        '.user-query-container', 
        'user-query-content', 
        'div[data-is-user-query="true"]'
      ].join(','), 
      scroll: true 
    },
    kimi: { msg: 'div[class*="user-message"], div[class*="UserMessage"]', scroll: true },
    metaso: { msg: 'div[class*="user-message"], div[class*="UserMessage"]', scroll: true },
    dreamline: { msg: 'div.user-message, div.human-message, div[data-role="user"]', scroll: true } // Added DreamLine placeholder
  };

  let currentConfig = null;
  const host = window.location.hostname;
  if (host.includes('chatgpt')) currentConfig = CONFIG.chatgpt;
  else if (host.includes('claude')) currentConfig = CONFIG.claude;
  else if (host.includes('gemini')) currentConfig = CONFIG.gemini;
  else if (host.includes('kimi')) currentConfig = CONFIG.kimi;
  else if (host.includes('metaso')) currentConfig = CONFIG.metaso;
  else if (host.includes('dreamline') || host.includes('dream-line')) currentConfig = CONFIG.dreamline; // Enable for DreamLine

  if (!currentConfig) return;

  // UI Elements
  let bar, track, content, tooltip;
  let markers = [];
  let activeIdx = -1;

  function createUI() {
    if (document.querySelector('.chatgpt-timeline-bar')) return;

    bar = document.createElement('div');
    bar.className = 'chatgpt-timeline-bar';
    
    track = document.createElement('div');
    track.className = 'timeline-track';
    
    content = document.createElement('div');
    content.className = 'timeline-track-content';
    
    tooltip = document.createElement('div');
    tooltip.className = 'timeline-tooltip';
    
    track.appendChild(content);
    bar.appendChild(track);
    document.body.appendChild(bar);
    document.body.appendChild(tooltip);
    
    // Event Delegation
    bar.addEventListener('click', onBarClick);
    bar.addEventListener('mouseover', onBarHover);
    bar.addEventListener('mouseout', onBarOut);
  }

  function getMessages() {
    const config = currentConfig;
    if (!config) return [];
    
    // For Gemini, filter messages that actually contain text
    let els = Array.from(document.querySelectorAll(config.msg));
    
    // Gemini specific filtering (from extension reference)
    if (host.includes('gemini')) {
      els = els.filter(el => {
        try {
          const line = el.querySelector('.query-text .query-text-line');
          if (line && line.textContent && line.textContent.trim().length > 0) return true;
        } catch {}
        try {
          const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
          return t.length > 0;
        } catch { return false; }
      });
    }
    
    return els.filter(el => el.offsetParent !== null);
  }

  function render() {
    if (!content) return;
    const msgs = getMessages();
    // (Rest of render function...)
    if (msgs.length === 0) { content.innerHTML = ''; return; }

    // Check if changed
    if (msgs.length === markers.length && msgs.every((m, i) => markers[i].el === m)) {
       updateActive();
       return; 
    }

    content.innerHTML = '';
    markers = msgs.map((el, i) => ({ el, index: i, text: el.textContent.substring(0, 100) }));
    
    // For mapping, we need the scroll container height and total height.
    // Assuming window scroll for now (standard across most providers except complex ones).
    // Some providers like Gemini use specific scroll containers.
    
    // Find robust scroll container for Gemini
    let scrollContainer = window;
    if (host.includes('gemini')) {
       // Try extension selectors first
       const primary = document.querySelector('#chat-history.chat-history-scroll-container');
       const alt = document.querySelector('[data-test-id="chat-history-container"].chat-history');
       if (primary && primary.scrollHeight > primary.clientHeight) scrollContainer = primary;
       else if (alt && alt.scrollHeight > alt.clientHeight) scrollContainer = alt;
       else {
         // Fallback: search up from first message
         const first = msgs[0];
         if (first) {
           let el = first.parentElement;
           while (el && el !== document.body) {
             const cs = window.getComputedStyle(el);
             const oy = cs.overflowY;
             if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) {
               scrollContainer = el;
               break;
             }
             el = el.parentElement;
           }
         }
       }
    }

    // Geometry Calculation
    let minTop = Infinity;
    let maxTop = -Infinity;
    let containerTop = 0;
    let scrollTop = 0;
    
    if (scrollContainer !== window) {
       containerTop = scrollContainer.getBoundingClientRect().top;
       scrollTop = scrollContainer.scrollTop;
    } else {
       scrollTop = window.scrollY;
    }
    
    // First pass: find extremes relative to scroll container
    const yPositions = msgs.map(m => {
       const rect = m.getBoundingClientRect();
       return (rect.top - containerTop) + scrollTop;
    });
    
    if (yPositions.length > 0) {
      minTop = yPositions[0];
      maxTop = yPositions[yPositions.length - 1];
      if (maxTop < minTop) maxTop = minTop + 1; // Safety
    } else {
      content.innerHTML = '';
      return;
    }
    
    let totalSpan = maxTop - minTop;
    if (totalSpan < 1) totalSpan = 1;

    // Use virtualization / mapping
    // Calculate content height for track
    const H = bar.clientHeight;
    const pad = 16;
    const minGap = 16; // Minimum visual gap
    
    // Simple distribution for now, but respecting minGap
    // The extension does complex virtualization. We will do a simplified mapping.
    
    content.innerHTML = '';
    
    markers = msgs.map((el, i) => {
      const top = yPositions[i];
      const pct = (top - minTop) / totalSpan;
      return { el, index: i, text: el.textContent.substring(0, 100), pct, top };
    });

    markers.forEach(m => {
      const dot = document.createElement('button');
      dot.className = 'timeline-dot';
      
      const n = Math.max(0, Math.min(1, m.pct));
      dot.style.setProperty('--n', n);
      
      // If we use specific scroll container, click should scroll THAT container
      dot.onclick = (e) => {
         e.stopPropagation();
         m.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
      
      dot.dataset.idx = m.index;
      content.appendChild(dot);
      m.dot = dot;
    });
    
    updateActive(scrollContainer);
  }

  function updateActive(container) {
    if (!container) container = window;
    const isWin = (container === window);
    const scrollTop = isWin ? window.scrollY : container.scrollTop;
    const viewHeight = isWin ? window.innerHeight : container.clientHeight;
    const containerTop = isWin ? 0 : container.getBoundingClientRect().top;
    
    const cy = scrollTop + (viewHeight / 3);
    let best = -1;
    let minD = Infinity;
    
    markers.forEach((m, i) => {
       const rect = m.el.getBoundingClientRect();
       const top = (rect.top - containerTop) + scrollTop;
       const dist = Math.abs(top - cy);
       if (dist < minD) { minD = dist; best = i; }
       m.dot.classList.remove('active');
    });
    
    if (best !== -1 && markers[best]) {
       markers[best].dot.classList.add('active');
       activeIdx = best;
    }
  }

  function onBarClick(e) {
    const dot = e.target.closest('.timeline-dot');
    if (!dot) return;
    const idx = parseInt(dot.dataset.idx);
    if (markers[idx]) {
       markers[idx].el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function onBarHover(e) {
    const dot = e.target.closest('.timeline-dot');
    if (!dot) return;
    const idx = parseInt(dot.dataset.idx);
    const m = markers[idx];
    if (m) {
      tooltip.textContent = (idx + 1) + ". " + m.text;
      const rect = dot.getBoundingClientRect();
      tooltip.style.top = (rect.top - 10) + 'px';
      tooltip.style.right = (window.innerWidth - rect.left + 10) + 'px';
      tooltip.classList.add('visible');
    }
  }
  
  function onBarOut(e) {
    tooltip.classList.remove('visible');
  }

  function init() {
    createUI();
    setInterval(render, 1000); // Polling for changes
    window.addEventListener('scroll', () => requestAnimationFrame(updateActive));
    window.addEventListener('resize', render);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
