# Test 3 · Full flow: login → callback → access_token + refresh_token loaded

**File:** `tests/login.spec.ts` — line 48  
**Page objects:** `tests/pages/LoginPage.ts`, `tests/pages/CiidIdpPage.ts`, `tests/pages/AppPage.ts`

## Purpose

The end-to-end happy path. Covers the complete OAuth 2.0 Authorization Code +
PKCE login cycle: from the SaaS app homepage, through credential submission on
the CIID Identity Provider, back to the SaaS app via the OAuth callback, and
finally validates that valid JWT tokens were issued.

## Full flow diagram

```
Browser                    SaaS App                  CIID IdP (Keycloak)
   |                           |                              |
   |── goto(/) ───────────────>|                              |
   |<── homepage ──────────────|                              |
   |                           |                              |
   |── click Login ───────────>|                              |
   |<── 302 redirect ──────────|── authorization request ────>|
   |──────────────────────────────────────────────────────────>|
   |<── IdP login page ────────────────────────────────────────|
   |                           |                              |
   |── enter username ─────────────────────────────────────-->|
   |<── password page ─────────────────────────────────────---|
   |── enter password ─────────────────────────────────────-->|
   |<── 302 redirect with auth code ───────────────────────---|
   |── GET /auth/callback?code=... ──────────────────────────>|
   |                           |── POST /token (auth code) ──>|
   |                           |<── access_token + refresh_token ─|
   |<── app loaded ────────────|                              |
   |                           |                              |
   |── GET /users/api/v0/users/profile ────────────────────────────────────────────────>| (EC API)
   |<── { email, status, role, … } ─────────────────────────────────────────────────────|
```

## Steps

| # | Label | Action |
|---|-------|--------|
| 3a | Navigate | `LoginPage.goto()` opens the homepage |
| 3b | Arm token capture | `AppPage.captureTokenExchange()` registers a network listener **before** the flow starts |
| 3c | Click login | `LoginPage.clickLoginWithCiid()` |
| 3d | Wait for IdP | `CiidIdpPage.waitForPage()` + `assertOnIdpPage()` |
| 3e | Submit credentials | `CiidIdpPage.loginWithCredentials()` — reads `CIID_USERNAME` / `CIID_PASSWORD` from environment |
| 3f | Assert no login error | `CiidIdpPage.assertNoLoginError()` — fails fast if the IdP returns an auth error |
| 3g | Wait for callback | `AppPage.waitForAuthCallback()` + `assertRedirectedBackToApp()` |
| 3h | Validate tokens | `AppPage.assertTokensLoaded(await tokenCapture)` — checks both JWTs are valid |
| 3h² | Decode & inspect claims | `AppPage.decodeJwtPayload()` — decodes the access token and checks `sub` and `exp` claims |
| 3i | Call profile API | `GET ${EC_URL}/users/api/v0/users/profile` with `Authorization: Bearer <access_token>` — validates the user's profile on the SaaS platform |

## How the two-step IdP login is handled

The CIID IdP uses a **staged login form**: the username is submitted first,
then the password page appears separately. `CiidIdpPage.loginWithCredentials()`
handles both layouts:

```typescript
await this.usernameInput.fill(user);

// Check if this is a single-page form (password already visible)
// or a staged form (need to submit username first)
const isPasswordVisible = await this.passwordInput.isVisible().catch(() => false);
if (!isPasswordVisible) {
  await this.submitButton.click();              // submit username
  await this.passwordInput.waitFor({ state: 'visible' }); // wait for password page
}

await this.passwordInput.fill(pass);
await this.submitButton.click();               // submit password
```

## Why network interception is used for token capture

The app holds tokens **in memory only** — they are not written to
`localStorage`, `sessionStorage`, `IndexedDB`, or any readable cookie on the
app domain. The only reliable way to capture them is to intercept the HTTP
response from the token endpoint before the app consumes it.

`AppPage.captureTokenExchange()` registers a `page.on('response')` listener
that watches for a response from `/protocol/openid-connect/token` with HTTP
200, then resolves the returned Promise with the parsed token payload.

**Important:** the listener must be registered **before** `clickLoginWithCiid()`
because the token exchange happens during the OAuth callback — if the listener
is registered too late, the response may already have been received.

## Token assertions

| Check | Details |
|-------|---------|
| `access_token` is truthy | Token is non-empty |
| `access_token` is a JWT | Has exactly 3 dot-separated parts (`header.payload.signature`) |
| `refresh_token` is truthy | Token is non-empty |
| `refresh_token` is a JWT | Has exactly 3 dot-separated parts |
| `sub` claim present | The token identifies a user |
| `exp` is a number | Expiry claim exists and is numeric |
| `exp` is in the future | The token is not already expired at the time of issue |
| Profile API returns 2xx | `GET /users/api/v0/users/profile` succeeds with the Bearer token |
| `profile.email === CIID_USERNAME` | The authenticated user's email matches the test account |
| `profile.status === 'ACTIVATED'` | The account is active on the SaaS platform |
| `profile.role` is not null / undefined | A role object is assigned to the user |

## Environment variables required

| Variable | Purpose |
|----------|---------|
| `CIID_USERNAME` | The CIID account username / email to log in with |
| `CIID_PASSWORD` | The CIID account password |
| `EC_URL` | Base URL of the SaaS platform API (default: `https://api.saasbpf.saas-dev.mira-pco.net`) |

These are loaded from a `.env` file in the project root via `global-setup.ts`.

## What a failure here means

| Symptom | Likely cause |
|---------|-------------|
| `CIID login failed — IdP error: "認証に失敗しました。"` | Wrong `CIID_USERNAME` or `CIID_PASSWORD` in `.env` |
| `Token exchange response not captured within 60 s` | The app never made a POST to the token endpoint; callback handling broken |
| `access_token must be present` | Token endpoint returned an error response (check IdP logs) |
| `access_token must be a JWT` | Token format changed (e.g. opaque token instead of JWT) |
| `token must not be expired` | System clock skew between test machine and IdP |
| `waitForURL` timeout on callback | The `redirect_uri` in the app config does not match the registered client on the IdP |
| `profile API call must return 2xx` | The access token was rejected by the EC API — token may be expired, or `EC_URL` is misconfigured |
| `email must match CIID_USERNAME` | The profile email returned by the API does not match the test account in `.env` |
| `status must be ACTIVATED` | The test account is not active on the SaaS platform |
| `role must not be null or undefined` | The test account has no role assigned |
