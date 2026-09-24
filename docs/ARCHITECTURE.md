# Architecture

## Product modes

Local AI Media Studio uses one UI and a provider-adapter boundary in two modes. The current release ships with one compatible adapter; additional providers require separate credentials and an implementation of the same adapter contract.

### Local mode

- Listens on `127.0.0.1` only.
- Stores task history, uploads, and downloaded results in the local data directory.
- Uses a HttpOnly session cookie to refer to an API key held in Node.js memory.
- Shows absolute local storage paths in the UI.

### Hosted PWA mode

- Listens on the configured host and requires an HTTPS reverse proxy in production.
- Gives each browser a long-lived opaque client identity cookie.
- Associates task history with that identity and blocks cross-client listing or polling.
- Keeps API keys in short-lived server memory sessions.
- Presents iOS installation instructions and asks users to download results to their device.

Hosted isolation is an application boundary, not a complete SaaS identity system. A public commercial deployment should add authenticated accounts, a database, object storage, quotas, audit logs, and retention controls.

## Request flow

1. The UI requests the catalog from `/api/models`.
2. The user selects Category → Task → Model.
3. The UI renders inputs and options from the model definition.
4. Media is uploaded to `/api/assets` and written to the configured data directory.
5. The adapter obtains the configured provider's upload policy and uploads the media.
6. The adapter validates and submits a normalized provider request.
7. The UI polls the local task ID; the adapter polls the provider task ID.
8. Local mode downloads successful outputs into `data/outputs`.
9. The in-session results canvas displays output media and normalized metadata. The Playground does not load historical tasks when it starts.

## Multi-provider extension

API credentials are provider-specific. A fal key cannot authenticate against Replicate or the currently configured compatible endpoint, and the inverse is also true. A future provider picker should therefore store one in-memory session credential per provider and show the provider's own billing context.

Each provider adapter should implement these responsibilities:

1. Validate its own credential without writing it to task history or browser storage.
2. Declare supported Category → Task → Model mappings and safe defaults.
3. Upload or reference input media using the provider's required format.
4. Translate the normalized job into the provider's request schema.
5. Poll synchronous or asynchronous jobs and normalize progress, failures, and results.
6. Normalize price estimates and usage metadata without presenting estimates as final charges.
7. Download outputs through the existing local storage boundary.

The provider picker must label an adapter as available only after its authentication, submission, polling, and result paths have contract tests. A provider mentioned in product copy is not considered supported until those tests pass.

## Trust boundaries

- API keys never enter task records.
- Provider task IDs are held by the adapter and exposed only through owned local task records.
- Non-GET requests require the browser Origin to match the HTTP Host.
- File names and output paths are constrained before filesystem access.
- Uploads are limited to 25 MB per request.
- Known cost estimates are checked against `MAX_TASK_CREDITS`.
- Batch submission is capped in the UI and each job is validated again by the server.

## Known production gaps

- JSON task history should become SQLite for a distributed or high-volume deployment.
- Hosted output files need durable object storage and signed access URLs.
- Hosted sessions need real user authentication and revocation.
- Model contracts need paid smoke tests before each public catalog release.
- Pricing metadata is incomplete for dynamically priced models.
- The current in-memory upload map does not survive a process restart before submission.
