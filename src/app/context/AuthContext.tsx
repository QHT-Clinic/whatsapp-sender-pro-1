/**
 * AuthContext — QHT Agent Authentication  v5.0 (Three-Tier Roles)
 *
 * Role hierarchy:
 *   agent      — specific branch, sends messages, sees own logs
 *   admin      — specific branch, sees all logs for their branch only
 *   superadmin — branch = 'All', sees everything, can filter by branch
 *
 * Schema:
 *   profiles.role    CHECK IN ('agent','admin','superadmin')
 *   profiles.branch  CHECK IN ('Haridwar','Hyderabad','Delhi','Gurgaon','All')
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { env } from "@/config/env";

// ─── Types ────────────────────────────────────────────────────────────────────

/** All valid branch values (mirrors the DB CHECK constraint). */
export const BRANCHES = ["Haridwar", "Hyderabad", "Delhi", "Gurgaon"] as const;
export type BranchName = (typeof BRANCHES)[number];

/** All valid roles (mirrors the DB CHECK constraint). */
export type UserRole = "agent" | "admin" | "superadmin";

export interface AgentProfile {
  id:          string;
  name:        string;
  email:       string;
  role:        UserRole;           // 'agent' | 'admin' | 'superadmin'
  avatar_url:  string | null;
  branch:      string | null;      // 'Haridwar' | 'Hyderabad' | 'Delhi' | 'Gurgaon' | 'All' | null
  // Derived convenience flags (computed from role/branch, never stored)
  isSuperadmin: boolean;           // role === 'superadmin'
  isAdmin:      boolean;           // role === 'admin' || role === 'superadmin'
}

export type LoginResult =
  | { ok: true }
  | { ok: false; error: string };

interface AuthContextValue {
  session:          Session | null;
  profile:          AgentProfile | null;
  initialising:     boolean;
  /**
   * True when the /profile fetch failed with a network error.
   * Distinct from "profile loaded but missing role/branch" — that is a DB
   * configuration issue. This flag means we couldn't reach the server at all.
   * ProtectedRoute shows a retry screen instead of redirecting to /unauthorized.
   */
  profileLoadError: boolean;
  login(email: string, password: string): Promise<LoginResult>;
  logout(): Promise<void>;
  /** Manually re-fetch the profile (e.g. after a network error). */
  retryProfile(): Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Error classifier ─────────────────────────────────────────────────────────

function classifyError(raw: string): string {
  const s = raw.toLowerCase();

  if (
    s.includes("invalid login")       ||
    s.includes("invalid credentials") ||
    s.includes("invalid email")       ||
    s.includes("user not found")      ||
    s.includes("wrong password")      ||
    s.includes("email not confirmed")
  ) return "Invalid email or password. Please try again.";

  if (
    s.includes("failed to fetch")           ||
    s.includes("networkerror")              ||
    s.includes("network request failed")    ||
    s.includes("load failed")             ||
    s.includes("fetch")                   ||
    s.includes("timeout")                 ||
    s.includes("err_name_not_resolved")   ||
    s.includes("err_internet_disconnected")
  ) {
    return (
      "Connection error — cannot reach the server.\n" +
      "• Check your internet connection.\n" +
      "• Your Supabase project may be paused. Visit app.supabase.com → " +
      `select project '${env.projectId}' → click 'Restore project', ` +
      "wait 30 s, then try again."
    );
  }

  if (s.includes("rate limit") || s.includes("too many"))
    return "Too many login attempts. Please wait a minute and try again.";

  return `Login failed: ${raw}`;
}

// ─── Server URL ───────────────────────────────────────────────────────────────

const SERVER_URL = env.serverUrl;

// ─── Role normaliser ──────────────────────────────────────────────────────────
// Coerces any unknown DB string to a valid UserRole, falling back to 'agent'.

function normaliseRole(raw: unknown): UserRole {
  if (raw === "superadmin" || raw === "admin") return raw;
  return "agent";
}

// ─── Profile loader ───────────────────────────────────────────────────────────
// Returns { profile, loaded } where loaded=false means the fetch failed and
// we are using a minimal fallback — the caller must NOT treat this as a
// confirmed "account not provisioned" situation.

async function loadProfile(
  userId:      string,
  email:       string,
  accessToken: string,
  metaName?:   string | null,
  metaRole?:   string | null,
  metaAvatar?: string | null
): Promise<{ profile: AgentProfile; loaded: boolean }> {

  const fallbackRole = normaliseRole(metaRole);
  const fallback: AgentProfile = {
    id:          userId,
    email,
    name:        metaName || email.split("@")[0] || "Agent",
    role:        fallbackRole,
    avatar_url:  metaAvatar || null,
    // Superadmin fallback: use 'All' so ProtectedRoute never blocks them
    branch:      fallbackRole === "superadmin" ? "All" : null,
    isSuperadmin: fallbackRole === "superadmin",
    isAdmin:      fallbackRole === "admin" || fallbackRole === "superadmin",
  };

  try {
    // GET request — no Content-Type header needed (no body), avoids unnecessary preflight
    const res = await fetch(`${SERVER_URL}/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      console.warn("[Auth] /profile HTTP error:", res.status);
      return { profile: fallback, loaded: false };
    }

    const json = await res.json();

    if (!json.success || !json.profile) {
      console.warn("[Auth] /profile returned no row");
      return { profile: fallback, loaded: false };
    }

    const p    = json.profile;
    const role = normaliseRole(p.role);
    // Raw branch from DB — may be null if the superadmin row was created without one
    let branch: string | null =
      typeof p.branch === "string" && p.branch.trim()
        ? p.branch.trim()
        : null;

    // Superadmin always travels as 'All', even when the DB column is null/empty.
    // This ensures ProtectedRoute never blocks them for a missing branch.
    if (role === "superadmin" && (!branch || branch === "All")) {
      branch = "All";
    }

    console.log(
      `[Auth] Profile loaded — name=${p.full_name ?? "?"} ` +
      `role=${role} branch=${branch ?? "none"} ` +
      `isSuperadmin=${role === "superadmin"}`
    );

    return {
      loaded: true,
      profile: {
        id:          userId,
        email,
        name:        typeof p.full_name === "string" && p.full_name
                       ? p.full_name : fallback.name,
        role,
        avatar_url:  typeof p.profile_pic_url === "string" && p.profile_pic_url
                       ? p.profile_pic_url : null,
        branch,
        isSuperadmin: role === "superadmin",
        isAdmin:      role === "admin" || role === "superadmin",
      },
    };
  } catch (err) {
    // Network-level failure (CORS, server down, project paused, etc.)
    console.error("[Auth] loadProfile fetch exception:", err);
    return { profile: fallback, loaded: false };
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session,          setSession]          = useState<Session | null>(null);
  const [profile,          setProfile]          = useState<AgentProfile | null>(null);
  const [initialising,     setInitialising]     = useState(true);
  const [profileLoadError, setProfileLoadError] = useState(false);

  const hydrateProfile = useCallback(async (s: Session) => {
    setProfileLoadError(false);
    const u = s.user;
    const { profile: p, loaded } = await loadProfile(
      u.id,
      u.email ?? "",
      s.access_token,
      u.user_metadata?.name || u.user_metadata?.full_name,
      u.user_metadata?.role,
      u.user_metadata?.avatar_url
    );
    setProfile(p);
    if (!loaded) {
      setProfileLoadError(true);
      console.warn("[Auth] Profile could not be fetched — network error or server unavailable");
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        const s = data.session;
        setSession(s);
        if (s) await hydrateProfile(s);
      } catch (err) {
        console.error("[Auth] getSession error:", err);
      } finally {
        if (mounted) setInitialising(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (!mounted) return;
        setSession(s);
        if (s) {
          await hydrateProfile(s);
        } else {
          setProfile(null);
        }
        if (mounted) setInitialising(false);
      }
    );

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [hydrateProfile]);

  const retryProfile = useCallback(async () => {
    if (!session) return;
    console.log("[Auth] Retrying profile load…");
    await hydrateProfile(session);
  }, [session, hydrateProfile]);

  // Accept bare usernames ("aash" → "aash@qhtclinic.com")
  const login = useCallback(
    async (emailInput: string, password: string): Promise<LoginResult> => {
      const email = emailInput.trim().includes("@")
        ? emailInput.trim()
        : `${emailInput.trim()}@qhtclinic.com`;

      console.log("[Auth] Signing in as:", email);

      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          console.error("[Auth] signInWithPassword error:", error.message);
          return { ok: false, error: classifyError(error.message) };
        }

        if (!data.session)
          return { ok: false, error: "Authentication failed — no session returned." };

        console.log("[Auth] Login success:", data.user.id);
        return { ok: true };
      } catch (err: unknown) {
        const raw = err instanceof Error ? err.message : String(err);
        console.error("[Auth] Login exception:", raw);
        return { ok: false, error: classifyError(raw) };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    console.log("[Auth] Signing out");
    setSession(null);
    setProfile(null);
    setProfileLoadError(false);
    supabase.auth.signOut().catch((err) =>
      console.error("[Auth] signOut error:", err)
    );
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, initialising, profileLoadError, login, logout, retryProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be called inside <AuthProvider>");
  return ctx;
}