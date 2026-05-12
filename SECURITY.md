# Security Policy

## Reporting Vulnerabilities

Please report security issues through GitHub private vulnerability reporting for this repository instead of opening a public issue.

Include:

- Affected component or endpoint.
- Steps to reproduce.
- Expected and observed impact.
- Any relevant logs with secrets removed.

## Sensitive Data

Do not include API keys, tokens, private keys, cloud credentials, customer data, or production infrastructure details in issues, pull requests, logs, screenshots, or test fixtures.

## Local Development

OpenGeni runs agents that can execute tools in configured sandboxes. Review `.env` carefully before running live sessions, especially sandbox preparation profiles and `OPENGENI_SANDBOX_ENV_ALLOWLIST`.

The base API does not yet ship built-in authentication, tenancy, RBAC, API keys, or scoped client permissions. Put OpenGeni behind a trusted product, gateway, VPN, or reverse proxy before exposing it beyond local development.

No model provider credentials are automatically exposed inside agent sandboxes. Only expose host credentials through explicit preparation profiles or allowlists, and prefer short-lived credentials.
