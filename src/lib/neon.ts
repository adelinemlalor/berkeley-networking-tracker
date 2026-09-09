'use client';

/**
 * The single Neon client for the whole app.
 *
 * This is the "two-URL object form": one HTTPS endpoint for Managed Better Auth, one for the
 * Data API. Both are NEXT_PUBLIC_ on purpose -- they are addresses, not credentials. Once a
 * user signs in, neon-js attaches their JWT to every Data API request automatically, and
 * Postgres decides what that identity is allowed to see. No database password ever reaches
 * the browser, and there is no privileged code path in the bundle to steal.
 *
 * The BetterAuthReactAdapter is what gives us the `useSession()` hook used across the UI.
 */
import { createClient } from '@neondatabase/neon-js';
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters';

const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
const dataApiUrl = process.env.NEXT_PUBLIC_NEON_DATA_API_URL;

if (!authUrl || !dataApiUrl) {
  // Failing loudly here beats a confusing "fetch failed" from deep inside the SDK later.
  throw new Error(
    'Missing Neon configuration. Set NEXT_PUBLIC_NEON_AUTH_URL and NEXT_PUBLIC_NEON_DATA_API_URL ' +
      '(copy .env.example to .env.local, or add them in your Vercel project settings).',
  );
}

export const neon = createClient({
  auth: { adapter: BetterAuthReactAdapter(), url: authUrl },
  dataApi: { url: dataApiUrl },
});

export const auth = neon.auth;
