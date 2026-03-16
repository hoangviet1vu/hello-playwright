import { type Page, type Locator, expect } from '@playwright/test';
import { ENV } from '../env';

/**
 * Page Object — CIID Identity Provider (Keycloak)
 * URL: https://dev001.integrated-id.jpn.panasonic.com/idp/realms/...
 *
 * The CIID login flow can be either:
 *   - a single page with username + password, or
 *   - a staged flow where username is submitted first and password is shown next.
 */
export class CiidIdpPage {
  readonly page: Page;

  // Form fields — Keycloak standard selectors
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    const genericError = page.locator('#input-error, .alert-error, [class*="error"]').first();
    const authFailedText = page.getByText(/認証に失敗しました。|authentication failed/i).first();

    this.usernameInput = page.locator('input#username, input[name="username"]').first();
    this.passwordInput = page.locator('input#password, input[name="password"]').first();
    this.submitButton  = page.locator('input[type="submit"], input[name="login"], button[type="submit"]').first();
    this.errorMessage  = genericError.or(authFailedText).first();
  }

  /** Wait until the Keycloak IdP page is fully loaded */
  async waitForPage() {
    await this.page.waitForURL(/integrated-id\.jpn\.panasonic\.com/, { timeout: 15_000 });
    await this.page.waitForLoadState('networkidle');
    await this.usernameInput.waitFor({ state: 'visible' });
  }

  /** Assert we are on the CIID IdP login page */
  async assertOnIdpPage() {
    await expect(this.page).toHaveURL(/integrated-id\.jpn\.panasonic\.com/);
    await expect(this.usernameInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  /** Fill credentials from environment variables and submit */
  async loginWithCredentials(username?: string, password?: string) {
    const user = username ?? ENV.CIID_USERNAME();
    const pass = password ?? ENV.CIID_PASSWORD();

    await this.usernameInput.fill(user);

    const isPasswordVisible = await this.passwordInput.isVisible().catch(() => false);
    if (!isPasswordVisible) {
      await this.submitButton.click();
      await this.passwordInput.waitFor({ state: 'visible' });
    }

    await this.passwordInput.fill(pass);
    await this.submitButton.click();
  }

  /** Assert no login error is shown */
  async assertNoLoginError() {
    await this.page.waitForLoadState('networkidle').catch(() => undefined);
    await this.errorMessage.waitFor({ state: 'visible', timeout: 1_000 }).catch(() => undefined);

    const isErrorVisible = await this.errorMessage.isVisible().catch(() => false);
    if (isErrorVisible) {
      const msg = await this.errorMessage.textContent();
      throw new Error(`CIID login failed — IdP error: "${msg?.trim()}"`);
    }
  }
}
