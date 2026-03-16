# CIID OAuth / OIDC Login — Playwright E2E Tests

Automated end-to-end tests for the SaaS BPF application's CIID authentication
flow, built with [Playwright](https://playwright.dev/).

## Prerequisites

- Node.js 18+
- `npm install`
- `npx playwright install --with-deps chromium firefox`
- A `.env` file in the project root (copy `.env.example` and fill in values)

```
CIID_USERNAME=your-email@example.com
CIID_PASSWORD=your-password
```

## Running the tests

```bash
# Run all tests (Chromium + Firefox)
npm test

# Run headed (see the browser)
npm run test:headed

# Run a single test by name
npx playwright test --grep "1 · Homepage"
npx playwright test --grep "2 · Clicking"
npx playwright test --grep "3 · Full flow"

# Open the HTML report after a run
npm run report
```

## Test suite

All tests live in `tests/login.spec.ts` and cover the full CIID OAuth 2.0
Authorization Code + PKCE login cycle.

| # | Test name | What it proves | Doc |
|---|-----------|---------------|-----|
| 1 | Homepage displays the Login with CIID button | The login entry point is visible, enabled, and styled correctly | [docs/test-1-homepage-login-button.md](docs/test-1-homepage-login-button.md) |
| 2 | Clicking Login with CIID redirects to CIID Identity Provider | The app builds a valid PKCE authorization URL and redirects to the IdP | [docs/test-2-ciid-redirect.md](docs/test-2-ciid-redirect.md) |
| 3 | Full flow: login → callback → access_token + refresh_token loaded | The complete login cycle works and issues valid JWT tokens | [docs/test-3-full-login-flow.md](docs/test-3-full-login-flow.md) |

## Project structure

```
├── playwright.config.ts       # Playwright configuration (baseURL, browsers, global setup)
├── global-setup.ts            # Loads .env and validates required env vars before tests run
├── tests/
│   ├── env.ts                 # Type-safe environment variable helpers
│   ├── login.spec.ts          # All test cases
│   └── pages/
│       ├── LoginPage.ts       # Page object for the SaaS app homepage
│       ├── CiidIdpPage.ts     # Page object for the CIID Identity Provider (Keycloak)
│       └── AppPage.ts         # Page object for the app post-login + token capture
└── docs/
    ├── test-1-homepage-login-button.md
    ├── test-2-ciid-redirect.md
    └── test-3-full-login-flow.md
```

## Architecture

The tests follow the **Page Object Model (POM)** pattern. Each page the
browser visits has a corresponding class in `tests/pages/` that owns:

- **Locators** — how to find elements on that page
- **Actions** — how to interact with that page
- **Assertions** — what to verify on that page

This keeps the test files focused on *what* is being tested, not *how* to
operate the UI.

### Key design decisions

**Token capture via network interception**  
The SaaS app stores OAuth tokens in memory only (not in `localStorage`,
`sessionStorage`, or cookies). Test 3 captures them by listening to the HTTP
response from the OIDC token endpoint (`/protocol/openid-connect/token`)
before the app consumes it. The listener must be registered before the login
flow starts.

**Staged CIID login support**  
The CIID IdP presents a two-step form: username first, then password on a
second page. `CiidIdpPage.loginWithCredentials()` detects which layout is
active and handles both automatically.

**Locale-tolerant locators**  
The login button label is currently rendered in Japanese (`ログイン`). All
locators and text assertions use regexes that accept both the English and
Japanese label so the tests remain stable regardless of locale.
