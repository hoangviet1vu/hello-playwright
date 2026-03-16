import { type Page, type Locator } from '@playwright/test';

const LOGIN_BUTTON_NAME = /^(Login with CIID|ログイン)$/;

/**
 * Page Object — SaaS BPF Login Page
 * URL: https://saasbpf.saas-dev.mira-pco.net/
 */
export class LoginPage {
  readonly page: Page;
  readonly loginWithCiidButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.loginWithCiidButton = page.getByRole('button', { name: LOGIN_BUTTON_NAME });
  }

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async clickLoginWithCiid() {
    await this.loginWithCiidButton.waitFor({ state: 'visible' });
    await this.loginWithCiidButton.click();
  }
}
