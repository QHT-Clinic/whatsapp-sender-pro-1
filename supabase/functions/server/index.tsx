/**
 * QHT Agent Portal — Supabase Edge Function Server  v5.0 (Three-Tier Roles)
 *
 * Role enforcement rules:
 *
 *   agent      – branch ≠ 'All'. POST /log-message writes their branch to the
 *                log row. They cannot access any /admin/* route.
 *
 *   admin      – branch ≠ 'All'. GET /admin/stats and /admin/messages are
 *                ALWAYS filtered by profiles.branch, regardless of any query
 *                params the client sends. Clients cannot escalate.
 *
 *   superadmin – branch = 'All'. GET /admin/stats accepts optional ?branch=
 *                to drill into one branch; omitting it returns global stats.
 *                GET /admin/messages accepts optional ?branch= similarly.
 *
 * POST /log-message branch rules:
 *   • Server fetches branch from profiles using the verified JWT agent_id.
 *   • If branch = 'All' (superadmin acting as agent), null is stored — no
 *     specific branch is forced because there is no real branch context.
 *   • If branch is a real branch (e.g. 'Haridwar'), that value is stored.
 *   • Clients NEVER send branch; it cannot be spoofed.
 *
 * Routes:
 *   GET  /health          — liveness probe (public)
 *   GET  /profile         — caller's full profiles row (protected)
 *   POST /log-message     — insert log; branch auto-attached (protected)
 *   GET  /today-count     — agent's today count, IST-corrected (protected)
 *   GET  /admin/stats     — branch-scoped or global stats (admin|superadmin)
 *   GET  /admin/messages  — branch-scoped or global logs  (admin|superadmin)
 *   GET  /whatsapp-numbers          — active numbers for caller's branch (protected)
 *   GET  /admin/whatsapp-numbers    — all numbers in scope (admin|superadmin)
 *   POST /admin/whatsapp-numbers    — add a number (admin|superadmin)
 *   PATCH /admin/whatsapp-numbers/:id — toggle active/label (admin|superadmin)
 *   DELETE /admin/whatsapp-numbers/:id — delete (admin|superadmin)
 *   GET  /recent-logs     — last 15 logs for the calling agent (protected)
 */

import { Hono } from "npm:hono";
import { logger } from "npm:hono/logger";
import { cors } from "npm:hono/cors";
import { createClient } from "npm:@supabase/supabase-js";

// ─── Supabase admin client (service_role bypasses RLS) ───────────────────────

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─── Response helpers ─────────────────────────────────────────────────────────

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errRes(message: string, status = 500): Response {
  return jsonRes({ error: message }, status);
}

// ─── IST day-start ────────────────────────────────────────────────────────────
// DB is UTC. IST = UTC+05:30 → midnight IST = 18:30 UTC previous day.

function istStartOfDayUTC(): string {
  const IST_MS  = 5.5 * 60 * 60 * 1000;
  const nowIst  = new Date(Date.now() + IST_MS);
  const midnightIst = Date.UTC(
    nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate(),
    0, 0, 0, 0
  );
  return new Date(midnightIst - IST_MS).toISOString();
}

/**
 * istPeriodStart — UTC ISO start for a named time range.
 *   'today' → midnight IST today
 *   '7d'    → midnight IST 6 days ago (inclusive 7-day window)
 *   '30d'   → midnight IST 29 days ago (inclusive 30-day window)
 *   'all'   → null (no date filter)
 */
function istPeriodStart(timeRange: string): string | null {
  const IST_MS = 5.5 * 60 * 60 * 1000;
  const nowIst = new Date(Date.now() + IST_MS);
  let daysBack = 0;
  if      (timeRange === "today") daysBack = 0;
  else if (timeRange === "7d")    daysBack = 6;
  else if (timeRange === "30d")   daysBack = 29;
  else return null;
  const midnight = Date.UTC(
    nowIst.getUTCFullYear(), nowIst.getUTCMonth(),
    nowIst.getUTCDate() - daysBack, 0, 0, 0, 0
  );
  return new Date(midnight - IST_MS).toISOString();
}

function periodLabel(timeRange: string): string {
  if (timeRange === "today") return "Today";
  if (timeRange === "7d")    return "Last 7 Days";
  if (timeRange === "30d")   return "Last 30 Days";
  return "All Time";
}

// ─── Paginated full-table fetch (avoids the 1 000-row cap) ───────────────────

async function fetchAllLogs(
  columns: string,
  filter: { branch?: string | null; agent_id?: string } = {}
): Promise<Array<Record<string, unknown>>> {
  const BATCH = 1000;
  const all: Array<Record<string, unknown>> = [];
  let from = 0;

  while (true) {
    let q = supabase
      .from("message_logs")
      .select(columns)
      .range(from, from + BATCH - 1);

    // Only apply branch filter when a specific branch is requested
    if (filter.branch)    q = q.eq("branch",   filter.branch);
    if (filter.agent_id)  q = q.eq("agent_id", filter.agent_id);

    const { data, error } = await q;
    if (error) { console.error("[fetchAllLogs] batch error:", error.message); break; }
    if (!data || data.length === 0) break;
    for (const row of data) all.push(row as Record<string, unknown>);
    if (data.length < BATCH) break;
    from += BATCH;
  }

  return all;
}

// ─── Auth guards ──────────────────────────────────────────────────────────────

/** Verify Bearer JWT → { id, email } or 401 Response. */
async function requireUser(
  req: Request
): Promise<{ id: string; email: string } | Response> {
  const header = req.headers.get("Authorization");
  const token  = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return errRes("Missing Authorization header", 401);

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user)
    return errRes("Invalid or expired session. Please log in again.", 401);

  return { id: data.user.id, email: data.user.email ?? "" };
}

/**
 * requireAdmin — accepts role = 'admin' OR 'superadmin'.
 *
 * Returns:
 *   id, email            — from JWT
 *   role                 — 'admin' | 'superadmin'
 *   profileBranch        — raw profiles.branch value (e.g. 'Haridwar', 'All')
 *   isSuperadmin         — true when role === 'superadmin'
 *
 * Branch interpretation by callers:
 *   isSuperadmin = false → profileBranch is the hard filter (cannot be overridden)
 *   isSuperadmin = true  → profileBranch is 'All'; callers may accept an
 *                          optional client-supplied branch param to drill in
 */
async function requireAdmin(req: Request): Promise<
  | {
      id:            string;
      email:         string;
      role:          "admin" | "superadmin";
      profileBranch: string | null;
      isSuperadmin:  boolean;
    }
  | Response
> {
  const userOrRes = await requireUser(req);
  if (userOrRes instanceof Response) return userOrRes;

  const { data, error } = await supabase
    .from("profiles")
    .select("role, branch")   // single query: role check + branch in one trip
    .eq("id", userOrRes.id)
    .maybeSingle();

  if (error) {
    console.error("[requireAdmin] DB error:", error.message);
    return errRes("Error verifying admin role: " + error.message, 500);
  }

  if (!data || (data.role !== "admin" && data.role !== "superadmin")) {
    return errRes("Admin or Superadmin access required", 403);
  }

  const role         = data.role as "admin" | "superadmin";
  const isSuperadmin = role === "superadmin";
  const profileBranch =
    typeof data.branch === "string" && data.branch.trim()
      ? data.branch.trim()
      : null;

  return { ...userOrRes, role, profileBranch, isSuperadmin };
}

// ─── Hono app ─────────────────────────────────────────────────────────────────

const app = new Hono();

// ── CORS — MUST be first middleware ──────────────────────────────────────────
// hono/cors creates a *new* Response with headers rather than mutating the
// existing one — required on Deno Deploy where Response headers are immutable.
app.use(
  "*",
  cors({
    origin:         "*",
    allowMethods:   ["GET", "POST", "OPTIONS"],
    allowHeaders:   ["Content-Type", "Authorization", "apikey", "x-client-info"],
    maxAge:         86400,
    credentials:    false,
  })
);

app.use("*", logger(console.log));

// ─── Health ───────────────────────────────────────────────────────────────────

app.get("/make-server-9c23c834/health", (c) =>
  c.json({ status: "ok", ts: new Date().toISOString() })
);

// ─── Profile ──────────────────────────────────────────────────────────────────
// Returns the caller's full profiles row (SELECT *).
// branch TEXT and role TEXT are included automatically.

app.get("/make-server-9c23c834/profile", async (c) => {
  const userOrRes = await requireUser(c.req.raw);
  if (userOrRes instanceof Response) return userOrRes;

  try {
    const { data: row, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userOrRes.id)
      .maybeSingle();

    if (error) {
      console.error("[profile] DB error:", error.message);
      return errRes("DB error fetching profile: " + error.message);
    }

    console.log(
      `[profile] id=${userOrRes.id} name=${row?.full_name ?? "?"} ` +
      `role=${row?.role ?? "?"} branch=${row?.branch ?? "none"}`
    );

    return c.json({ success: true, profile: row ?? null });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[profile] exception:", msg);
    return errRes(msg);
  }
});

// ─── Log message ──────────────────────────────────────────────────────────────
//
// Branch integrity rules:
//   1. Fetch agent's branch from profiles using the JWT-verified agent_id.
//   2. If branch is a specific location (e.g. 'Haridwar'), write it to the log.
//   3. If branch is 'All' (superadmin using sender form), write null — they
//      don't belong to any single branch so no branch is attributed.
//   4. Clients never supply branch; it cannot be spoofed.

app.post("/make-server-9c23c834/log-message", async (c) => {
  const userOrRes = await requireUser(c.req.raw);
  if (userOrRes instanceof Response) return userOrRes;
  const user = userOrRes;

  try {
    const body = await c.req.json();

    // ── 1. Fetch agent's branch from DB (the only authoritative source) ────────
    const { data: agentProfile, error: profileErr } = await supabase
      .from("profiles")
      .select("branch")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr) {
      console.warn(
        `[log-message] branch lookup failed for agent ${user.id}: ${profileErr.message}`
      );
    }

    const rawBranch = agentProfile?.branch ?? null;

    // ── 2. Golden Rule — tamper detection ─────────────────────────────────────
    // Clients should never send a 'branch' field; it cannot be trusted.
    // If one arrives, log it as a tamper attempt and silently ignore it.
    // The DB profile value is ALWAYS used.
    const clientBranch =
      typeof body.branch === "string" && body.branch.trim()
        ? body.branch.trim()
        : null;

    if (clientBranch) {
      if (clientBranch !== rawBranch) {
        // Mismatch  potential injection attempt
        console.warn(
          `[log-message] ⚠️  TAMPER ATTEMPT — agent=${user.email} (${user.id}) ` +
          `sent branch="${clientBranch}" but profile.branch="${rawBranch ?? "null"}". ` +
          `Client value IGNORED; profile branch enforced.`
        );
      } else {
        // Matches, but still shouldn't be sent — soft warning
        console.warn(
          `[log-message] ℹ️  Redundant branch field from agent=${user.email}: ` +
          `"${clientBranch}" matches profile. Proceeding with profile value.`
        );
      }
    }

    // ── 3. Resolve authoritative branch for storage ───────────────────────────
    // 'All' = superadmin has no specific branch → store null
    const branch: string | null =
      typeof rawBranch === "string" &&
      rawBranch.trim() &&
      rawBranch.trim() !== "All"
        ? rawBranch.trim()
        : null;

    console.log(
      `[log-message] agent=${user.id} email=${user.email} ` +
      `raw_branch=${rawBranch ?? "none"} stored_branch=${branch ?? "null"} ` +
      `client_branch_sent=${clientBranch ?? "none"} ` +
      `phone=${body.customer_phone ?? ""} lead=${body.lead_id ?? "none"}`
    );

    // ── 4. Insert with server-authoritative branch (never from client) ─────────
    const insertRow = {
      agent_id:        user.id,
      branch,                           // ← always from profiles, never body.branch
      lead_id:         body.lead_id         ?? null,
      customer_phone:  body.customer_phone  || "",
      customer_name:   body.customer_name   ?? null,
      template_type:   body.template_type   ?? null,
      message_content: body.message_content ?? null,
      image_url:       body.image_url       ?? null,
      used_number:     body.used_number     ?? null,
    };

    const { data, error } = await supabase
      .from("message_logs")
      .insert(insertRow)
      .select("id")
      .single();

    if (error) {
      console.error(
        "[log-message] insert error:", error.message,
        "code:", error.code, "details:", error.details
      );
      return errRes(
        `DB insert error (${error.code}): ${error.message}` +
        (error.details ? " — " + error.details : "")
      );
    }

    console.log(`[log-message] ✅ id=${data.id} branch=${branch ?? "null"}`);
    return c.json({ success: true, id: data.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[log-message] exception:", msg);
    return errRes(msg);
  }
});

// ─── Today's count (agent-scoped, IST) ───────────────────────────────────────

app.get("/make-server-9c23c834/today-count", async (c) => {
  const userOrRes = await requireUser(c.req.raw);
  if (userOrRes instanceof Response) return userOrRes;

  try {
    const startIST = istStartOfDayUTC();

    const { count, error } = await supabase
      .from("message_logs")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", userOrRes.id)
      .gte("created_at", startIST);

    if (error) {
      console.error("[today-count] DB error:", error.message);
      return errRes(error.message);
    }

    console.log(`[today-count] agent=${userOrRes.id} count=${count}`);
    return c.json({ success: true, count: count ?? 0 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[today-count] exception:", msg);
    return errRes(msg);
  }
});

// ─── Admin: stats ────────────────────────────────────────────────────────────
//
// Superadmin (isSuperadmin = true):
//   Accepts optional ?branch=<BranchName>. If omitted / 'All' → global stats.
//   Global view also returns `branchBreakdown[]` — per-branch totals computed
//   in-memory from the same log fetch, so zero extra DB round-trips.
//
// Admin (isSuperadmin = false):
//   Any ?branch= param is SILENTLY IGNORED.
//   Stats are ALWAYS scoped to profiles.branch, which cannot be tampered with.
//
// Response shape:
//   { success, adminRole, adminBranch, totalAll, todayAll, agents[],
//     branchBreakdown[], _meta }
//
//   adminBranch    — null = global view; '<name>' = filtered to that branch
//   branchBreakdown — only present when adminBranch is null (global view);
//                     gives per-branch { branch, total, today } for the
//                     superadmin "Global Analytics" overview cards

// Known branches — must match the DB CHECK constraint
const KNOWN_BRANCHES = ["Haridwar", "Hyderabad", "Delhi", "Gurgaon"] as const;

app.get("/make-server-9c23c834/admin/stats", async (c) => {
  const adminOrRes = await requireAdmin(c.req.raw);
  if (adminOrRes instanceof Response) return adminOrRes;

  const { id: adminId, role: adminRole, profileBranch, isSuperadmin } = adminOrRes;

  try {
    const startIST = istStartOfDayUTC();

    // ── Time range filter ─────────────────────────────────────────────────────
    // 'today' | '7d' | '30d' | 'all' (default)
    // Superadmin and admin both honour this param.
    const timeRange  = (c.req.query("timeRange") ?? "all").trim();
    const periodStart = istPeriodStart(timeRange);   // null = no date filter

    // ── Determine effective branch filter ──────────────────────────────────────
    let effectiveBranch: string | null;

    if (isSuperadmin) {
      const branchParam = (c.req.query("branch") ?? "").trim();
      effectiveBranch =
        branchParam && branchParam !== "All" && branchParam !== "Global"
          ? branchParam
          : null;
    } else {
      effectiveBranch = profileBranch;
    }

    const isGlobalView = isSuperadmin && effectiveBranch === null;

    console.log(
      `[admin/stats] admin=${adminId} role=${adminRole} ` +
      `effectiveBranch=${effectiveBranch ?? "ALL"} ` +
      `timeRange=${timeRange} periodStart=${periodStart ?? "none"} ` +
      `isGlobalView=${isGlobalView}`
    );

    // ── 1. Total all-time count ───────────────────────────────────────────────
    let totalQ = supabase.from("message_logs").select("*", { count: "exact", head: true });
    if (effectiveBranch) totalQ = totalQ.eq("branch", effectiveBranch);
    const { count: totalAll, error: totalErr } = await totalQ;
    if (totalErr) return errRes("DB error (totalAll): " + totalErr.message);

    // ── 2. Today count (IST day, always) ─────────────────────────────────────
    let todayQ = supabase
      .from("message_logs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startIST);
    if (effectiveBranch) todayQ = todayQ.eq("branch", effectiveBranch);
    const { count: todayAll, error: todayErr } = await todayQ;
    if (todayErr) return errRes("DB error (todayAll): " + todayErr.message);

    // ── 3. Agent profiles ─────────────────────────────────────────────────────
    let profQ = supabase.from("profiles").select("id, full_name, branch, role");
    if (effectiveBranch) profQ = profQ.eq("branch", effectiveBranch);
    const { data: profileRows, error: profErr } = await profQ;
    if (profErr) console.error("[admin/stats] profiles error:", profErr.message);

    const profileMap: Record<string, { name: string; branch: string | null }> = {};
    for (const p of profileRows ?? []) {
      if (p && typeof p.id === "string") {
        profileMap[p.id] = {
          name:   typeof p.full_name === "string" && p.full_name ? p.full_name : "Unknown Agent",
          branch: typeof p.branch === "string" ? p.branch : null,
        };
      }
    }

    // ── 4. Fetch all log rows (batched) ───────────────────────────────────────
    const allLogs = await fetchAllLogs(
      "id, agent_id, branch, created_at",
      effectiveBranch ? { branch: effectiveBranch } : {}
    );

    // ── 5. Aggregate per agent — total, today, period, lastActive ─────────────
    const agentMap: Record<string, {
      agentId:    string;
      name:       string;
      branch:     string | null;
      total:      number;
      today:      number;
      period:     number;       // count within selected time range
      lastActive: string | null;
    }> = {};

    for (const log of allLogs) {
      const agentId   = typeof log.agent_id   === "string" ? log.agent_id   : String(log.agent_id);
      const createdAt = typeof log.created_at === "string" ? log.created_at : "";
      const isToday   = createdAt >= startIST;
      const inPeriod  = periodStart === null || createdAt >= periodStart;

      if (!agentMap[agentId]) {
        const prof = profileMap[agentId];
        agentMap[agentId] = {
          agentId,
          name:       prof?.name   ?? "Unknown Agent",
          branch:     prof?.branch ?? (typeof log.branch === "string" ? log.branch : null),
          total:      0,
          today:      0,
          period:     0,
          lastActive: null,
        };
      }
      agentMap[agentId].total++;
      if (isToday) agentMap[agentId].today++;
      if (inPeriod) agentMap[agentId].period++;
      if (!agentMap[agentId].lastActive || createdAt > agentMap[agentId].lastActive!) {
        agentMap[agentId].lastActive = createdAt;
      }
    }

    // Sort by period when a time range is active; otherwise by all-time total
    const agents = Object.values(agentMap).sort((a, b) =>
      timeRange !== "all" ? b.period - a.period : b.total - a.total
    );

    // ── 6. Period total ───────────────────────────────────────────────────────
    const periodTotal = periodStart === null
      ? (totalAll ?? 0)
      : allLogs.filter((l) =>
          typeof l.created_at === "string" && l.created_at >= periodStart
        ).length;

    // ── 7. Branch breakdown (global view only) ────────────────────────────────
    let branchBreakdown: Array<{
      branch: string; total: number; today: number; period: number; activeAgentsToday: number;
    }> = [];

    if (isGlobalView) {
      const branchMap: Record<string, {
        total: number; today: number; period: number; agentsToday: Set<string>;
      }> = {};

      for (const log of allLogs) {
        const br      = typeof log.branch === "string" && log.branch ? log.branch : "__none__";
        const agId    = typeof log.agent_id === "string" ? log.agent_id : String(log.agent_id);
        const cat     = typeof log.created_at === "string" ? log.created_at : "";
        const isTd    = cat >= startIST;
        const inPd    = periodStart === null || cat >= periodStart;

        if (!branchMap[br]) branchMap[br] = { total: 0, today: 0, period: 0, agentsToday: new Set() };
        branchMap[br].total++;
        if (isTd)  { branchMap[br].today++;  branchMap[br].agentsToday.add(agId); }
        if (inPd)    branchMap[br].period++;
      }

      branchBreakdown = KNOWN_BRANCHES.map((br) => ({
        branch:            br,
        total:             branchMap[br]?.total              ?? 0,
        today:             branchMap[br]?.today              ?? 0,
        period:            branchMap[br]?.period             ?? 0,
        activeAgentsToday: branchMap[br]?.agentsToday.size  ?? 0,
      }));
    }

    console.log(
      `[admin/stats] agents=${agents.length} logsProcessed=${allLogs.length} ` +
      `periodTotal=${periodTotal} timeRange=${timeRange}`
    );

    return c.json({
      success:      true,
      adminRole,
      adminBranch:  effectiveBranch,
      isGlobalView,
      totalAll:     totalAll   ?? 0,
      todayAll:     todayAll   ?? 0,
      periodTotal,
      periodLabel:  periodLabel(timeRange),
      timeRange,
      agents,
      branchBreakdown,
      _meta: {
        adminId, adminRole,
        profileBranch:   profileBranch   ?? null,
        effectiveBranch: effectiveBranch ?? null,
        isGlobalView,
        timeRange, periodStart: periodStart ?? null,
        istDayStart:     startIST,
        logsProcessed:   allLogs.length,
        ts:              new Date().toISOString(),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[admin/stats] exception:", msg);
    return errRes(msg);
  }
});

// ─── Admin: paginated message list ────────────────────────────────────────────
//
// Same role-based branch-scoping as /admin/stats.
//
// Query params:
//   branch    — (superadmin only) filter to one branch; ignored for admin
//   agent_id  — (all) filter to one agent within the effective scope
//   limit     — default 50, max 200
//   offset    — default 0
//
// Enriched rows add: agent_name (string)

app.get("/make-server-9c23c834/admin/messages", async (c) => {
  const adminOrRes = await requireAdmin(c.req.raw);
  if (adminOrRes instanceof Response) return adminOrRes;

  const { id: adminId, role: adminRole, profileBranch, isSuperadmin } = adminOrRes;

  try {
    const agentIdParam = c.req.query("agent_id") ?? "";
    const limit  = Math.min(parseInt(c.req.query("limit")  ?? "50", 10) || 50, 200);
    const offset = parseInt(c.req.query("offset") ?? "0", 10) || 0;

    // ── Time range filter ─────────────────────────────────────────────────────
    const timeRange   = (c.req.query("timeRange") ?? "all").trim();
    const periodStart = istPeriodStart(timeRange);

    // ── Effective branch ──────────────────────────────────────────────────────
    let effectiveBranch: string | null;
    if (isSuperadmin) {
      const branchParam = (c.req.query("branch") ?? "").trim();
      effectiveBranch = branchParam && branchParam !== "All" && branchParam !== "Global"
        ? branchParam : null;
    } else {
      effectiveBranch = profileBranch;
    }

    console.log(
      `[admin/messages] admin=${adminId} role=${adminRole} ` +
      `effectiveBranch=${effectiveBranch ?? "ALL"} timeRange=${timeRange} ` +
      `agent=${agentIdParam || "ALL"} limit=${limit} offset=${offset}`
    );

    let query = supabase
      .from("message_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (effectiveBranch) query = query.eq("branch",    effectiveBranch);
    if (agentIdParam)    query = query.eq("agent_id",  agentIdParam);
    if (periodStart)     query = query.gte("created_at", periodStart);

    const { data, error, count } = await query;
    if (error) {
      console.error("[admin/messages] DB error:", error.message);
      return errRes("DB error fetching messages: " + error.message);
    }

    // ── Enrich with agent names ───────────────────────────────────────────────
    const rows           = data ?? [];
    const uniqueAgentIds: string[] = [];
    const seen           = new Set<string>();

    for (const row of rows) {
      const aid = typeof row.agent_id === "string" ? row.agent_id : String(row.agent_id);
      if (!seen.has(aid)) { seen.add(aid); uniqueAgentIds.push(aid); }
    }

    const agentNameMap: Record<string, string> = {};
    if (uniqueAgentIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", uniqueAgentIds);

      for (const p of profiles ?? []) {
        if (p && typeof p.id === "string") {
          agentNameMap[p.id] =
            typeof p.full_name === "string" && p.full_name
              ? p.full_name : "Unknown Agent";
        }
      }
    }

    const enriched = rows.map((row: Record<string, unknown>) => {
      const aid = typeof row.agent_id === "string" ? row.agent_id : String(row.agent_id);
      return { ...row, agent_name: agentNameMap[aid] ?? "Unknown Agent" };
    });

    return c.json({ success: true, messages: enriched, total: count ?? 0 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[admin/messages] exception:", msg);
    return errRes(msg);
  }
});

// ─── Admin: create new user ────────────────────────────────────────────────────
//
// Access:
//   admin      → may only create role='agent' in their own branch.
//                Any role/branch they send is silently overridden server-side.
//   superadmin → may create role='agent' or role='admin' in any known branch.
//                Creating a superadmin via this route is explicitly blocked.
//
// Flow:
//   1. Validate & sanitise input
//   2. supabase.auth.admin.createUser  → auth.users row with email_confirm:true
//   3. INSERT into public.profiles with the exact same UUID
//   4. Return the new profile row
//
// The service-role client is already initialised at module scope — it
// bypasses RLS and has permission to call auth.admin.createUser.

const VALID_BRANCHES = ["Haridwar", "Hyderabad", "Delhi", "Gurgaon"] as const;
type ValidBranch = typeof VALID_BRANCHES[number];

app.post("/make-server-9c23c834/admin/create-user", async (c) => {
  const adminOrRes = await requireAdmin(c.req.raw);
  if (adminOrRes instanceof Response) return adminOrRes;

  const { id: adminId, role: adminRole, profileBranch, isSuperadmin } = adminOrRes;

  try {
    const body = await c.req.json();

    // ── 1. Parse & validate ──────────────────────────────────────────────────
    const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const email    = typeof body.email    === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!fullName)           return errRes("full_name is required", 400);
    if (!email)              return errRes("email is required", 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                             return errRes("email format is invalid", 400);
    if (password.length < 8) return errRes("password must be at least 8 characters", 400);

    // ── 2. Role & branch enforcement ─────────────────────────────────────────
    let targetRole:   string;
    let targetBranch: string;

    if (isSuperadmin) {
      // Superadmin: validate what they sent, but block superadmin creation
      const requestedRole   = typeof body.role   === "string" ? body.role.trim()   : "agent";
      const requestedBranch = typeof body.branch === "string" ? body.branch.trim() : "";

      if (!["agent", "admin"].includes(requestedRole)) {
        return errRes(`role must be 'agent' or 'admin' (got '${requestedRole}')`, 400);
      }
      if (!(VALID_BRANCHES as readonly string[]).includes(requestedBranch)) {
        return errRes(
          `branch must be one of: ${VALID_BRANCHES.join(", ")} (got '${requestedBranch}')`, 400
        );
      }

      targetRole   = requestedRole;
      targetBranch = requestedBranch as ValidBranch;

    } else {
      // Admin: always agent, always their own branch — no exceptions
      if (!profileBranch || !(VALID_BRANCHES as readonly string[]).includes(profileBranch)) {
        return errRes("Admin profile has no valid branch — cannot create users", 403);
      }
      targetRole   = "agent";
      targetBranch = profileBranch;

      console.log(
        `[create-user] admin=${adminId} branch=${profileBranch} ` +
        `overriding requested role/branch → role=agent branch=${profileBranch}`
      );
    }

    console.log(
      `[create-user] creator=${adminId} (${adminRole}) ` +
      `creating email=${email} role=${targetRole} branch=${targetBranch}`
    );

    // ── 3. Create auth.users row ──────────────────────────────────────────────
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,          // skip confirmation email — portal-managed
      user_metadata: { full_name: fullName },
    });

    if (authErr || !authData?.user) {
      const msg = authErr?.message ?? "Unknown auth error";
      console.error("[create-user] auth.admin.createUser failed:", msg);
      // Surface Supabase's message verbatim so the admin sees e.g. "already exists"
      return errRes("Auth error: " + msg, 400);
    }

    const newUserId = authData.user.id;
    console.log(`[create-user] auth user created id=${newUserId}`);

    // ── 4. Insert matching profiles row ──────────────────────────────────────
    // Use upsert so a partial failure + retry doesn't leave a dangling auth user.
    const { data: profileRow, error: profileErr } = await supabase
      .from("profiles")
      .upsert({
        id:        newUserId,          // ← MUST match auth.users.id exactly
        full_name: fullName,
        role:      targetRole,
        branch:    targetBranch,
      }, { onConflict: "id" })
      .select("id, full_name, role, branch")
      .maybeSingle();

    if (profileErr) {
      console.error("[create-user] profiles insert failed:", profileErr.message);
      // Auth user was created — log but still return success with a warning so
      // the admin knows the profile may need manual repair.
      return c.json({
        success: false,
        error:   "Auth user created but profiles row failed: " + profileErr.message,
        authId:  newUserId,
      }, 500);
    }

    console.log(
      `[create-user] ✅ complete — authId=${newUserId} ` +
      `name=${fullName} role=${targetRole} branch=${targetBranch}`
    );

    return c.json({
      success: true,
      user: {
        id:        newUserId,
        email,
        full_name: fullName,
        role:      targetRole,
        branch:    targetBranch,
        ...(profileRow ?? {}),
      },
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[create-user] exception:", msg);
    return errRes("Unexpected error: " + msg);
  }
});

// ─── WhatsApp Numbers: agent-facing read ─────────────────────────────────────
//
// GET /whatsapp-numbers
//   Returns ACTIVE numbers for the calling user's branch (from profiles).
//   - agent / admin  → filtered to profiles.branch
//   - superadmin     → accepts optional ?branch= to filter; returns all if omitted
//   - Only is_active = true rows are returned (inactive = removed from dropdown)

app.get("/make-server-9c23c834/whatsapp-numbers", async (c) => {
  const userOrRes = await requireUser(c.req.raw);
  if (userOrRes instanceof Response) return userOrRes;

  try {
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("branch, role")
      .eq("id", userOrRes.id)
      .maybeSingle();

    // ── Guard 1: DB error ───────────────────────────────────────────────────
    if (profErr) return errRes("Profile lookup failed: " + profErr.message, 500);

    // ── Guard 2: Profile row missing ────────────────────────────────────────
    // maybeSingle() returns null (not an error) when there is no matching row.
    // Without this check, isSuperadmin becomes false, profileBranch becomes null,
    // effectiveBranch becomes null → the branch filter is skipped → ALL numbers
    // in the table are returned to the caller.  This was the Gurgaon leak.
    if (!prof) {
      console.warn(
        `[whatsapp-numbers] SAFETY: user=${userOrRes.id} has no profiles row — returning empty list`
      );
      return errRes(
        "User profile not found — please contact your Admin to provision your account",
        404
      );
    }

    const isSuperadmin  = prof.role === "superadmin";
    const profileBranch = typeof prof.branch === "string" && prof.branch.trim()
      ? prof.branch.trim() : null;

    let effectiveBranch: string | null;
    if (isSuperadmin) {
      const bp = (c.req.query("branch") ?? "").trim();
      effectiveBranch = bp && bp !== "All" ? bp : null;
    } else {
      effectiveBranch = profileBranch !== "All" ? profileBranch : null;
    }

    // ── Guard 3: Non-superadmin with no effective branch ───────────────────
    // Belt-and-suspenders: even if the profile exists but branch is unset or
    // set to 'All' for a non-superadmin (DB misconfiguration), return empty
    // rather than dumping all numbers.  Prevents any future data-leak path.
    if (!isSuperadmin && !effectiveBranch) {
      console.warn(
        `[whatsapp-numbers] SAFETY: user=${userOrRes.id} role=${prof.role} ` +
        `branch=${prof.branch ?? "null"} — no effective branch; returning empty list`
      );
      return c.json({ success: true, numbers: [] });
    }

    let q = supabase
      .from("whatsapp_numbers")
      .select("id, phone_number, label, branch, is_active, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (effectiveBranch) q = q.eq("branch", effectiveBranch);

    const { data, error } = await q;
    if (error) return errRes("DB error fetching numbers: " + error.message, 500);

    console.log(
      `[whatsapp-numbers] user=${userOrRes.id} role=${prof.role} ` +
      `branch=${effectiveBranch ?? "ALL"} returned=${data?.length ?? 0}`
    );

    return c.json({ success: true, numbers: data ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[whatsapp-numbers] exception:", msg);
    return errRes(msg);
  }
});

// ─── WhatsApp Numbers: admin CRUD ─────────────────────────────────────────────
//
// All routes below require admin or superadmin.
// Branch scoping:
//   admin      → always restricted to profiles.branch (no override)
//   superadmin → may supply ?branch= / body.branch to manage any branch

// ── GET /admin/whatsapp-numbers — list all (incl. inactive) in scope ─────────

app.get("/make-server-9c23c834/admin/whatsapp-numbers", async (c) => {
  const adminOrRes = await requireAdmin(c.req.raw);
  if (adminOrRes instanceof Response) return adminOrRes;
  const { profileBranch, isSuperadmin } = adminOrRes;

  try {
    let effectiveBranch: string | null;
    if (isSuperadmin) {
      const bp = (c.req.query("branch") ?? "").trim();
      effectiveBranch = bp && bp !== "All" ? bp : null;
    } else {
      effectiveBranch = profileBranch;
    }

    let q = supabase
      .from("whatsapp_numbers")
      .select("id, phone_number, label, branch, is_active, created_at")
      .order("branch",     { ascending: true })
      .order("created_at", { ascending: true });

    if (effectiveBranch) q = q.eq("branch", effectiveBranch);

    const { data, error } = await q;
    if (error) return errRes("DB error: " + error.message, 500);

    return c.json({ success: true, numbers: data ?? [], effectiveBranch });
  } catch (e: unknown) {
    return errRes(e instanceof Error ? e.message : String(e));
  }
});

// ── POST /admin/whatsapp-numbers — add a new number ────��─────────────────────

app.post("/make-server-9c23c834/admin/whatsapp-numbers", async (c) => {
  const adminOrRes = await requireAdmin(c.req.raw);
  if (adminOrRes instanceof Response) return adminOrRes;
  const { id: adminId, profileBranch, isSuperadmin } = adminOrRes;

  try {
    const body = await c.req.json();

    const phoneNumber = typeof body.phone_number === "string" ? body.phone_number.trim() : "";
    const label       = typeof body.label        === "string" ? body.label.trim()        : "";

    if (!phoneNumber) return errRes("phone_number is required", 400);
    if (!label)       return errRes("label is required", 400);
    if (!/^\d{10,15}$/.test(phoneNumber))
      return errRes("phone_number must be 10–15 digits (no +, no spaces)", 400);

    let targetBranch: string;
    if (isSuperadmin) {
      const rb = typeof body.branch === "string" ? body.branch.trim() : "";
      if (!(VALID_BRANCHES as readonly string[]).includes(rb))
        return errRes(`branch must be one of: ${VALID_BRANCHES.join(", ")}`, 400);
      targetBranch = rb;
    } else {
      if (!profileBranch || !(VALID_BRANCHES as readonly string[]).includes(profileBranch))
        return errRes("Admin has no valid branch", 403);
      targetBranch = profileBranch;
    }

    const { data, error } = await supabase
      .from("whatsapp_numbers")
      .insert({ phone_number: phoneNumber, label, branch: targetBranch, is_active: true })
      .select("id, phone_number, label, branch, is_active, created_at")
      .single();

    if (error) return errRes("DB error inserting number: " + error.message, 500);

    console.log(`[admin/whatsapp-numbers POST] ✅ id=${data.id} branch=${targetBranch} by=${adminId}`);
    return c.json({ success: true, number: data });
  } catch (e: unknown) {
    return errRes(e instanceof Error ? e.message : String(e));
  }
});

// ── POST /admin/whatsapp-numbers/:id — PATCH (toggle/update) or DELETE ────────
// Uses body._method = "DELETE" | "PATCH" to work within GET/POST CORS config.

app.post("/make-server-9c23c834/admin/whatsapp-numbers/:id", async (c) => {
  const adminOrRes = await requireAdmin(c.req.raw);
  if (adminOrRes instanceof Response) return adminOrRes;
  const { profileBranch, isSuperadmin } = adminOrRes;
  const id = c.req.param("id");

  try {
    const body   = await c.req.json();
    const method = (body._method as string | undefined)?.toUpperCase() ?? "PATCH";

    // Verify ownership before any mutation
    const { data: existing, error: fetchErr } = await supabase
      .from("whatsapp_numbers")
      .select("id, branch, is_active, label")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !existing) return errRes("Number not found", 404);
    if (!isSuperadmin && existing.branch !== profileBranch)
      return errRes("Access denied — number belongs to a different branch", 403);

    // ── DELETE ────────────────────────────────────────────────────────────────
    if (method === "DELETE") {
      const { error: delErr } = await supabase
        .from("whatsapp_numbers").delete().eq("id", id);
      if (delErr) return errRes("Delete failed: " + delErr.message, 500);
      console.log(`[admin/whatsapp-numbers DELETE] id=${id}`);
      return c.json({ success: true });
    }

    // ── PATCH ─────────────────────────────────────────────────────────────────
    const updates: Record<string, unknown> = {};
    if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
    if (typeof body.label     === "string" && body.label.trim())
      updates.label = body.label.trim();

    if (Object.keys(updates).length === 0)
      return errRes("No valid fields to update (is_active or label)", 400);

    const { data: updated, error: updErr } = await supabase
      .from("whatsapp_numbers")
      .update(updates)
      .eq("id", id)
      .select("id, phone_number, label, branch, is_active, created_at")
      .single();

    if (updErr) return errRes("Update failed: " + updErr.message, 500);
    console.log(`[admin/whatsapp-numbers PATCH] id=${id} updates=${JSON.stringify(updates)}`);
    return c.json({ success: true, number: updated });
  } catch (e: unknown) {
    return errRes(e instanceof Error ? e.message : String(e));
  }
});

// ─── Recent logs for the calling agent ───────────────────────────────────────
// Returns the last 15 message_logs rows for the authenticated user, ordered
// newest-first.  Used by the RecentLogsSidebar component on the sender page.

app.get("/make-server-9c23c834/recent-logs", async (c) => {
  const userOrRes = await requireUser(c.req.raw);
  if (userOrRes instanceof Response) return userOrRes;

  try {
    const { data, error } = await supabase
      .from("message_logs")
      .select(
        "id, created_at, template_type, message_content, image_url, " +
        "customer_name, customer_phone, used_number, branch"
      )
      .eq("agent_id", userOrRes.id)
      .order("created_at", { ascending: false })
      .limit(15);

    if (error) {
      console.error("[recent-logs] DB error:", error.message);
      return errRes("DB error fetching recent logs: " + error.message);
    }

    console.log(`[recent-logs] agent=${userOrRes.id} count=${data?.length ?? 0}`);
    return c.json({ success: true, logs: data ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[recent-logs] exception:", msg);
    return errRes(msg);
  }
});

// ─── Serve — OPTIONS pre-flight before Hono ───────────────────────────────────

// OPTIONS preflight intercepted before Hono as a belt-and-suspenders safety net.
// hono/cors handles OPTIONS for requests that reach Hono, but intercepting here
// ensures zero-latency responses for preflight even if Hono middleware delays.
const PREFLIGHT_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Access-Control-Max-Age":       "86400",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: PREFLIGHT_HEADERS });
  return app.fetch(req);
});