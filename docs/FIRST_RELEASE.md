# First-release configuration

The UI is English-only. The model picker shows model names; Task describes the generation mode. Simple/Pro and content-profile controls are removed. The server retains its existing validation.

`public/launch-config.js` defines the first-release menu, explicit default models, and task-specific input contracts. The browser and local server share this configuration. The original 42-entry provider catalog remains available; the launch menu exposes 12 tasks and 46 task/model combinations.

| Category | Task | Default model | Default settings |
| --- | --- | --- | --- |
| Video | Text to Video | DreamVideo 3.0 | 480P, 5 seconds, auto, 1 run |
| Video | Image to Video | DreamVideo 3.0 | 480P, 5 seconds, auto, 1 run |
| Video | First / Last Frame (FLF) | DreamVideo 3.0 | 480P, 5 seconds, auto, 1 run; both frames required |
| Video | Reference to Video | Seedance 2.5 | 480p, 5 seconds, adaptive, 1 run; at least one reference required |
| Image | Text to Image | GPT Image 2 | 848×480, low quality, 1 image, 1 run |
| Image | Image to Image | GPT Image 2 | 848×480, low quality, 1 image, 1 run; reference required |
| Image | Image Editing | Enhance | Original image specification, 1 run |
| Audio | Text to Speech | Do TTS Common | English (`en`), published example voice ID, 1 clip, 1 run |
| Audio | Voice Clone | Voice Clone | 1 original-specification sample, 1 run; produces a cloneId |
| Avatar | Talking Avatar | DreamAvatar 3.0 Fast | 480p, 1 run |
| Avatar | Lip Sync | LipSync 2.0 | Original dimensions, enhancement off, 1 run |
| Avatar | Motion Transfer | DreamAct | 480P, replace_body, base quality, 1 run |

## Model mapping and supported presets

- DreamVideo 1.5 is the display name for Wan 2.1, as confirmed by the product owner. It uses the existing text, image, and head/tail endpoints. Its duration and aspect ratio follow provider defaults because those controls are not exposed by the published endpoints. Vidu Q2 is excluded for now.
- Text/image video tasks offer DreamVideo 3.0, DreamVideo 1.5, Seedance 2.5, Seedance 2.0, and Seedance 2.0 Mini. Reference to Video offers the three Seedance variants.
- Text to Image offers Flux, Seedream, Nano Banana 2/Pro, GPT Image 2, and GPT Image 2.5 Flare/Sunburst. Image to Image adds DreamImage 2.0. Image Editing offers Enhance, Colorize, Outpainting, Swapface, and Remove Background.
- GPT Image 2 and Flux use 848×480 to satisfy 16-pixel alignment while approximating 16:9. GPT Image 2.5 uses 1280×720 because a 480p preset falls below its documented minimum pixel count. In multi-model runs, invalid shared GPT Image 2.5 dimensions fall back to its valid default.
- Nano Banana 2 uses 512; Pro uses 1K. Both default to 16:9. Seedream uses 1K; aspect ratio is described in the prompt. DreamImage and editing APIs retain input/model specifications instead of receiving an invented 480p parameter.
- TTS languages are configured by model in `public/languages.js`: Common has 5 languages and Pro has 7, based on the current bundled voice catalog; Clone has the 17-language enum in its public API documentation. Labels use `Language name (provider-code)` throughout, for example `Spanish (es)`. Multi-model TTS displays the intersection of the selected models' configured languages. The API receives only codes, never display labels or the unverified `zh-EN` code. The default voice IDs come from the published Common/Pro API examples. Changing language requires a compatible voice ID. Do TTS Clone requires an existing cloneId; its required field is also shown when added to a multi-model TTS run.
- Swapface requires both a source image and a face image. The extra face field appears when Swapface is added to a multi-model editing run. Outpainting defaults to extending the left edge by 128 pixels.

## Validation and local operation

Run `npm start`, then visit http://127.0.0.1:8788/. Connect an API key in the browser. Keys are held in memory and must be reconnected after a server restart. `npm run dev` is a demonstration mode, not live generation.

`npm run check` validates syntax, the 42-entry catalog, and PWA configuration. `npm test` uses a local test provider to check all 46 launch combinations, task-specific media requirements, provider request serialization, batch submission, local result saving, key non-persistence, and browser isolation. These checks do not prove real-provider generation quality or account access and do not incur provider charges.

## Public references checked on 2026-10-08

- [API reference](https://api.newportai.com/api-docs)
- [DreamVideo 3.0](https://api.newportai.com/api-docs/dreamvideo-3.0)
- [GPT Image 2](https://api.newportai.com/api-docs/gpt-image)
- [GPT Image 2.5 Flare](https://api.newportai.com/api-docs/gpt-image-2.5-flare)
- [Nano Banana 2](https://api.newportai.com/api-docs/nano-banana-2)
- [Nano Banana Pro](https://api.newportai.com/api-docs/nano-banana-pro)
- [Seedream 5.0 Pro](https://api.newportai.com/api-docs/seedream-5.0-pro)
- [Do TTS Common](https://api.newportai.com/api-docs/do-tts-common)
- [Do TTS Pro](https://api.newportai.com/api-docs/do-tts-pro)

## Inline inputs and Settings

Task-specific image, video, and audio upload cards appear directly to the left of the prompt. Text-only tasks do not show upload cards. Uploaded files stay in place as previews with replace/remove controls. Multiple files can be added up to the model limit; the first single-file input supports batch variants. Settings contains resolution, duration, dimensions, quality, language, voice IDs, and Runs per model. Output count is hidden and fixed to one per API request; Runs per model is the only quantity control. Uploads disable Run until they finish; switching tasks during an upload does not attach those files to the new task.

## Voice library (2026-10-09)

`Voice ID` replaces tier-specific labels for Common/Pro TTS. Users may paste any provider voice ID or open Browse voices. The scrollable picker filters by the current TTS model, language, gender, and name/ID search. Choosing a voice fills the same `audioId` input used by generation and updates the language if applicable. Per-model voice choices are retained when changing models; custom IDs are passed unchanged and validated by the provider. Clone TTS retains its separate cloneId requirement.

The bundled official response contains 232 voices: 196 Common and 36 Pro; 229 have sample URLs. Preview streams the existing sample directly and does not create or bill a generation task. Missing samples have a disabled No preview button. Choosing another sample or closing the dialog stops the previous player.

The source is the public website's `/s/api-playground/dream_api/v1/list_audio` endpoint, not a promised stable generation API. `/api/voices` exposes the bundled snapshot without requiring a key. Refresh fetches an updated directory without forwarding the user's API key; it updates the current server session only. If the website endpoint changes or is unreachable, the saved list and manual entry remain available. An installer update can ship a newer snapshot.

## Web feature view

The standalone top navigation and Install app entry are hidden from the generation interface. The API key connection button and status are located in the composer toolbar, so the feature can sit inside a host website without duplicating its navigation.

## Grouped model comparisons

Each Run captures one batch ID, selected models, full prompt, requested settings, original media previews, and expected task count. The left summary sticks within that batch while the right cards scroll. Repeated runs and different input variants have separate comparison keys. The page restores submissions from the last 24 hours without adding a separate Library navigation; task files remain stored according to the existing local retention behavior. Older records with matching fingerprints/prompts and submissions within two seconds can be recovered as an explicitly labeled group; missing input previews and costs are not fabricated.

Cards show model name, output specifications, file size, time, and cost. Provider executionTime is retained as milliseconds and shown as Generation time. When unavailable, measured time between local creation and completion is labeled Elapsed; it includes queue and polling. Fastest uses one consistent timing basis within the comparison. Cheapest requires reported credits for every successful compared model. Both tags wait until all expected tasks settle, require at least two successful distinct models, allow ties, and exclude mock tasks. Missing credits remain Credits pending. Multi-output task charges are divided evenly per media output and identified as an allocation in the tooltip.

The Saved locally card tag is removed. Use as input registers a saved output as a new input asset, using local media when available and automatically switching to a compatible task if the current task cannot accept that media type. Download remains available. Audio/video cards have mute/unmute controls, and playback state is retained when another model finishes. Hosted previews and reuse are checked against the browser's task/asset ownership.

### Cost display configuration

Credits are the persisted source of truth. `public/result-model.js` is the shared formatter for the batch, each card, and the estimated-cost toolbar. `LOCAL_STUDIO_COST_UNIT=credits` is the default. To switch all displayed costs to USD, set `LOCAL_STUDIO_COST_UNIT=usd` and `LOCAL_STUDIO_USD_PER_CREDIT` to the account's verified rate before starting the server or in the hosting platform's environment configuration. No individual card templates or saved credit values need editing.

### Hover media previews

Video and audio result media regions start a looping preview on mouse entry and pause on mouse exit. Preview preserves the current mute/unmute choice, starts from zero after reaching the end, and does not trigger on touch pointers. Manual playback already in progress is not stopped by merely moving the mouse out. If the browser blocks automatic playback, the native Play control remains available. Rerendering result groups stops detached preview players and only resumes a hover preview while the pointer remains over that card.

### Reported credit backfill

The adapter accepts finite nonnegative numbers and numeric decimal strings from `task.creditsConsumed` or `creditsConsumed`; estimates are never used as actual charges. Saved completed tasks can refresh usage through an authenticated POST to `/api/tasks/:id/usage`, preserving their existing media and status. The task records the reported field and lookup timestamp for auditing. Connecting a key queries missing recent usage; newly completed tasks with delayed billing can be retried at most three times, ten seconds apart. A batch also offers Fetch credits for a manual retry.

Cards show Consumed credits per output. The green Cheapest badge compares successful models' actual consumption and can coexist with Fastest. Total consumed sums task charges once, not each allocated output charge. Usage records shows how many tasks have a reported value. Partial totals include + pending and remain explicitly incomplete.

## Ratio-aware result gallery

Each prompt submission has a numbered heading and a sticky input summary. Batches are separated by spacing without an extra outer frame. Inside that batch, landscape outputs use two columns per desktop row; square and portrait outputs share a three-column width. Preview height follows the actual output ratio (1:1 is square; 9:16 is taller), so the full image remains visible without a fixed-height letterbox. Actual image/video dimensions override requested settings after loading. Mixed ratios are arranged into landscape and square/portrait bands within the same batch. Smaller screens use two columns, and narrow phones use one.
