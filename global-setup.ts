import { chromium, FullConfig } from '@playwright/test';

/**
 * Global setup — runs once before the entire test suite.
 *
 * Currently used to:
 *  1. Load .env file into process.env (if dotenv is installed)
 *  2. Validate required environment variables are present before tests start
 */
async function globalSetup(_config: FullConfig) {
  // ── Load .env file ──────────────────────────────────────────────────────
  // Install dotenv:  npm install --save-dev dotenv
  try {
    const { config } = await import('dotenv');
    config();                            // loads .env from project root
  } catch {
    // dotenv is optional — env vars can be provided by the shell / CI
  }

  // ── Validate required env vars ──────────────────────────────────────────
  const required = ['CIID_USERNAME', 'CIID_PASSWORD'];
  const missing  = required.filter(k => !process.env[k]);

  if (missing.length > 0) {
    throw new Error(
      `\n❌ Missing required environment variables:\n` +
      missing.map(k => `   • ${k}`).join('\n') +
      `\n\nCopy .env.example → .env and fill in the values, or export them in your shell.\n`
    );
  }

  console.log('✅ Environment variables validated');
}

export default globalSetup;
