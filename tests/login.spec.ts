import { test, expect } from '@playwright/test';
import { LoginPage }   from './pages/LoginPage';
import { CiidIdpPage } from './pages/CiidIdpPage';
import { AppPage }     from './pages/AppPage';

const LOGIN_BUTTON_TEXT = /^(Login with CIID|ログイン)$/;

// ─────────────────────────────────────────────────────────────────────────────
// Full CIID OAuth / OIDC Login Flow
// ─────────────────────────────────────────────────────────────────────────────

test.describe('CIID Authentication — Full OAuth Flow', () => {

  // ── Step 1: Homepage loads & CTA is present ────────────────────────────────
  test('1 · Homepage displays the Login with CIID button', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();

    await expect(loginPage.loginWithCiidButton).toBeVisible();
    await expect(loginPage.loginWithCiidButton).toBeEnabled();
    await expect(loginPage.loginWithCiidButton).toHaveClass(/pcoui-button--primary/);
    await expect(loginPage.loginWithCiidButton).toHaveText(LOGIN_BUTTON_TEXT);
  });

  // ── Step 2: Click → redirected to CIID IdP ────────────────────────────────
  test('2 · Clicking Login with CIID redirects to CIID Identity Provider', async ({ page }) => {
    const loginPage   = new LoginPage(page);
    const ciidIdpPage = new CiidIdpPage(page);

    await loginPage.goto();
    await loginPage.clickLoginWithCiid();

    await ciidIdpPage.waitForPage();
    await ciidIdpPage.assertOnIdpPage();

    // Verify PKCE / OIDC params are present in the IdP URL
    const url = new URL(page.url());
    expect(url.searchParams.get('client_id'),             'client_id must be set').toBeTruthy();
    expect(url.searchParams.get('redirect_uri'),          'redirect_uri must point back to the app')
      .toContain('saasbpf.saas-dev.mira-pco.net');
    expect(url.searchParams.get('response_type'),         'response_type must be code').toBe('code');
    expect(url.searchParams.get('code_challenge'),        'PKCE code_challenge must be set').toBeTruthy();
    expect(url.searchParams.get('code_challenge_method'), 'PKCE method must be S256').toBe('S256');
  });

  // ── Step 3–5: Full end-to-end happy path ──────────────────────────────────
  test('3 · Full flow: login → callback → access_token + refresh_token loaded', async ({ page }) => {
    const loginPage   = new LoginPage(page);
    const ciidIdpPage = new CiidIdpPage(page);
    const appPage     = new AppPage(page);

    // ── 3a. Navigate to SaaS app ────────────────────────────────────────────
    await loginPage.goto();

    // ── 3b. Register token capture BEFORE initiating the OAuth flow ──────────
    // The app stores tokens in memory only; we intercept the token exchange
    // response from the network before it is consumed by the application.
    const tokenCapture = appPage.captureTokenExchange();

    // ── 3c. Click "Login with CIID" ─────────────────────────────────────────
    await loginPage.clickLoginWithCiid();

    // ── 3d. Wait for CIID IdP page ──────────────────────────────────────────
    await ciidIdpPage.waitForPage();
    await ciidIdpPage.assertOnIdpPage();

    // ── 3e. Submit credentials (from env vars) ──────────────────────────────
    await ciidIdpPage.loginWithCredentials();   // reads CIID_USERNAME / CIID_PASSWORD

    // ── 3f. Assert no error shown on IdP ────────────────────────────────────
    await ciidIdpPage.assertNoLoginError();

    // ── 3g. Wait for redirect back to SaaS app ──────────────────────────────
    await appPage.waitForAuthCallback();
    await appPage.assertRedirectedBackToApp();

    // ── 3h. Verify tokens captured from the token exchange network response ──
    const tokens = await appPage.assertTokensLoaded(await tokenCapture);

    // ── 3h. Optionally decode & inspect the access token claims ─────────────
    const claims = await appPage.decodeJwtPayload(tokens.accessToken);
    console.log('[access_token claims]', JSON.stringify(claims, null, 2));

    // Basic claim sanity checks — adjust to your realm's token structure
    expect(claims['sub'],               'sub claim must be present').toBeTruthy();
    expect(typeof claims['exp'],        'exp must be a number').toBe('number');
    expect((claims['exp'] as number),   'token must not be expired')
      .toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

});
