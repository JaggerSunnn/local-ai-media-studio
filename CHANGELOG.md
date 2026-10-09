# Changelog

## Ratio-aware batch galleries — 2026-10-09

- Displayed square and portrait outputs at the same column width with their natural height; landscape outputs use two columns per desktop row.
- Used actual image/video dimensions to correct requested aspect ratios, keeping the full output visible without a fixed-height letterbox.
- Added batch outlines and numbered headings to distinguish submissions sharing one prompt; retained sticky input summaries and comparison actions.
- Adapted galleries to two columns on smaller screens and one column on narrow phones.

## Full image previews — 2026-10-09

- Fixed portrait images overflowing and being clipped by comparison-card media grids.
- Sized images to the preview container with contain scaling, centered letterboxing, and a taller responsive image stage.


## Credit consumption display — 2026-10-09

- Added numeric-string credit parsing and authenticated usage backfill for completed tasks.
- Displayed Consumed credits on result cards and Total consumed with usage coverage per batch.
- Renamed the green minimum-consumption badge Cheapest, with shared formatting for later USD display.


## Generation comparisons — 2026-10-09

- Grouped each submission under a sticky prompt/input/settings summary and model result cards.
- Added actual timing/credit metadata, per-output cost display, and data-based Fastest/Lowest cost tags.
- Added Use as input, download, mute/unmute, and shared credits/USD display configuration.
- Removed Saved locally tags and protected hosted preview/reuse ownership.
- Added mouse hover previews for video/audio result cards, with pause-on-leave, mute preservation, and touch/manual-control fallback.


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
