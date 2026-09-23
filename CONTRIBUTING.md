# Contributing

Thank you for improving DreamAPI Local Studio.

## Development

1. Install Node.js 20 or newer.
2. Run `npm run dev` for mock mode.
3. Open `http://127.0.0.1:8788/`.
4. Run `npm run check && npm test` before opening a pull request.

No third-party npm packages are required by the runtime.

## Adding or changing a model

Update `catalog.mjs` and include:

- a unique model ID and user-facing name;
- the DreamAPI endpoint;
- output kind;
- required and optional inputs;
- API field mappings;
- valid option values and a conservative default;
- supported content profiles;
- verified pricing metadata when available.

Use the lowest broadly supported resolution, duration, and quality as defaults. Never claim a model or parameter was tested unless a real API request was completed. A new catalog entry must pass `npm run check` and should include a redacted request/response contract in the pull request description.

## Pull requests

Keep generated files, API keys, uploads, outputs, and task history out of commits. Explain the user-visible behavior, the affected task/model, and the validation performed.
