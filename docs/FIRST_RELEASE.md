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

## Assets and Settings panels

Assets opens a dedicated input-media panel with the image, video, and audio fields required by the current task. Text-only tasks show an explicit no-upload message. Settings opens a separate panel for resolution, duration, dimensions, quality, language, voice IDs, and runs per model. Opening either closes the other and the model picker. File uploads and settings retain their values when switching panels.

## Voice library (2026-10-09)

`Voice ID` replaces tier-specific labels for Common/Pro TTS. Users may paste any provider voice ID or open Browse voices. The scrollable picker filters by the current TTS model, language, gender, and name/ID search. Choosing a voice fills the same `audioId` input used by generation and updates the language if applicable. Per-model voice choices are retained when changing models; custom IDs are passed unchanged and validated by the provider. Clone TTS retains its separate cloneId requirement.

The bundled official response contains 232 voices: 196 Common and 36 Pro; 229 have sample URLs. Preview streams the existing sample directly and does not create or bill a generation task. Missing samples have a disabled No preview button. Choosing another sample or closing the dialog stops the previous player.

The source is the public website's `/s/api-playground/dream_api/v1/list_audio` endpoint, not a promised stable generation API. `/api/voices` exposes the bundled snapshot without requiring a key. Refresh fetches an updated directory without forwarding the user's API key; it updates the current server session only. If the website endpoint changes or is unreachable, the saved list and manual entry remain available. An installer update can ship a newer snapshot.

## Web feature view

The standalone top navigation and Install app entry are hidden from the generation interface. The API key connection button and status are located in the composer toolbar, so the feature can sit inside a host website without duplicating its navigation.
