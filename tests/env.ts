// Type-safe environment variable access for Playwright tests
// Load via .env file (see .env.example) or export in shell before running tests

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
      `Copy .env.example to .env and fill in the values.`
    );
  }
  return value;
}

export const ENV = {
  CIID_USERNAME: () => requireEnv('CIID_USERNAME'),
  CIID_PASSWORD: () => requireEnv('CIID_PASSWORD'),
  BASE_URL:      () => process.env['BASE_URL'] ?? 'https://saasbpf.saas-dev.mira-pco.net',
  IDP_BASE_URL:  () => process.env['IDP_BASE_URL'] ?? 'https://dev001.integrated-id.jpn.panasonic.com',
};
