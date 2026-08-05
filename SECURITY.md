# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Hermes, please report it responsibly:

1. **Private reporting (preferred)**: Use GitHub's [private vulnerability reporting](https://github.com/JunWeiLi233/Hermesruns/security/advisories/new) feature. This keeps the report private until a fix is published.

2. **Security advisories**: You can also open a [security advisory](https://github.com/JunWeiLi233/Hermesruns/security/advisories) directly.

Please **do not** open a public issue for security vulnerabilities.

### Response timeline

- **Acknowledgment**: within 48 hours
- **Initial assessment**: within 1 week
- **Fix or mitigation**: depends on severity, typically within 2–4 weeks

## Supported versions

Only the latest release on `main` receives security updates.

## Scope

- Backend API authentication/authorization bypasses
- SQL injection or data leakage
- XSS or CSRF in the frontend
- Secret/key exposure in the codebase

Out of scope: the local dev-only mock account (`HermesDev2026!`) is a documented default for local testing only and is not a production credential.
