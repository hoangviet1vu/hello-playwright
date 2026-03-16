# Test 2 · Clicking Login with CIID redirects to CIID Identity Provider

**File:** `tests/login.spec.ts` — line 27  
**Page objects:** `tests/pages/LoginPage.ts`, `tests/pages/CiidIdpPage.ts`

## Purpose

Verifies that clicking the login button on the homepage triggers a correct
**OAuth 2.0 Authorization Code + PKCE** redirect to the CIID Identity
Provider (Keycloak). This ensures:

- The app constructs a valid authorization URL.
- PKCE parameters (`code_challenge`, `code_challenge_method`) are present,
  proving the app uses the secure PKCE flow rather than plain OAuth.
- The `redirect_uri` points back to the SaaS app so the auth code will be
  delivered to the right place.

## Steps

| # | Action | How |
|---|--------|-----|
| 1 | Open the app homepage | `LoginPage.goto()` |
| 2 | Click the login button | `LoginPage.clickLoginWithCiid()` — waits for the button to be visible, then clicks |
| 3 | Wait for the CIID IdP page | `CiidIdpPage.waitForPage()` — waits for URL to match `integrated-id.jpn.panasonic.com` and for the username field to appear |
| 4 | Assert we are on the IdP | `CiidIdpPage.assertOnIdpPage()` — checks URL, username field visible, submit button visible |
| 5 | Assert PKCE/OIDC URL params | Reads `page.url()` and checks individual query parameters (see table below) |

## PKCE / OIDC parameter assertions

| Parameter | Expected | Why it matters |
|-----------|----------|----------------|
| `client_id` | Any non-empty value | Identifies the app to the IdP |
| `redirect_uri` | Contains `saasbpf.saas-dev.mira-pco.net` | Auth code must be delivered back to the app |
| `response_type` | `code` | Confirms Authorization Code flow (not implicit) |
| `code_challenge` | Any non-empty value | PKCE challenge — prevents code interception attacks |
| `code_challenge_method` | `S256` | SHA-256 PKCE — the secure method (not plain) |

## How the IdP page is detected

`CiidIdpPage` waits for the browser URL to match the IdP domain:

```typescript
await this.page.waitForURL(/integrated-id\.jpn\.panasonic\.com/, { timeout: 15_000 });
```

Then confirms the username input is rendered:

```typescript
await this.usernameInput.waitFor({ state: 'visible' });
```

## Key notes

- This test does **not** submit credentials — it only verifies the redirect
  and the authorization URL structure.
- The URL parameter check happens **after** the IdP page has loaded, which
  means the Keycloak login page has fully parsed the incoming request.

## What a failure here means

| Symptom | Likely cause |
|---------|-------------|
| `waitForURL` timeout | Button click did not trigger a redirect; app-level OAuth config broken |
| `redirect_uri` assertion fails | App is pointing to the wrong callback URL |
| `response_type` is not `code` | App switched to a different OAuth flow |
| `code_challenge` missing | PKCE was disabled on the app or IdP side |
| `code_challenge_method` is not `S256` | App downgraded to the insecure `plain` PKCE method |
