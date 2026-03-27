/**
 * Central environment configuration.
 *
 * All VITE_* variables are validated at startup — the app will throw a clear
 * error immediately rather than silently failing on the first API call.
 *
 * Usage:
 *   import { env } from '@/config/env';
 *   fetch(env.serverUrl, { ... });
 */

const requiredEnvVars = {
  supabaseUrl:    import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  n8nWebhookUrl:  import.meta.env.VITE_N8N_WEBHOOK_URL,
} as const;

// Fail fast — surface a descriptive error rather than a cryptic fetch failure
Object.entries(requiredEnvVars).forEach(([key, value]) => {
  if (!value) {
    const envKey = key.replace(/([A-Z])/g, '_$1').toUpperCase();
    throw new Error(
      `Missing required environment variable: VITE_${envKey}\n` +
      `Add it to .env.local (local dev) or your hosting platform's env settings.`
    );
  }
});

/** Supabase project ID derived from the URL — used for display-only UI hints. */
const projectId = requiredEnvVars.supabaseUrl
  .replace('https://', '')
  .split('.')[0];

export const env = {
  ...requiredEnvVars,
  /** Edge function base URL — derived from supabaseUrl, not a separate env var. */
  serverUrl: `${requiredEnvVars.supabaseUrl}/functions/v1/make-server-9c23c834`,
  /** Project ID string — only used in UI text that guides users to the dashboard. */
  projectId,
} as const;
