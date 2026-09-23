# Deployment

## Windows local package

The repository is intentionally dependency-free at runtime. A customer can extract the release and double-click `start.bat` after installing Node.js 20+.

For a zero-prerequisite commercial package, bundle the Node.js runtime in the release or wrap this project with an installer. Keep the application bound to `127.0.0.1`; do not expose local mode to a LAN or the public internet.

## Hosted iOS PWA

iPhone and iPad cannot run the Node.js adapter from a downloaded ZIP. Host the application over HTTPS and set:

```text
DREAMAPI_DEPLOYMENT_MODE=hosted
HOST=0.0.0.0
```

After deployment, open the URL in Safari and use Share → Add to Home Screen.

### Docker

```bash
docker build -t dreamapi-local-studio .
docker run --rm -p 8788:8788 \
  -e DREAMAPI_DEPLOYMENT_MODE=hosted \
  -v dreamapi-data:/app/data \
  dreamapi-local-studio
```

Terminate TLS at a trusted reverse proxy. Forward the original protocol in `X-Forwarded-Proto` so cookies receive the Secure attribute.

### Render

The included `render.yaml` creates a starter web service. Add persistent storage before promising durable history. Free or ephemeral filesystems can lose uploads, history, and downloaded outputs during a restart or redeploy.

## Public production checklist

- Serve only over HTTPS.
- Add user accounts instead of relying only on a browser identity cookie.
- Move tasks to a database and outputs to object storage.
- Add per-user concurrency, rate, and spending limits.
- Add API key revocation and encrypted secret storage if keys must survive a session.
- Add retention and delete controls for user media.
- Add monitoring without logging API keys, prompts, or private media by default.
- Run contract tests against every advertised model.
- Document applicable content, consent, and age rules.

## GitHub Pages

GitHub Pages can serve only the static UI. This product also needs the Node.js adapter for API-key handling, uploads, polling, and result normalization. Do not publish only `public/` and claim that generation is supported.
