## 1. Preparation
- [x] 1.1 Reconfirm `conversation-timeline` spec requirements and v1 scope
- [x] 1.2 Document UI placement decision: timeline UI lives in AI Sidebar chrome only
- [x] 1.3 Define the shared timeline data model interface and allowed locator types
- [x] 1.4 Define deterministic fallback rules and "Timeline unavailable" UI state
- [x] 1.5 Define acceptance criteria for visibility and fallback behavior

## 2. Provider Capability
- [x] 2.1 Add opt-in timeline capability flag for providers (ChatGPT, Gemini, Claude, DeepSeek only)
- [x] 2.2 Ensure providers without opt-in do not expose timeline UI

## 3. Timeline Data Derivation
- [x] 3.1 Define per-provider anchor derivation strategy (ChatGPT)
- [x] 3.2 Define per-provider anchor derivation strategy (Gemini)
- [x] 3.3 Define per-provider anchor derivation strategy (Claude)
- [x] 3.4 Define per-provider anchor derivation strategy (DeepSeek)
- [x] 3.5 Map provider output into shared timeline data model with allowed locator types
- [x] 3.6 Implement deterministic fallback triggers

## 4. Timeline UI
- [x] 4.1 Implement minimal timeline UI in AI Sidebar chrome
- [x] 4.2 Connect timeline UI to provider-specific anchors via shared data model
- [x] 4.3 Implement "Timeline unavailable" state and hide/disable timeline on fallback

## 5. Validation
- [x] 5.1 Verify timeline appears only for opted-in providers
- [x] 5.2 Verify anchor click scrolls target message into view (visibility > 50%)
- [x] 5.3 Verify fallback behavior with defined trigger rules
