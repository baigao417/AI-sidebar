# Change: Add Conversation Timeline capability

## Why
Users struggle to navigate long conversations across providers in AI Sidebar. A Conversation Timeline provides a time-axis navigation aid per provider to jump through messages without assuming a single unified history model.

## What Changes
- Add a provider-scoped Conversation Timeline capability with opt-in support per provider.
- Define timeline requirements for initial providers: ChatGPT, Gemini, Claude, DeepSeek.
- Specify provider-specific derivation of timeline data without assuming uniform DOM structure.
- Clarify non-goals (no cross-provider unified timeline in v1).

## Constraints
- No backend services or external APIs.
- Timeline is a provider capability; providers must be able to opt in/out.
- Do not assume uniform DOM structure across providers.
- Feature is confirmed to be implemented, but this change only defines specs.

## Impact
- Affected specs: new `conversation-timeline` capability.
- Affected code: provider abstraction and BrowserView integration (implementation later).
