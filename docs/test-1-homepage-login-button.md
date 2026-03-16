# Test 1 · Homepage displays the Login with CIID button

**File:** `tests/login.spec.ts` — line 15  
**Page object:** `tests/pages/LoginPage.ts`

## Purpose

Verifies that when the SaaS BPF application is loaded, a clearly visible and
enabled primary-style login button is present on the homepage. This is the
entry point for the entire OAuth flow. If this button is missing or broken,
no login can proceed.

## Steps

| # | Action | How |
|---|--------|-----|
| 1 | Open the app homepage | `LoginPage.goto()` navigates to `baseURL` (`https://saasbpf.saas-dev.mira-pco.net/`) and waits for the network to go idle |
| 2 | Assert button is visible | `toBeVisible()` — checks the button exists in the DOM and is not hidden |
| 3 | Assert button is enabled | `toBeEnabled()` — checks the button does not have the `disabled` attribute |
| 4 | Assert button has the primary CSS class | `toHaveClass(/pcoui-button--primary/)` — confirms it is styled as the main call-to-action |
| 5 | Assert button label | `toHaveText(/^(Login with CIID\|ログイン)$/)` — accepts either the English or Japanese label |

## How the button is located

`LoginPage` uses a **role-based locator**:

```typescript
page.getByRole('button', { name: /^(Login with CIID|ログイン)$/ })
```

This is resilient to HTML structure changes — it finds the button by its
accessible role and visible label rather than a CSS selector or element ID.

## Key notes

- All `expect()` calls in Playwright **auto-retry** for up to 5 seconds, so
  the test tolerates slow page renders without manual waits.
- The text regex accepts both `Login with CIID` (English) and `ログイン`
  (Japanese) because the app currently renders the button in Japanese in this
  environment.
- This test is **read-only** — it does not click the button or trigger any
  navigation.

## What a failure here means

| Symptom | Likely cause |
|---------|-------------|
| `element not found` | The button selector changed or the page failed to load |
| `toBeVisible() failed` | The button exists but is hidden (CSS, conditional render) |
| `toBeEnabled() failed` | The button is intentionally disabled (e.g. feature flag) |
| `toHaveClass() failed` | The CSS class name was renamed in the UI framework |
| `toHaveText() failed` | The button label changed to a string not yet covered by the regex |
