# Security policy

## Supported versions

Security fixes are applied to the latest tagged release.

## Reporting a vulnerability

Do not post API keys, private media, or security reports in a public issue. Use GitHub's private vulnerability reporting for this repository when available. Include the affected version, reproduction steps, and expected impact. Remove all credentials and private media from screenshots and logs.

## API key handling

- The local runtime keeps a UI-entered key in process memory for up to eight hours.
- The key is not written to task history, browser storage, or the repository.
- Hosted deployments keep keys in server memory. Deploy the hosted mode only on infrastructure you trust.
- If a key is exposed, revoke or rotate it from the relevant API provider dashboard immediately.
