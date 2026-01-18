# Change: Implement Conversation Timeline capability

## Why
The Conversation Timeline capability is approved and needs implementation so users can navigate long conversations within supported providers in AI Sidebar. The implementation must remain provider-scoped, minimal, and avoid cross-provider aggregation.

## What Changes
- Implement Conversation Timeline capability for ChatGPT, Gemini, Claude, and DeepSeek only.
- Extend provider capability model to allow explicit opt-in/opt-out for timeline support.
- Add provider-specific timeline derivation logic for message anchors/positions.
- Provide a minimal timeline UI for navigation with graceful fallback when anchors cannot be derived.

## Decisions
- Timeline UI lives in AI Sidebar UI chrome (outside provider pages); v1 must not inject timeline UI into provider DOM.
- Provider logic only derives anchors and exposes jump/scroll APIs; UI remains consistent across providers.
- Minimal shared timeline data model returned by providers:
  - providerId
  - conversationId (nullable)
  - anchors: [{ id, label, locator }]
- Allowed locator types in v1:
  - { type: "selector", value: "<css selector>" }
  - { type: "yOffset", value: <number>, containerSelector?: "<css selector>" }
- Fallback triggers if any of:
  - anchors length < 2
  - scroll container cannot be identified
  - locator resolution fails for >= 50% of anchors
- Fallback behavior: hide/disable timeline and show a minimal "Timeline unavailable" state.

## Acceptance Criteria
- Timeline appears only for opted-in providers.
- Clicking an anchor scrolls the provider conversation so the target message is visible in the viewport (bounding box intersection > 50%).
- Fallback behavior is reproducible using the defined trigger rules.

## Constraints
- No backend services or external APIs.
- No cross-provider unified timeline.
- No assumptions of uniform DOM structure across providers.
- Keep v1 minimal and focused on navigation.

## Impact
- Affected specs: `conversation-timeline` capability.
- Affected code: provider capability registry, BrowserView integration, timeline UI and extraction logic.
