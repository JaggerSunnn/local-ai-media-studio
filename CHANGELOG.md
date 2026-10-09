# Changelog

## Voice library update — 2026-10-09

- Added a searchable, scrollable Common/Pro voice library with language/gender filters and official sample playback.
- Unified the field label as Voice ID, preserving manual entry and per-model choices.
- Synced 232 official voices and added a public catalog refresh endpoint with bundled fallback.
- Removed the standalone top navigation and install entry; moved API key controls into the web generation composer.


## 0.2.5 — 2026-10-08

- Replaced the Simple / Pro mode switch with one unified Playground interface.
- Made multi-model selection, batch count, cost estimates, and clear-model controls available in the same frontend.
- Removed mode-specific state, local preferences, styling, and event handling.
- Added a shared first-release menu with 12 tasks, explicit default models, and validated task-specific media inputs.
- Switched the interface and API feedback to English; model names no longer include task labels.
- Removed content-profile controls; mapped DreamVideo 1.5 to Wan and excluded Vidu Q2 from the launch menu.
- Updated Gemini model identifiers and supported image presets; covered 46 task/model request combinations with local contract tests.

- Split Assets and Settings into dedicated media-input and generation-parameter panels.
- Added model-specific TTS language menus with uniform names/codes and shared-language filtering for multi-model runs.

## 0.2.4 — 2026-09-24

- Removed Library navigation, filtering, refresh, and historical-task loading from the playground.
- Kept an in-session results canvas so newly submitted generations remain visible and downloadable.
- Made the model picker close when the user clicks anywhere outside the picker or its trigger.

## 0.2.3 — 2026-09-23

- Added a provider-connection introduction for fal.ai, Replicate, and future adapters.
- Clarified that every provider requires its own credential, billing account, and tested adapter.
- Documented the multi-provider adapter responsibilities without claiming unimplemented integrations.

## 0.2.2 — 2026-09-23

- Renamed all public runtime configuration variables to the provider-neutral `LOCAL_STUDIO_*` namespace.
- Updated Docker, Render, tests, documentation, and release packaging to use the neutral project identity.
- Preserved all 42 mapped API capability entries and the compatible provider adapter.

## 0.2.1 — 2026-09-23

- Rebranded the user-facing product as Local AI Media Studio.
- Added an explicit independent-project and non-affiliation notice.
- Removed provider branding from the header, onboarding, PWA name, icon, dialogs, and release package.
- Added a strict regression check that preserves all 42 mapped API entries.

## 0.2.0 — 2026-09-23

- Added an installable PWA layout for iPhone, iPad, and Windows browsers.
- Added Simple and Pro experiences for creators and batch users.
- Added hosted-session isolation for multi-user deployments.
- Added local and hosted storage explanations inside the product.
- Added service-worker shell caching and install guidance.
- Added Docker deployment, GitHub checks, release packaging, and project governance files.
- Preserved the dependency-free Node.js local runtime and all 42 mapped API capability entries.

## 0.1.0

- Initial local AI media generation workspace.
