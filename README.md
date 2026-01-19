# AI Sidebar - 桌面端 AI 工作台

<div align="center">
  <img src="images/icon128.png" alt="AI Sidebar Logo" width="128">
  
  **将 ChatGPT、Claude、Gemini、DeepSeek 等 20+ 个顶尖 AI 模型集成到您的桌面侧边栏。**
  **一键呼出，多屏协作，截图提问，无需 API Key。**

  [![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
  [![Electron](https://img.shields.io/badge/Electron-Desktop-blue)](https://www.electronjs.org/)
</div>

---

## 🌟 为什么选择 AI Sidebar？

AI Sidebar 不仅仅是一个浏览器套壳，它是专为**高频 AI 用户**打造的生产力工具：

*   🚀 **极致效率**：全局快捷键 `Option+Space` 毫秒级呼出/隐藏，用完即走，不打断工作流。
*   🆚 **模型竞技场 (Split Screen)**：支持**分屏**甚至**三分屏**模式。同时打开 ChatGPT 和 Claude，对比回答质量，或左边查资料右边写代码。
*   👁️ **视觉智能 (Vision)**：内置**截图提问**功能。按下快捷键，自动截取屏幕并发送给 AI（支持 GPT-4o, Claude 3.5 Sonnet, Gemini 等）。
*   📝 **上下文感知**：选中任意软件中的文字，一键发送到 AI 进行解释或翻译。
*   🔒 **隐私安全**：**无需 API Key**，直接复用您现有的网页版登录状态。所有数据（历史、收藏）仅存储在本地，不经过中间服务器。

---

## ✨ 核心功能

### 🧠 全能模型库 (20+ 内置支持)
无需安装多个客户端，一个应用搞定所有主流 AI：
*   **国际主流**：ChatGPT, Claude, Gemini, Perplexity, Google Search
*   **开源/专业**：DeepSeek (深度求索), Grok, Mistral, Cohere, HuggingChat, Meta AI
*   **编程辅助**：GitHub Copilot, v0.dev (Vercel), ChatGPT Codex
*   **国产大模型**：通义千问, 豆包, Kimi (月之暗面), 智谱清言, 海螺AI (Minimax), 秘塔AI
*   **生产力工具**：NotebookLM, Excalidraw, Attention Tracker (专注计时器), 幕布
*   *➕ 支持添加自定义网址作为 Provider*

### ⚡ 生产力黑科技
*   **Align Mode (群发模式)**：一次输入，同时发送给所有开启的 AI 窗口，效率翻倍。
*   **In-page Timeline (对话时间轴)**：在 ChatGPT、Claude、Gemini、DeepSeek 网页内直接嵌入时间轴导航，快速定位长对话上下文。
*   **Prompt Manager (提示词管理)**：内置提示词库，通过 `/` 快速调用常用指令，支持 TXT 格式导入导出，轻松迁移私有库。
*   **Always On Top (置顶模式)**：点击标题栏图钉，让侧边栏永远保持在最前，对照文档工作的神器。
*   **History & Favorites**：自动记录对话链接（仅本地），支持收藏常用对话。

### ⌨️ 键盘党的福音
我们为键盘操作做了深度优化：

| 功能 | Mac 快捷键 | Windows/Linux 快捷键 |
|------|-----------|--------------------|
| **呼出/隐藏侧边栏** | `Option + Space` | `Alt + Space` |
| **截图并发送给 AI** | `Cmd + Shift + K` | `Ctrl + Shift + K` |
| **选中文本发送给 AI** | `Cmd + Shift + Y` | `Ctrl + Shift + Y` |
| **切换 AI 模型** | `Tab` / `Shift + Tab` | `Tab` / `Shift + Tab` |
| **打开提示词菜单** | `/` (在输入框中) | `/` (在输入框中) |

---

## 🚀 快速开始

### 1. 下载与安装
目前需通过源码运行（后续将提供安装包）：

```bash
# 克隆项目
git clone https://github.com/baigao417/AI-sidebar.git
cd AI-sidebar

# 安装依赖
npm install

# 启动应用
npm start
```

### 2. 开发模式
如果您想进行二次开发或调试：
```bash
npm run dev
```

---

## 🔧 常见问题与技巧

### 分屏与锁定
*   **如何分屏？** 点击底部导航栏的其他图标，选择"在右侧打开"即可分屏。
*   **Tab 锁定 (Lock ▶︎)**：在分屏模式下，点击地址栏的 `Lock` 按钮。此时 `Tab` 键切换将只在当前屏幕内循环，不会跳转到左屏，适合沉浸式阅读。

### 登录问题
*   应用直接加载官方网页版，因此需要您在对应的窗口中登录账号。
*   **Google/Gemini 登录**：如果遇到 "Browser not supported" 或登录受阻，请尝试点击工具栏的 "Open in Tab" 在系统默认浏览器中登录一次，或者在应用内多尝试刷新。

### 网络连接
*   如果遇到连接错误（SSL/TLS 报错），通常是因为某些代理软件对 Electron 的网络栈兼容性问题。
*   **解决方案**：尝试使用兼容模式启动：
    ```bash
    AISB_NET_COMPAT=1 npm start
    ```

---

## 🏗️ 技术栈
*   **Electron**: 跨平台桌面容器
*   **BrowserView**: 高性能的独立视图管理（比 iframe 更稳定）
*   **Vanilla JS**: 轻量级原生 JavaScript，无庞大框架负担
*   **Chrome Extension API Adapter**: 独特的适配层，复用大量 Chrome 插件生态代码

## 📄 许可证
[MIT License](LICENSE)
