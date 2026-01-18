# Project Context

## Purpose
AI Sidebar is a cross-platform (Windows and macOS) desktop productivity tool that provides a system-level, globally summonable sidebar for accessing multiple third-party AI services. It focuses on fast summon/hide workflows, split-screen or multi-view comparisons, local-only history/favorites, and reuse of existing web login sessions.

## Tech Stack
- Electron app using BrowserView (main process owns window + BrowserView lifecycle).
- Vanilla JavaScript only (no TypeScript, no frontend frameworks).
- No bundler (no Vite/Webpack); app is launched directly by Electron.
- Build tooling via `electron-builder` with plain npm scripts.

## Project Conventions

### Code Style
No enforced formatter or linter. Naming, file structure, and conventions are currently inconsistent. This document reflects current state only and does not introduce new rules.

### Architecture Patterns
- Electron main process manages windows and multiple BrowserView instances for third-party AI websites.
- Renderer/preload logic connects UI chrome to BrowserView content.
- IPC / bridge logic is used to communicate between main process, preload scripts, and embedded views.
- Architecture, IPC usage, and bridge conventions are evolving and not fully consistent.

### Testing Strategy
No formal test suite. Testing is currently out of scope for this project context and should not be introduced by default.

### Git Workflow
- Single `main` branch.
- No strict commit message convention.
- No required PR process.

## Domain Context
The app is a desktop AI workbench that embeds third-party AI websites within BrowserView instances. Features include quick summon/hide, split-screen/multi-view, and local-only storage of history/favorites.

## Important Constraints
- Must not break existing functionality.
- Avoid large refactors; prefer minimal, incremental changes.
- Clarify existing behavior rather than redesigning or optimizing systems.

## External Dependencies
- No backend services or external APIs are used by this project.
- Interacts only with third-party AI websites loaded inside BrowserView.
