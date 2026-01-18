# Manual QA Checklist: Conversation Timeline (v1)

## 1. Provider Capability & UI Presence
- [ ] **ChatGPT**: Open a conversation. Verify timeline bar appears on the right in AI Sidebar UI.
- [ ] **Gemini**: Open a conversation. Verify timeline bar appears on the right.
- [ ] **Claude**: Open a conversation. Verify timeline bar appears on the right.
- [ ] **DeepSeek**: Open a conversation. Verify timeline bar appears on the right.
- [ ] **Opt-out Test**: Open "Perplexity" or "Google". Verify **NO** timeline bar appears (should be hidden).

## 2. Navigation Accuracy
- [ ] **ChatGPT**: Click the 1st dot (top). Verify page scrolls to the first user/assistant message.
- [ ] **ChatGPT**: Click the last dot (bottom). Verify page scrolls to the latest message.
- [ ] **Visibility Check**: After jump, verify target message is >50% visible in the viewport.

## 3. Fallback Behavior
- [ ] **Empty State**: Open a "New Chat" (empty). Verify timeline shows "Timeline unavailable" (!) or is hidden (anchors < 2).
- [ ] **Broken Selectors (Simulation)**: 
  - Open DevTools (Ctrl+Shift+I).
  - Modify `CONFIG.chatgpt.itemSelector` in `content-scripts/timeline.js` to a garbage string (requires reload/re-inject or mock test).
  - Verify UI shows "Timeline unavailable" (!) due to failureRate >= 0.5.

## 4. Stability
- [ ] **Switching**: Switch between ChatGPT and Claude rapidly. Verify timeline updates/clears correctly without flicker or wrong state.
- [ ] **Resize**: Resize window. Verify anchors (yOffset based) might drift slightly but still jump approximately correctly (v1 limitation).
