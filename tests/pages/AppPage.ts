import { type Page, type Locator, expect } from '@playwright/test';

/** Shape of tokens stored in localStorage / sessionStorage */
export interface AuthTokens {
  accessToken:  string;
  refreshToken: string;
  idToken?:     string;
  expiresIn?:   number;
}

/**
 * Page Object — SaaS BPF App (post-login)
 * URL: https://saasbpf.saas-dev.mira-pco.net/  (after OAuth callback)
 *
 * Responsible for:
 *  - Confirming the callback redirect landed correctly
 *  - Extracting & validating access_token / refresh_token from storage
 */
export class AppPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Wait for the OAuth callback redirect to complete and the app to load */
  async waitForAuthCallback() {
    // After the IdP posts the auth code, the app handles /auth/callback
    // then redirects to the root. Wait for that final navigation.
    await this.page.waitForURL(/saasbpf\.saas-dev\.mira-pco\.net/, { timeout: 30_000 });
    await this.page.waitForLoadState('networkidle');
  }

  /** Assert we are back on the SaaS app (not still on the IdP) */
  async assertRedirectedBackToApp() {
    await expect(this.page).toHaveURL(/saasbpf\.saas-dev\.mira-pco\.net/);
    await expect(this.page).not.toHaveURL(/integrated-id\.jpn\.panasonic\.com/);
  }

  /**
   * Register a one-time response listener for the OIDC token endpoint.
   * Call this BEFORE initiating the OAuth login flow so the listener is in
   * place when the app exchanges the auth code for tokens.
   *
   * Returns a Promise that resolves with the token response payload.
   */
  captureTokenExchange(): Promise<AuthTokens> {
    return new Promise((resolve, reject) => {
      const handler = async (response: import('@playwright/test').Response) => {
        if (!/\/protocol\/openid-connect\/token/.test(response.url())) return;
        if (response.status() !== 200) return;
        try {
          const body = await response.json();
          if (body?.access_token) {
            this.page.off('response', handler);
            resolve({
              accessToken:  body.access_token,
              refreshToken: body.refresh_token ?? '',
              idToken:      body.id_token,
              expiresIn:    body.expires_in,
            });
          }
        } catch { /* non-JSON response, ignore */ }
      };

      this.page.on('response', handler);

      // Reject after 60 s so the test gets a clear error if the exchange never fires
      setTimeout(() => {
        this.page.off('response', handler);
        reject(new Error('Token exchange response not captured within 60 s'));
      }, 60_000);
    });
  }

  /**
   * Assert that the captured tokens are valid (non-empty, JWT-shaped).
   * A JWT has exactly three dot-separated parts: header.payload.signature
   */
  async assertTokensLoaded(tokens: AuthTokens) {
    const isJwt = (t: string) => t.split('.').length === 3;

    expect(
      tokens.accessToken,
      'access_token must be present in the token exchange response'
    ).toBeTruthy();

    expect(
      isJwt(tokens.accessToken),
      `access_token must be a JWT (got: "${tokens.accessToken.slice(0, 40)}…")`
    ).toBe(true);

    expect(
      tokens.refreshToken,
      'refresh_token must be present in the token exchange response'
    ).toBeTruthy();

    expect(
      isJwt(tokens.refreshToken),
      `refresh_token must be a JWT (got: "${tokens.refreshToken.slice(0, 40)}…")`
    ).toBe(true);

    return tokens;
  }

  /** Decode a JWT payload without verification (for assertion purposes only) */
  async decodeJwtPayload(jwt: string): Promise<Record<string, unknown>> {
    return this.page.evaluate((token: string) => {
      const [, payload] = token.split('.');
      const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
      return JSON.parse(atob(padded));
    }, jwt);
  }
}
