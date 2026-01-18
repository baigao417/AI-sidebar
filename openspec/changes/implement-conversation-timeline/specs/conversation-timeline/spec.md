## ADDED Requirements

### Requirement: Provider-Scoped Timeline Capability
The system SHALL define Conversation Timeline as an optional capability on a per-provider basis.

#### Scenario: Provider supports timeline
- **WHEN** a provider is configured to opt in to the Conversation Timeline capability
- **THEN** the timeline feature SHALL be available for that provider's conversations

#### Scenario: Provider opts out
- **WHEN** a provider is configured to opt out of the Conversation Timeline capability
- **THEN** the timeline feature SHALL NOT be available for that provider's conversations

### Requirement: Initial Supported Providers
The system SHALL support Conversation Timeline for the following providers in the initial release: ChatGPT, Gemini, Claude, and DeepSeek.

#### Scenario: Supported provider list
- **WHEN** the system lists providers with Conversation Timeline capability
- **THEN** ChatGPT, Gemini, Claude, and DeepSeek SHALL be included

### Requirement: Provider-Specific Timeline Derivation
The system SHALL derive timeline data per provider without assuming uniform DOM structure across providers.

#### Scenario: Provider-specific extraction
- **WHEN** timeline data is derived for a provider
- **THEN** the system SHALL use provider-specific logic to identify message positions

### Requirement: No Cross-Provider Unified Timeline
The system SHALL NOT provide a unified timeline that merges messages across multiple providers in the initial release.

#### Scenario: Separate timelines
- **WHEN** a user is viewing conversations from multiple providers
- **THEN** the timeline SHALL remain scoped to the currently active provider

### Requirement: No External Services
The system SHALL NOT rely on backend services or external APIs to generate or store conversation timeline data.

#### Scenario: Local-only timeline data
- **WHEN** the timeline feature is used
- **THEN** timeline data SHALL be derived locally within the application
