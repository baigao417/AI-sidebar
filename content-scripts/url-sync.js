/**
 * AI Sidebar Content Script (Merged Version)
 * 
 * 功能：
 * 1. URL 同步 - 监听页面 URL/Title 变化并通知 Electron 主进程
 * 2. 对话时间轴 (Conversation Timeline) - 快速导航用户消息
 * 3. 提示词快捷触发 (Slash Command) - 监听 " /" 触发提示词管理器
 */

(function () {
  // 防止重复注入
  if (window.__AISB_CONTENT_SCRIPT_INJECTED) return;
  window.__AISB_CONTENT_SCRIPT_INJECTED = true;

  // ==================================================================================
  // 调试工具
  // ==================================================================================
  const dbg = (...args) => {
    try {
      if (localStorage.getItem('insidebar_debug') === '1') {
        console.log('[AI Sidebar]', ...args);
      }
    } catch (_) {}
  };

  // ==================================================================================
  // 通信桥接 (Electron Bridge)
  // ==================================================================================
  const Bridge = {
    send: (payload) => {
      try {
        if (window.__AISB_BRIDGE && typeof window.__AISB_BRIDGE.send === 'function') {
          window.__AISB_BRIDGE.send(payload);
        } else if (window.top) {
          window.top.postMessage(payload, '*');
        } else if (window.parent) {
          window.parent.postMessage(payload, '*');
        }
      } catch (e) {
        console.error('[AI Sidebar] Bridge send error:', e);
      }
    },
    onMessage: (callback) => {
      if (window.__AISB_BRIDGE && window.__AISB_BRIDGE.onMessage) {
        window.__AISB_BRIDGE.onMessage(callback);
      }
    }
  };

  // ==================================================================================
  // PART 1: URL 同步功能 (保留原有逻辑)
  // ==================================================================================
  (function initUrlSync() {
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
        const share = deepFind(document, (n) => n && (n.getAttribute && (n.getAttribute('data-clipboard-text') || n.getAttribute('data-share-url'))));
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
          const link = deepFind(document, (el) => el && el.tagName === 'A' && (el.getAttribute('href') || '').includes(`/app/${convId}`));
          if (link && link.textContent && !notUseful(link.textContent)) {
            return link.textContent.trim();
          }
        }
        const hasConvTitleClass = (el) => {
          try { return el && el.classList && Array.from(el.classList).some(c => /conversation-title/i.test(c)); } catch (_) { return false; }
        };
        const navScope = deepFind(document, (el) => el && (el.tagName === 'NAV' || el.tagName === 'ASIDE' || (el.getAttribute && el.getAttribute('role') === 'navigation')));
        if (navScope) {
          const activeTitle = deepFind(navScope, (el) => {
            if (!hasConvTitleClass(el) || !el.textContent || !el.textContent.trim()) return false;
            const container = el.closest('[aria-selected="true"], [aria-current="page"], [data-active="true"], [data-selected="true"], [class*="active"], [class*="selected"]');
            return !!container;
          });
          if (activeTitle && activeTitle.textContent && !notUseful(activeTitle.textContent)) {
            return activeTitle.textContent.trim();
          }
        }
        const globalTitle = deepFind(document, (el) => hasConvTitleClass(el) && el.textContent && el.textContent.trim().length > 0);
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

    // URL Change Sender
    let lastSent = '';
    let timer = null;
    const sendUrlChange = (immediate = false, reason = 'tick') => {
      const maybeGemini = resolveGeminiHref();
      const hrefNow = String(maybeGemini || location.href);
      const title = String(resolveGeminiTitle() || resolveChatGPTTitle() || document.title || '');
      const payload = { type: 'ai-url-changed', href: hrefNow, title, origin: String(location.origin) };
      const toSend = JSON.stringify(payload);
      const doPost = () => {
        try {
          Bridge.send(payload);
          lastSent = toSend;
        } catch (_) {}
      };
      if (immediate) return doPost();
      if (toSend === lastSent) return;
      clearTimeout(timer);
      timer = setTimeout(doPost, 100);
    };

    // Initial emit
    sendUrlChange(true, 'init');

    // Hook History API
    const wrapHistory = (method) => {
      const orig = history[method];
      if (typeof orig !== 'function') return;
      history[method] = function () {
        const ret = orig.apply(this, arguments);
        try { window.dispatchEvent(new Event('locationchange')); } catch (_) {}
        sendUrlChange(false, method);
        return ret;
      };
    };
    wrapHistory('pushState');
    wrapHistory('replaceState');

    window.addEventListener('popstate', () => sendUrlChange(false, 'popstate'));
    window.addEventListener('locationchange', () => sendUrlChange(false, 'locationchange'));

    // Mutation observer for title and DOM
    try {
      if (window.MutationObserver) {
        new MutationObserver(() => sendUrlChange(false, 'title-mutation')).observe(
          document.querySelector('title') || document.body,
          { subtree: true, characterData: true, childList: true }
        );
        new MutationObserver(() => sendUrlChange(false, 'dom-mutation')).observe(
          document.body,
          { childList: true, subtree: true }
        );
      }
    } catch (_) {}
  })();

  // ==================================================================================
  // PART 2: 样式定义 (CSS Injection)
  // ==================================================================================
  const STYLES = `
    /* 时间轴容器 */
    .aisb-timeline-container {
      position: fixed;
      top: 50%;
      right: 20px;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 10px 6px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: opacity 0.3s;
    }

    /* 隐藏状态（当没有消息时） */
    .aisb-timeline-container.hidden {
      display: none;
    }

    /* 单个圆点 */
    .aisb-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: rgba(150, 150, 150, 0.5);
      cursor: pointer;
      position: relative;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    /* 扩大点击区域 */
    .aisb-dot::after {
      content: '';
      position: absolute;
      top: -9px; left: -9px; right: -9px; bottom: -9px;
      border-radius: 50%;
    }

    /* 激活状态 */
    .aisb-dot.active {
      background-color: #10a37f;
      transform: scale(1.2);
      box-shadow: 0 0 8px rgba(16, 163, 127, 0.4);
    }

    /* 收藏状态 (金色) */
    .aisb-dot.bookmarked {
      background-color: #f59e0b;
      box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
    }

    /* Tooltip 预览 */
    .aisb-tooltip {
      position: absolute;
      right: 25px;
      top: 50%;
      transform: translateY(-50%) translateX(10px);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      white-space: nowrap;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: 0;
      pointer-events: none;
      transition: all 0.2s;
      visibility: hidden;
    }

    .aisb-dot:hover .aisb-tooltip {
      opacity: 1;
      visibility: visible;
      transform: translateY(-50%) translateX(0);
    }

    /* 深色模式适配 */
    @media (prefers-color-scheme: dark) {
      .aisb-timeline-container {
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.05);
      }
      .aisb-dot {
        background-color: rgba(255, 255, 255, 0.2);
      }
      .aisb-tooltip {
        background: rgba(255, 255, 255, 0.9);
        color: black;
      }
    }

    /* 针对深色网站的适配 (ChatGPT/Claude 等默认深色) */
    html.dark .aisb-timeline-container,
    [data-theme="dark"] .aisb-timeline-container {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    html.dark .aisb-dot,
    [data-theme="dark"] .aisb-dot {
      background-color: rgba(255, 255, 255, 0.25);
    }
  `;

  function injectStyles() {
    if (document.querySelector('#aisb-timeline-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'aisb-timeline-styles';
    styleEl.textContent = STYLES;
    document.head.appendChild(styleEl);
  }

  // ==================================================================================
  // PART 3: 站点策略模式 (Strategy Pattern for Timeline & Input)
  // ==================================================================================
  const Strategies = {
    // ChatGPT 策略
    chatgpt: {
      match: () => location.hostname.includes('chatgpt.com'),
      getUserMessages: () => {
        // 多个选择器兼容不同版本
        const selectors = [
          '[data-message-author-role="user"]',
          'article[data-testid^="conversation-turn-"][data-turn="user"]',
          'div[data-message-author-role="user"]'
        ];
        for (const sel of selectors) {
          const els = document.querySelectorAll(sel);
          if (els.length > 0) return Array.from(els);
        }
        return [];
      },
      getScrollContainer: () => {
        const main = document.querySelector('main');
        if (main) {
          const scrollers = main.querySelectorAll('[class*="overflow-y-auto"], [class*="overflow-auto"]');
          for (const s of scrollers) {
            if (s.scrollHeight > s.clientHeight) return s;
          }
        }
        return window;
      },
      getInputText: (el) => el.innerText || el.textContent || '',
      inputSelector: '#prompt-textarea, .ProseMirror, [contenteditable="true"]'
    },

    // Gemini 策略 (2024-2025 版本更新 - 基于 gemini-voyager 项目)
    gemini: {
      match: () => location.hostname.includes('gemini.google.com'),
      getUserMessages: () => {
        // 选择器来源: gemini-voyager 项目 (src/core/utils/selectors.ts)
        // 按优先级排列，主要适配 Angular-based Gemini UI
        const selectors = [
          // Angular-based Gemini UI user bubble (primary - 2024/2025)
          '.user-query-bubble-with-background',
          // Angular containers (fallbacks)
          '.user-query-bubble-container',
          '.user-query-container',
          'user-query-content .user-query-bubble-with-background',
          'user-query-content',
          'user-query',
          // Attribute-based fallbacks for other Gemini variants
          'div[aria-label="User message"]',
          'article[data-author="user"]',
          'article[data-turn="user"]',
          '[data-message-author-role="user"]',
          'div[role="listitem"][data-user="true"]',
        ];
        
        for (const sel of selectors) {
          try {
            const els = document.querySelectorAll(sel);
            if (els.length > 0) {
              // 过滤掉空的和嵌套的
              const filtered = Array.from(els).filter(el => {
                const text = el.innerText || el.textContent || '';
                if (text.trim().length === 0) return false;
                // 避免嵌套重复（检查父元素是否已经是用户消息）
                const parent = el.parentElement;
                if (parent && selectors.some(s => {
                  try { return parent.matches(s); } catch (_) { return false; }
                })) return false;
                return true;
              });
              if (filtered.length > 0) {
                dbg('Gemini selector matched:', sel, 'count:', filtered.length);
                return filtered;
              }
            }
          } catch (_) {}
        }
        return [];
      },
      getMessagePreview: (el) => {
        // 优先从 .query-text-line 提取文本（gemini-voyager 的方法）
        const textLines = el.querySelectorAll('.query-text-line');
        if (textLines.length > 0) {
          return Array.from(textLines).map(line => line.innerText || line.textContent || '').join(' ').trim();
        }
        // 其他文本选择器
        const textSelectors = ['.query-text', '.user-query-text', 'p', 'span'];
        for (const sel of textSelectors) {
          const textEl = el.querySelector(sel);
          if (textEl && textEl.innerText && textEl.innerText.trim()) {
            return textEl.innerText.trim();
          }
        }
        return el.innerText || el.textContent || '';
      },
      getScrollContainer: () => {
        // Gemini 滚动容器检测（基于 gemini-voyager 的方法）
        // 1. 首先尝试找到用户消息元素
        const userSelectors = [
          '.user-query-bubble-with-background',
          '.user-query-bubble-container',
          '.user-query-container',
          'user-query-content'
        ];
        
        let firstUserTurn = null;
        for (const sel of userSelectors) {
          firstUserTurn = document.querySelector(sel);
          if (firstUserTurn) break;
        }
        
        // 2. 从用户消息向上遍历，查找滚动容器
        if (firstUserTurn) {
          let p = firstUserTurn;
          while (p && p !== document.body) {
            try {
              const st = window.getComputedStyle(p);
              if (st.overflowY === 'auto' || st.overflowY === 'scroll') {
                if (p.scrollHeight > p.clientHeight) {
                  dbg('Gemini scroll container found via traversal:', p.className);
                  return p;
                }
              }
            } catch (_) {}
            p = p.parentElement;
          }
        }
        
        // 3. 备用选择器
        const candidates = [
          '#chat-history.chat-history-scroll-container',
          '[data-test-id="chat-history-container"]',
          '.conversation-container',
          'main'
        ];
        for (const sel of candidates) {
          const el = document.querySelector(sel);
          if (el && el.scrollHeight > el.clientHeight) {
            dbg('Gemini scroll container found via selector:', sel);
            return el;
          }
        }
        
        // 4. Fallback 到 document.scrollingElement
        return document.scrollingElement || document.documentElement || window;
      },
      getInputText: (el) => {
        if (el.classList.contains('ql-editor')) {
          return el.innerText || '';
        }
        return el.innerText || el.value || '';
      },
      inputSelector: '.ql-editor, [contenteditable="true"], textarea, [role="textbox"], rich-textarea'
    },

    // DeepSeek 策略
    deepseek: {
      match: () => location.hostname.includes('deepseek.com'),
      getUserMessages: () => {
        const selectors = [
          'div[class*="fabb"]:has(> div.fa34)',
          'div[class*="ds-message--user"]',
          'div[class*="user-message"]',
          '.message-user',
          'div[data-role="user"]'
        ];
        for (const sel of selectors) {
          try {
            const els = document.querySelectorAll(sel);
            if (els.length > 0) return Array.from(els);
          } catch (_) {}
        }
        return [];
      },
      getScrollContainer: () => window,
      getInputText: (el) => el.value || el.innerText || '',
      inputSelector: 'textarea, [contenteditable="true"]'
    },

    // Claude 策略
    claude: {
      match: () => location.hostname.includes('claude.ai'),
      getUserMessages: () => {
        return Array.from(document.querySelectorAll('[data-testid="user-message"]'));
      },
      getScrollContainer: () => window,
      getInputText: (el) => el.innerText || '',
      inputSelector: '[contenteditable="true"], .ProseMirror'
    },

    // Kimi 策略
    kimi: {
      match: () => location.hostname.includes('kimi.moonshot.cn'),
      getUserMessages: () => {
        const selectors = [
          'div[class*="user-message"]',
          'div[class*="UserMessage"]',
          '.chat-message-user'
        ];
        for (const sel of selectors) {
          const els = document.querySelectorAll(sel);
          if (els.length > 0) return Array.from(els);
        }
        return [];
      },
      getScrollContainer: () => window,
      getInputText: (el) => el.value || el.innerText || '',
      inputSelector: 'textarea, [contenteditable="true"]'
    }
  };

  function getCurrentStrategy() {
    for (const key in Strategies) {
      if (Strategies[key].match()) {
        dbg('Strategy matched:', key);
        return Strategies[key];
      }
    }
    return null;
  }

  // ==================================================================================
  // PART 4: 对话时间轴 (TimelineManager)
  // ==================================================================================
  class TimelineManager {
    constructor(strategy) {
      this.strategy = strategy;
      this.elements = [];
      this.container = null;
      this.observer = null;
      this.scrollTimeout = null;
      this.localStorageKey = `aisb_bookmarks_${location.hostname}`;
      this.bookmarks = this.loadBookmarks();

      this.init();
    }

    init() {
      // 创建 UI 容器
      this.container = document.createElement('div');
      this.container.className = 'aisb-timeline-container hidden';
      document.body.appendChild(this.container);

      // 初始化监听 DOM 变化 (Throttled)
      this.observeDOM();

      // 初始化滚动监听
      this.setupScrollListener();

      // 初始扫描
      this.scanMessages();

      dbg('TimelineManager initialized');
    }

    setupScrollListener() {
      const scrollTarget = this.strategy.getScrollContainer();
      const scrollEventTarget = scrollTarget === window ? window : scrollTarget;

      scrollEventTarget.addEventListener('scroll', () => {
        if (this.scrollTimeout) return;
        this.scrollTimeout = requestAnimationFrame(() => {
          this.highlightActiveDot();
          this.scrollTimeout = null;
        });
      }, { passive: true });
    }

    loadBookmarks() {
      try {
        const stored = localStorage.getItem(this.localStorageKey);
        return stored ? JSON.parse(stored) : [];
      } catch (e) {
        return [];
      }
    }

    saveBookmark(id, isBookmarked) {
      if (isBookmarked) {
        if (!this.bookmarks.includes(id)) this.bookmarks.push(id);
      } else {
        this.bookmarks = this.bookmarks.filter(b => b !== id);
      }
      localStorage.setItem(this.localStorageKey, JSON.stringify(this.bookmarks));
    }

    generateId(el, index) {
      if (el.id) return el.id;
      const text = (el.innerText || '').substring(0, 20).replace(/\s/g, '');
      return `msg_${index}_${text}`;
    }

    observeDOM() {
      let timeout;
      this.observer = new MutationObserver(() => {
        clearTimeout(timeout);
        timeout = setTimeout(() => this.scanMessages(), 500);
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    scanMessages() {
      const msgs = this.strategy.getUserMessages();

      // 如果没有变化，跳过
      if (msgs.length === this.elements.length && msgs.length > 0) {
        if (msgs[msgs.length - 1] === this.elements[this.elements.length - 1]) {
          return;
        }
      }

      this.elements = msgs;
      this.renderDots();
    }

    renderDots() {
      this.container.innerHTML = '';

      if (this.elements.length === 0) {
        this.container.classList.add('hidden');
        return;
      }
      this.container.classList.remove('hidden');

      this.elements.forEach((el, index) => {
        const dot = document.createElement('div');
        dot.className = 'aisb-dot';

        // Tooltip 内容
        const tooltip = document.createElement('div');
        tooltip.className = 'aisb-tooltip';
        const rawText = this.strategy.getMessagePreview
          ? this.strategy.getMessagePreview(el)
          : (el.innerText || el.textContent || '');
        tooltip.textContent = rawText.substring(0, 100) + (rawText.length > 100 ? '...' : '');
        dot.appendChild(tooltip);

        // 检查收藏状态
        const msgId = this.generateId(el, index);
        if (this.bookmarks.includes(msgId)) {
          dot.classList.add('bookmarked');
        }

        // 点击事件：滚动
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        // 长按事件：收藏
        let pressTimer;
        const startPress = () => {
          pressTimer = setTimeout(() => {
            dot.classList.toggle('bookmarked');
            const isBookmarked = dot.classList.contains('bookmarked');
            this.saveBookmark(msgId, isBookmarked);
          }, 500);
        };
        const cancelPress = () => clearTimeout(pressTimer);

        dot.addEventListener('mousedown', startPress);
        dot.addEventListener('touchstart', startPress, { passive: true });
        dot.addEventListener('mouseup', cancelPress);
        dot.addEventListener('mouseleave', cancelPress);
        dot.addEventListener('touchend', cancelPress);

        dot._targetElement = el;
        this.container.appendChild(dot);
      });

      this.highlightActiveDot();
    }

    highlightActiveDot() {
      if (this.elements.length === 0) return;

      const dots = Array.from(this.container.children);
      const viewHeight = window.innerHeight;
      let activeIndex = -1;
      let minDistance = Infinity;

      this.elements.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        if (rect.height === 0) return;

        const elCenter = rect.top + rect.height / 2;
        const screenCenter = viewHeight / 2;
        const distance = Math.abs(elCenter - screenCenter);

        if (distance < minDistance) {
          minDistance = distance;
          activeIndex = index;
        }
      });

      dots.forEach((dot, index) => {
        if (index === activeIndex) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    }
  }

  // ==================================================================================
  // PART 5: 提示词快捷触发 (GlobalInputManager) - 全局支持版本
  // ==================================================================================
  
  /**
   * 全局输入管理器 - 无需策略依赖，支持所有网站
   * 
   * 核心功能：
   * 1. 全局检测可编辑输入框（textarea, contenteditable, ProseMirror, Slate, Quill 等）
   * 2. 监听 " /" 触发提示词管理器
   * 3. 通用文本插入（支持 React/Vue/Angular 框架绑定）
   */
  class GlobalInputManager {
    constructor() {
      // 通用输入框选择器（覆盖主流富文本编辑器和框架）
      this.EDITABLE_SELECTORS = [
        // 富文本编辑器
        '[role="textbox"]',                    // ARIA 规范的文本框
        '.ProseMirror',                         // ProseMirror (ChatGPT, Notion, etc.)
        '[data-slate-editor="true"]',           // Slate.js (Discord, etc.)
        '.ql-editor',                           // Quill.js
        '[contenteditable="true"]',             // 原生 contenteditable
        '[contenteditable="plaintext-only"]',   // 纯文本模式
        // 原生输入
        'textarea',
        'input[type="text"]',
        'input[type="search"]',
        'input:not([type])',                    // 无 type 的 input 默认是 text
        // 特定平台的输入框
        '#prompt-textarea',                     // ChatGPT
        '.chatgpt-input',
        'rich-textarea',                        // Gemini
        '.text-input-area',                     // 通用
        '[data-testid="text-input"]',           // 测试属性
        '[data-testid="composer-input"]',       // Claude
        '.chat-input',
        '.message-input',
        '[aria-label*="input" i]',              // ARIA 标签包含 input
        '[aria-label*="message" i]',            // ARIA 标签包含 message
        '[placeholder*="message" i]',           // placeholder 包含 message
        '[placeholder*="type" i]',              // placeholder 包含 type
      ];
      
      // 组合选择器字符串
      this.selectorString = this.EDITABLE_SELECTORS.join(', ');
      
      // 当前聚焦的输入框
      this.currentInput = null;
      
      this.init();
    }

    init() {
      // 使用事件代理监听 input 事件（捕获阶段）
      document.addEventListener('input', (e) => this.handleInput(e), true);
      
      // 监听焦点变化，跟踪当前输入框
      document.addEventListener('focusin', (e) => this.handleFocusIn(e), true);
      document.addEventListener('focusout', (e) => this.handleFocusOut(e), true);
      
      // 监听键盘事件（用于某些不触发 input 事件的情况）
      document.addEventListener('keyup', (e) => this.handleKeyUp(e), true);

      // 接收来自主进程的消息
      Bridge.onMessage((payload) => {
        if (payload && payload.type === 'INSERT_TEXT') {
          this.insertText(payload.text);
        }
        if (payload && payload.type === 'SHOW_SLASH_PICKER') {
          this.triggerPromptManager();
        }
      });

      dbg('GlobalInputManager initialized (universal support)');
    }

    /**
     * 检查元素是否是可编辑输入框
     */
    isEditableElement(el) {
      if (!el || !el.nodeType || el.nodeType !== 1) return false;
      
      // 检查是否匹配选择器
      try {
        if (el.matches(this.selectorString)) return true;
      } catch (_) {}
      
      // 检查 contenteditable
      if (el.isContentEditable) return true;
      
      // 检查是否在可编辑元素内部
      try {
        if (el.closest(this.selectorString)) return true;
      } catch (_) {}
      
      return false;
    }

    /**
     * 获取元素的文本内容（适配不同类型的输入框）
     */
    getInputText(el) {
      if (!el) return '';
      
      // textarea 和 input
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        return el.value || '';
      }
      
      // contenteditable 和富文本编辑器
      if (el.isContentEditable || el.getAttribute('contenteditable')) {
        return el.innerText || el.textContent || '';
      }
      
      // 通用 fallback
      return el.value || el.innerText || el.textContent || '';
    }

    handleFocusIn(e) {
      const target = e.target;
      if (this.isEditableElement(target)) {
        this.currentInput = target;
        dbg('Input focused:', target.tagName, target.className);
      }
    }

    handleFocusOut(e) {
      // 延迟清除，避免在切换输入框时丢失引用
      setTimeout(() => {
        if (document.activeElement === document.body || !this.isEditableElement(document.activeElement)) {
          // 保留 currentInput 引用一段时间，以便插入文本时使用
        }
      }, 100);
    }

    handleInput(e) {
      const target = e.target;
      
      // 检查是否是可编辑输入框
      if (!this.isEditableElement(target)) return;
      
      this.currentInput = target;
      const text = this.getInputText(target);

      // 检测 " /" 结尾 (空格 + 斜杠) - Notion 风格
      if (text.endsWith(' /') || /\s\/$/.test(text)) {
        dbg('Slash command triggered on:', target.tagName);
        this.triggerPromptManager();
      }
    }

    handleKeyUp(e) {
      // 只处理 "/" 键
      if (e.key !== '/') return;
      
      const target = e.target;
      if (!this.isEditableElement(target)) return;
      
      const text = this.getInputText(target);
      
      // 双重检查：确保是 " /" 模式
      if (text.endsWith(' /') || /\s\/$/.test(text)) {
        // 避免重复触发（input 事件可能已经触发过）
        // 这里作为 fallback 机制
      }
    }

    triggerPromptManager() {
      Bridge.send({ type: 'trigger-prompt-manager' });
    }

    /**
     * 通用文本插入方法 - 支持各种框架和富文本编辑器
     */
    insertText(textToInsert) {
      // 获取目标元素：优先使用当前聚焦的元素，否则使用记录的 currentInput
      let targetEl = document.activeElement;
      
      // 如果 activeElement 是 body 或不可编辑，使用记录的 currentInput
      if (!targetEl || targetEl === document.body || !this.isEditableElement(targetEl)) {
        targetEl = this.currentInput;
      }
      
      if (!targetEl) {
        dbg('No target element for text insertion');
        return;
      }

      dbg('Inserting text into:', targetEl.tagName, targetEl.className);
      
      // 确保元素聚焦
      targetEl.focus();

      // 删除触发字符 " /"（如果存在）
      this.removeSlashTrigger(targetEl);

      // 尝试多种插入方法
      const inserted = this.tryInsertMethods(targetEl, textToInsert);
      
      if (inserted) {
        dbg('Text inserted successfully');
      } else {
        dbg('Text insertion failed');
      }
    }

    /**
     * 删除触发字符 " /"
     */
    removeSlashTrigger(el) {
      const text = this.getInputText(el);
      
      // 检查是否以 " /" 结尾
      if (!text.endsWith(' /') && !/\s\/$/.test(text)) return;
      
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        // 对于 textarea/input，直接修改 value
        const newValue = text.slice(0, -2); // 移除 " /"
        el.value = newValue;
        el.selectionStart = el.selectionEnd = newValue.length;
        this.dispatchInputEvent(el);
      } else if (el.isContentEditable || el.getAttribute('contenteditable')) {
        // 对于 contenteditable，使用 Selection API
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          // 尝试删除最后两个字符
          document.execCommand('delete', false);
          document.execCommand('delete', false);
        }
      }
    }

    /**
     * 尝试多种插入方法
     */
    tryInsertMethods(el, text) {
      // 方法 1: document.execCommand (兼容性最好)
      try {
        const success = document.execCommand('insertText', false, text);
        if (success) {
          this.dispatchInputEvent(el);
          return true;
        }
      } catch (_) {}

      // 方法 2: 使用 beforeinput 事件 (现代浏览器)
      try {
        const beforeInputEvent = new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text,
        });
        const dispatched = el.dispatchEvent(beforeInputEvent);
        if (dispatched && !beforeInputEvent.defaultPrevented) {
          // 如果 beforeinput 没有被阻止，尝试手动插入
        }
      } catch (_) {}

      // 方法 3: 针对 textarea/input 的 value 操作
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        try {
          const start = el.selectionStart || 0;
          const end = el.selectionEnd || 0;
          const before = el.value.substring(0, start);
          const after = el.value.substring(end);
          
          el.value = before + text + after;
          el.selectionStart = el.selectionEnd = start + text.length;
          
          this.dispatchInputEvent(el);
          return true;
        } catch (_) {}
      }

      // 方法 4: 针对 contenteditable 的 insertNode
      if (el.isContentEditable || el.getAttribute('contenteditable')) {
        try {
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            
            const textNode = document.createTextNode(text);
            range.insertNode(textNode);
            
            // 移动光标到插入文本之后
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);
            
            this.dispatchInputEvent(el);
            return true;
          }
        } catch (_) {}
      }

      // 方法 5: 最后的 fallback - 直接设置内容
      try {
        if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
          el.value += text;
        } else {
          el.innerText += text;
        }
        this.dispatchInputEvent(el);
        return true;
      } catch (_) {}

      return false;
    }

    /**
     * 触发 input 事件（兼容 React/Vue/Angular）
     */
    dispatchInputEvent(el) {
      // 原生 input 事件
      const inputEvent = new Event('input', { bubbles: true, cancelable: true });
      el.dispatchEvent(inputEvent);
      
      // change 事件（某些框架需要）
      const changeEvent = new Event('change', { bubbles: true, cancelable: true });
      el.dispatchEvent(changeEvent);
      
      // React 16+ 使用的内部事件
      try {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        )?.set || Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        )?.set;
        
        if (nativeInputValueSetter && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) {
          // 已经通过其他方式设置了 value，这里只需要触发事件
        }
      } catch (_) {}
    }
  }

  // ==================================================================================
  // PART 6: 启动入口
  // ==================================================================================
  function main() {
    const strategy = getCurrentStrategy();

    // 注入 CSS (全局注入，因为提示词功能是全局的)
    injectStyles();

    dbg('Initializing for:', location.hostname);

    // ===== 全局功能：提示词快捷触发 =====
    // GlobalInputManager 不依赖策略，在所有网站上都初始化
    new GlobalInputManager();

    // ===== 站点特定功能：时间轴 =====
    // TimelineManager 依赖策略来获取用户消息，只在支持的站点初始化
    if (strategy) {
      dbg('Timeline enabled for:', location.hostname);
      new TimelineManager(strategy);
    } else {
      dbg('Timeline not available for this site (no strategy)');
    }
  }

  // 等待页面加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }

})();
