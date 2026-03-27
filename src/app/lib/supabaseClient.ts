import { createClient } from "@supabase/supabase-js";
import { env } from "@/config/env";

// ─── Custom lock — bypasses Web Locks API ─────────────────────────────────────
//
// @supabase/gotrue-js uses the Web Locks API (navigator.locks) to serialise
// token-refresh calls across tabs. In React Strict Mode every useEffect runs
// twice (mount → cleanup → mount), which causes the first mount to hold the
// lock while the second mount waits — triggering the 5 s timeout warning.
//
// Because this is a single-tab agent portal we don't need cross-tab locking.
// Providing a no-op lock function removes the wait entirely: the callback is
// called immediately and concurrency is handled by the JS event loop instead.
//
// Type: (name: string, acquireTimeout: number, fn: () => Promise<T>) => Promise<T>
const noOpLock = <T>(_name: string, _timeout: number, fn: () => Promise<T>): Promise<T> =>
  fn();

// ─── Singleton Supabase client ────────────────────────────────────────────────
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,        // session survives page refresh (localStorage)
    storageKey: "qht_agent_v2",  // unique key — avoids collisions with other apps
    autoRefreshToken: true,      // JWT silently refreshed before expiry
    detectSessionInUrl: false,   // we don't use magic-link redirects
    lock: noOpLock,              // prevent Strict Mode double-mount lock timeout
  },
});
