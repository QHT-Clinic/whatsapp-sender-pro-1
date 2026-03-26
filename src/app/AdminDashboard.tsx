/**
 * AdminDashboard — QHT Agent Portal  v8.0
 *
 * New in v8:
 *   • Time range filter (All Time / Today / 7 Days / 30 Days) — affects stats,
 *     leaderboard sort order, chart and CSV export.
 *   • BranchBarChart — recharts bar chart comparing all 4 branches; superadmin
 *     global view only. Toggle between "Period", "Today" and "All-Time" metrics.
 *   • "Last Active" column in agent leaderboard (ISO timestamp → relative label).
 *   • Export CSV — pages through /admin/messages, respects current branch +
 *     time-range filters, triggers browser download — no new backend route.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import * as Select from "@radix-ui/react-select";

import { useAuth } from "./context/AuthContext";
import { supabase } from "./lib/supabaseClient";
import { BRANCHES } from "./context/AuthContext";
import { CreateAgentModal, type CreatedUser } from "./components/CreateAgentModal";
import { ManageNumbersPanel } from "./components/ManageNumbersPanel";

const logoImage  = "/logo.gif";
const SERVER_URL = "https://zqcspamakvfzvlqbunit.supabase.co/functions/v1/make-server-9c23c834";

// ─── Types ────────────────────────────────────────────────────────────────────

type TimeRange = "all" | "today" | "7d" | "30d";

interface AgentStat {
  agentId:    string;
  name:       string;
  branch:     string | null;
  total:      number;
  today:      number;
  period:     number;         // count within the selected time range
  lastActive: string | null;  // ISO timestamp of their most recent message
}

interface BranchBreakdown {
  branch:            string;
  total:             number;
  today:             number;
  period:            number;
  activeAgentsToday: number;
}

interface AdminStats {
  adminRole:       string | null;
  adminBranch:     string | null;
  isGlobalView:    boolean;
  totalAll:        number;
  todayAll:        number;
  periodTotal:     number;
  periodLabel:     string;
  timeRange:       string;
  agents:          AgentStat[];
  branchBreakdown: BranchBreakdown[];
}

interface MessageLog {
  id:              string | number;
  agent_id:        string;
  agent_name:      string;
  branch:          string | null;
  lead_id:         string | null;
  used_number:     string | null;
  customer_phone:  string | null;
  customer_name:   string | null;
  template_type:   string | null;
  message_content: string | null;
  image_url:       string | null;
  created_at:      string;
}

// ─── Branch colour palette ────────────────────────────────────────────────────

const BRANCH_PALETTE: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  Haridwar:  { bg: "#e8f5e9", text: "#2e7d32", border: "#a5d6a7", accent: "#4caf50" },
  Hyderabad: { bg: "#e3f2fd", text: "#1565c0", border: "#90caf9", accent: "#2196f3" },
  Delhi:     { bg: "#fff3e0", text: "#e65100", border: "#ffcc80", accent: "#ff9800" },
  Gurgaon:   { bg: "#fce4ec", text: "#880e4f", border: "#f48fb1", accent: "#e91e63" },
  _default:  { bg: "#f5f5f5", text: "#555",    border: "#e0e0e0", accent: "#9e9e9e" },
};

function bp(name: string | null) {
  return BRANCH_PALETTE[name ?? ""] ?? BRANCH_PALETTE._default;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch { return iso; }
}

function relativeTime(iso: string): string {
  try {
    const diffMs  = Date.now() - new Date(iso).getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1)  return "just now";
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr  < 24) return `${diffHr} hr ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7)  return `${diffDay}d ago`;
    return fmtDate(iso);
  } catch { return iso; }
}

/** Escape a cell value for CSV: wrap in quotes, double internal quotes. */
function csvCell(v: unknown): string {
  return `"${String(v ?? "").replace(/"/g, '""').replace(/\n/g, " ")}"`;
}

function BranchPill({ branch }: { branch: string | null }) {
  if (!branch) return <span style={{ color: "#ccc", fontSize: 11 }}>—</span>;
  const s = bp(branch);
  return (
    <span style={{
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 700,
      whiteSpace: "nowrap", display: "inline-block",
    }}>
      {branch}
    </span>
  );
}

function TemplateBadge({ type }: { type: string | null }) {
  const isImg = type === "image";
  return (
    <span style={{
      background: isImg ? "#e8f5e9" : "#e3f2fd",
      color:      isImg ? "#2e7d32" : "#1565c0",
      border:     `1px solid ${isImg ? "#a5d6a7" : "#90caf9"}`,
      borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600,
    }}>
      {isImg ? "🖼 Image" : "⚡ Quick"}
    </span>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

const BRANCH_EMPTY: Record<string, { emoji: string; tagline: string }> = {
  Haridwar:  { emoji: "🌊", tagline: "The Ganges awaits — send the first message from Haridwar!" },
  Hyderabad: { emoji: "🕌", tagline: "Char Minar is watching — no messages from Hyderabad yet."  },
  Delhi:     { emoji: "🏛️", tagline: "Delhi is ready — be the first to log a message here."      },
  Gurgaon:   { emoji: "🏙️", tagline: "Cyber City is quiet — no Gurgaon messages yet."            },
};

function EmptyState({ branch, context }: { branch: string | null; context: "leaderboard" | "feed" }) {
  const s       = bp(branch);
  const label   = branch ?? "this scope";
  const custom  = branch ? BRANCH_EMPTY[branch] : null;
  const emoji   = custom?.emoji ?? "📊";
  const tagline = custom?.tagline ?? (context === "leaderboard"
    ? `No agents have sent messages for ${label} yet.`
    : `No recent messages for ${label}.`);
  return (
    <div style={{ padding: "52px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 52, marginBottom: 14, lineHeight: 1 }}>{emoji}</div>
      <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 800, color: s.text }}>
        No activity yet{branch ? ` in ${branch}` : ""}
      </h3>
      <p style={{ margin: 0, fontSize: 13, color: "#aaa", maxWidth: 340, marginInline: "auto", lineHeight: 1.6 }}>
        {tagline}
      </p>
      {branch && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginTop: 18,
          padding: "6px 16px", background: s.bg, border: `1px solid ${s.border}`,
          borderRadius: 20, fontSize: 12, color: s.text, fontWeight: 700,
        }}>
          📍 {branch} Branch
        </div>
      )}
    </div>
  );
}

// ─── Time Range Selector ──────────────────────────────────────────────────────

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string; short: string }[] = [
  { value: "all",   label: "All Time",    short: "All"   },
  { value: "today", label: "Today",       short: "Today" },
  { value: "7d",    label: "Last 7 Days", short: "7d"    },
  { value: "30d",   label: "Last 30 Days",short: "30d"   },
];

function TimeRangeFilter({ value, onChange }: { value: TimeRange; onChange: (v: TimeRange) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 11, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginRight: 4 }}>
        Period:
      </span>
      {TIME_RANGE_OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            title={opt.label}
            style={{
              padding: "5px 14px", borderRadius: 20, cursor: "pointer",
              fontWeight: 700, fontSize: 12, whiteSpace: "nowrap",
              border:     isActive ? "2px solid #5a8f5c" : "1.5px solid #e0e0e0",
              background: isActive ? "#5a8f5c"           : "#fafafa",
              color:      isActive ? "#fff"              : "#999",
              transition: "all 0.12s",
            }}
          >
            {opt.short}
          </button>
        );
      })}
    </div>
  );
}

// ─── Branch Bar Chart ─────────────────────────────────────────────────────────
// Superadmin global-view only. Compares message volume across all 4 branches.
// Metric toggle: period count vs today vs all-time.

type ChartMetric = "period" | "today" | "total";

function BranchBarChart({ breakdown, periodLabel }: { breakdown: BranchBreakdown[]; periodLabel: string }) {
  const [metric,   setMetric]   = useState<ChartMetric>("period");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const chartData = breakdown.map((b) => ({
    branch: b.branch,
    value:  metric === "period" ? b.period : metric === "today" ? b.today : b.total,
    fill:   bp(b.branch).accent,
    style:  bp(b.branch),
  }));

  const metricLabel = metric === "period" ? periodLabel : metric === "today" ? "Today" : "All-Time";
  const maxVal      = Math.max(...chartData.map((d) => d.value), 1);

  const METRIC_OPTS: { value: ChartMetric; label: string }[] = [
    { value: "period", label: periodLabel },
    { value: "today",  label: "Today"     },
    { value: "total",  label: "All-Time"  },
  ];

  // ── Pure-SVG bar chart constants ──────────────────────────────────────────
  const SVG_W       = 480;
  const SVG_H       = 195;
  const CHART_TOP   = 16;
  const CHART_BOT   = 158;
  const CHART_H     = CHART_BOT - CHART_TOP; // 142 px
  const BAR_W       = 62;
  const n           = chartData.length || 1;
  const SLOT        = SVG_W / n;             // width per bar slot

  return (
    <div style={{
      background: "#fff", borderRadius: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      padding: "20px 24px 16px", marginBottom: 24,
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1a1a1a" }}>
            📊 Branch Performance Comparison
          </h3>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: "#aaa" }}>
            Messages sent per branch · metric: <strong>{metricLabel}</strong>
          </p>
        </div>
        {/* Metric toggle */}
        <div style={{ display: "flex", gap: 6 }}>
          {METRIC_OPTS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMetric(opt.value)}
              style={{
                padding: "5px 14px", borderRadius: 20, cursor: "pointer",
                fontWeight: 700, fontSize: 11,
                border:     metric === opt.value ? "2px solid #5a8f5c" : "1.5px solid #e0e0e0",
                background: metric === opt.value ? "#5a8f5c"           : "#fafafa",
                color:      metric === opt.value ? "#fff"              : "#888",
                transition: "all 0.12s",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pure-SVG chart — no recharts, no internal key collisions */}
      <div style={{ position: "relative", userSelect: "none" }}>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{ width: "100%", height: 240, display: "block", overflow: "visible" }}
        >
          {/* Horizontal grid lines */}
          {[0.25, 0.5, 0.75, 1].map((frac) => {
            const gy = CHART_BOT - frac * CHART_H;
            return (
              <line
                key={`grid-${frac}`}
                x1={0} y1={gy} x2={SVG_W} y2={gy}
                stroke="#f0f0f0" strokeWidth={1} strokeDasharray="4 3"
              />
            );
          })}

          {/* Baseline */}
          <line x1={0} y1={CHART_BOT} x2={SVG_W} y2={CHART_BOT} stroke="#e8e8e8" strokeWidth={1.5} />

          {/* Bars */}
          {chartData.map((d, i) => {
            const cx    = SLOT * i + SLOT / 2;
            const bx    = cx - BAR_W / 2;
            const barH  = maxVal > 0 ? (d.value / maxVal) * CHART_H : 0;
            const by    = CHART_BOT - barH;
            const r     = barH > 0 ? Math.min(8, BAR_W / 2, barH) : 0;
            const hover = hoverIdx === i;

            return (
              <g
                key={`bar-${d.branch}`}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                style={{ cursor: "default" }}
              >
                {/* Hover highlight zone */}
                <rect
                  x={bx - 6} y={CHART_TOP - 4}
                  width={BAR_W + 12} height={CHART_H + 4}
                  rx={8}
                  fill={hover ? `${d.fill}18` : "transparent"}
                />

                {/* Rounded-top bar path */}
                {barH > 0 && (
                  <path
                    d={`M${bx},${by + barH} L${bx},${by + r} Q${bx},${by} ${bx + r},${by} L${bx + BAR_W - r},${by} Q${bx + BAR_W},${by} ${bx + BAR_W},${by + r} L${bx + BAR_W},${by + barH} Z`}
                    fill={d.fill}
                    opacity={hover ? 1 : 0.82}
                  />
                )}
                {barH === 0 && (
                  <line
                    x1={bx} y1={CHART_BOT}
                    x2={bx + BAR_W} y2={CHART_BOT}
                    stroke={d.fill} strokeWidth={2.5} opacity={0.35}
                  />
                )}

                {/* Value label above bar */}
                <text
                  x={cx}
                  y={barH > 0 ? by - 7 : CHART_BOT - 9}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={800}
                  fill={barH > 0 ? d.fill : "#ccc"}
                >
                  {d.value}
                </text>

                {/* Branch name label */}
                <text
                  x={cx}
                  y={SVG_H - 4}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={700}
                  fill={hover ? d.fill : "#666"}
                >
                  {d.branch}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating tooltip */}
        {hoverIdx !== null && chartData[hoverIdx] && (
          <div
            style={{
              position: "absolute",
              top: 4,
              left: `${((hoverIdx + 0.5) / chartData.length) * 100}%`,
              transform: "translateX(-50%)",
              background: "#fff",
              borderRadius: 10,
              padding: "10px 16px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.13)",
              border: `1.5px solid ${chartData[hoverIdx].style.border}`,
              pointerEvents: "none",
              zIndex: 10,
              whiteSpace: "nowrap",
            }}
          >
            <div style={{ fontWeight: 800, color: chartData[hoverIdx].style.text, marginBottom: 4 }}>
              📍 {chartData[hoverIdx].branch}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a" }}>
              {chartData[hoverIdx].value}
            </div>
            <div style={{ fontSize: 11, color: "#aaa" }}>messages · {metricLabel}</div>
          </div>
        )}
      </div>

      {/* Branch legend */}
      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
        {breakdown.map((b, idx) => (
          <div key={`legend-${idx}-${b.branch}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: bp(b.branch).accent, display: "inline-block" }} />
            <span style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>{b.branch}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#1a1a1a" }}>
              {metric === "period" ? b.period : metric === "today" ? b.today : b.total}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Radix Branch Select ──────────────────────────────────────────────────────

const SELECT_OPTIONS = [
  { value: "Global",    label: "🌐 Global View", sub: "All branches combined" },
  { value: "Haridwar",  label: "📍 Haridwar",   sub: "Uttarakhand branch"     },
  { value: "Hyderabad", label: "📍 Hyderabad",  sub: "Telangana branch"       },
  { value: "Delhi",     label: "📍 Delhi",      sub: "Delhi branch"           },
  { value: "Gurgaon",   label: "📍 Gurgaon",    sub: "Haryana branch"         },
];

function BranchSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const chosen   = SELECT_OPTIONS.find((o) => o.value === value) ?? SELECT_OPTIONS[0];
  const isGlobal = value === "Global";
  const s        = isGlobal ? { bg: "#f0faf0", text: "#2e7d32", border: "#a5d6a7" } : bp(value);

  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        aria-label="Select branch"
        style={{
          display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 16px",
          borderRadius: 12, border: `2px solid ${s.border}`, background: s.bg, color: s.text,
          fontWeight: 700, fontSize: 14, cursor: "pointer", outline: "none",
          minWidth: 220, justifyContent: "space-between",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)", transition: "border-color 0.15s",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>{chosen.label.split(" ")[0]}</span>
          <span>{chosen.label.split(" ").slice(1).join(" ")}</span>
        </span>
        <Select.Icon>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={6} style={{
          background: "#fff", borderRadius: 14, border: "1px solid #e8e8e8",
          boxShadow: "0 12px 40px rgba(0,0,0,0.15)", minWidth: 260, overflow: "hidden", zIndex: 200,
        }}>
          <Select.Viewport style={{ padding: 6 }}>
            {SELECT_OPTIONS.map((opt) => {
              const os = opt.value === "Global" ? { bg: "#f0faf0", text: "#2e7d32" } : bp(opt.value);
              return (
                <Select.Item key={opt.value} value={opt.value}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, cursor: "pointer", outline: "none", userSelect: "none", margin: "2px 0" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = os.bg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: opt.value === "Global" ? "#5a8f5c" : os.text, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <Select.ItemText>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", display: "block" }}>{opt.label}</span>
                    </Select.ItemText>
                    <span style={{ fontSize: 11, color: "#aaa" }}>{opt.sub}</span>
                  </div>
                  <Select.ItemIndicator>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={os.text} strokeWidth={3}>
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Select.ItemIndicator>
                </Select.Item>
              );
            })}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

// ─── Global Branch Breakdown Cards ───────────────────────────────────────────

function BranchBreakdownGrid({ breakdown, onDrillIn }: { breakdown: BranchBreakdown[]; onDrillIn: (b: string) => void }) {
  if (!breakdown.length) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 18 }}>🌐</span>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1a1a1a" }}>Global Analytics</h3>
        <span style={{ fontSize: 12, color: "#aaa", background: "#f5f5f5", borderRadius: 20, padding: "2px 10px" }}>
          Click a card to drill in
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {breakdown.map((b) => {
          const s = bp(b.branch);
          return (
            <button key={b.branch} onClick={() => onDrillIn(b.branch)}
              style={{
                background: "#fff", borderRadius: 16, border: `2px solid ${s.border}`,
                padding: "20px 22px", textAlign: "left", cursor: "pointer",
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                transition: "transform 0.15s, box-shadow 0.15s, border-color 0.15s",
                position: "relative", overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform   = "translateY(-3px)";
                e.currentTarget.style.boxShadow   = "0 8px 24px rgba(0,0,0,0.12)";
                e.currentTarget.style.borderColor = s.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform   = "translateY(0)";
                e.currentTarget.style.boxShadow   = "0 2px 12px rgba(0,0,0,0.06)";
                e.currentTarget.style.borderColor = s.border;
              }}
            >
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: s.accent, borderRadius: "16px 0 0 16px" }} />
              <div style={{ paddingLeft: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}`, borderRadius: 20, padding: "3px 12px", fontSize: 13, fontWeight: 700 }}>📍 {b.branch}</span>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={s.text} strokeWidth={2.5}>
                    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div style={{ display: "flex", gap: 20 }}>
                  {[{ n: b.today, l: "Today" }, { n: b.total, l: "All-Time" }, { n: b.activeAgentsToday, l: "Active" }].map(({ n, l }) => (
                    <div key={l}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: "#1a1a1a", lineHeight: 1 }}>{n}</div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, accent, sub }: { label: string; value: number | string; icon: string; accent: string; sub?: string }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16, padding: "20px 24px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      display: "flex", alignItems: "center", gap: 16, flex: 1, minWidth: 170,
    }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#1a1a1a", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: "#ccc", marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── Export CSV ───────────────────────────────────────────────────────────────
// Pages through /admin/messages (max 1 000 rows), builds CSV, triggers download.

async function exportCSV(opts: {
  branchScope:  string | null;
  isSuperadmin: boolean;
  timeRange:    TimeRange;
  scopeLabel:   string;
  getToken:     () => Promise<HeadersInit>;
}): Promise<void> {
  const { branchScope, isSuperadmin, timeRange, scopeLabel, getToken } = opts;
  const PAGE = 200;
  const MAX  = 1000;
  const all: MessageLog[] = [];
  let offset = 0, total = 0;

  do {
    const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
    if (isSuperadmin && branchScope) params.set("branch", branchScope);
    if (timeRange !== "all")         params.set("timeRange", timeRange);

    const headers = await getToken();
    const res     = await fetch(`${SERVER_URL}/admin/messages?${params}`, { headers });
    const data    = await res.json();
    if (!data.success) break;

    total = data.total ?? 0;
    for (const m of data.messages ?? []) all.push(m as MessageLog);
    offset += PAGE;
  } while (offset < total && all.length < MAX);

  if (!all.length) { alert("No messages found for the selected filters."); return; }

  const headers = ["Date", "Agent", "Branch", "Customer", "Phone", "Lead ID", "Type", "Used #", "Message"];
  const rows    = all.map((m) => [
    fmtDate(m.created_at),
    m.agent_name,
    m.branch ?? "",
    m.customer_name    ?? "",
    m.customer_phone   ?? "",
    m.lead_id          ?? "",
    m.template_type    ?? "",
    m.used_number      ?? "",
    m.message_content  ?? (m.image_url ? "[Image]" : ""),
  ]);

  const csv  = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href     = url;
  a.download = `qht_messages_${scopeLabel.replace(/\s+/g, "_")}_${timeRange}_${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Live Activity Feed ───────────────────────────────────────────────────────

interface LiveFeedProps {
  branchScope:  string | null;
  isSuperadmin: boolean;
  timeRange:    TimeRange;
  getAuthToken: () => Promise<HeadersInit>;
  refreshKey:   Date | null;
}

function LiveActivityFeed({ branchScope, isSuperadmin, timeRange, getAuthToken, refreshKey }: LiveFeedProps) {
  const [items,   setItems]   = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg,  setErrMsg]  = useState<string | null>(null);
  const scrollRef             = useRef<HTMLDivElement>(null);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setErrMsg(null);
    try {
      const headers = await getAuthToken();
      const params  = new URLSearchParams({ limit: String(LIMIT), offset: "0" });
      if (isSuperadmin && branchScope) params.set("branch", branchScope);
      if (timeRange !== "all")         params.set("timeRange", timeRange);

      const res  = await fetch(`${SERVER_URL}/admin/messages?${params}`, { headers });
      const data = await res.json();
      if (!res.ok) { setErrMsg(data.error ?? `Error ${res.status}`); return; }
      if (data.success) {
        setItems(data.messages ?? []);
        requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; });
      }
    } catch (err) {
      console.error("[Feed] fetch error:", err);
      setErrMsg("Could not load activity feed.");
    } finally { setLoading(false); }
  }, [branchScope, isSuperadmin, timeRange, getAuthToken]);

  useEffect(() => { setLoading(true); load(); }, [load, refreshKey]);

  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try { bc = new BroadcastChannel("qht_message_sent"); bc.onmessage = () => load(); } catch { /* n/a */ }
    const onStorage = (e: StorageEvent) => { if (e.key === "qht_last_send") load(); };
    window.addEventListener("storage", onStorage);
    return () => { bc?.close(); window.removeEventListener("storage", onStorage); };
  }, [load]);

  return (
    <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", overflow: "hidden", marginTop: 24 }}>
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8faf8" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ position: "relative", display: "inline-flex", width: 10, height: 10, flexShrink: 0 }}>
            <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#4caf50", opacity: 0.5, animation: "pingDot 1.5s cubic-bezier(0,0,0.2,1) infinite" }} />
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#4caf50", display: "block" }} />
          </span>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1a1a1a" }}>Live Activity Feed</h2>
          {branchScope ? <BranchPill branch={branchScope} /> : <span style={{ background: "#e8f5e9", color: "#2e7d32", border: "1px solid #a5d6a7", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>🌐 All Branches</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#ccc" }}>Last {LIMIT}</span>
          <button onClick={() => { setLoading(true); load(); }} disabled={loading} style={{ padding: "4px 12px", borderRadius: 8, border: "1px solid #e0e0e0", background: loading ? "#f5f5f5" : "#fff", color: loading ? "#ccc" : "#555", cursor: loading ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600 }}>
            {loading ? "⏳" : "🔄"}
          </button>
        </div>
      </div>

      <div ref={scrollRef} style={{ overflowY: "auto", maxHeight: 440, scrollBehavior: "smooth" }}>
        {loading ? (
          <div style={{ padding: "12px 20px" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #f5f5f5", opacity: 1 - i * 0.12 }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#f0f0f0", flexShrink: 0, animation: "shimmer 1.4s ease-in-out infinite" }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
                  <div style={{ width: `${40 + i * 8}%`, height: 10, borderRadius: 6, background: "#f0f0f0", animation: "shimmer 1.4s ease-in-out infinite" }} />
                  <div style={{ width: `${55 + i * 5}%`, height: 10, borderRadius: 6, background: "#f5f5f5", animation: "shimmer 1.4s ease-in-out infinite" }} />
                </div>
              </div>
            ))}
          </div>
        ) : errMsg ? (
          <div style={{ padding: 40, textAlign: "center", color: "#dc2626", fontSize: 13 }}>⚠️ {errMsg}</div>
        ) : items.length === 0 ? (
          <EmptyState branch={branchScope} context="feed" />
        ) : (
          <div style={{ padding: "0 20px" }}>
            {items.map((msg, i) => {
              const s     = bp(msg.branch);
              const isImg = msg.template_type === "image";
              return (
                <div key={String(msg.id)}
                  style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "13px 8px", borderBottom: i < items.length - 1 ? "1px solid #f5f5f5" : "none", borderRadius: 8, transition: "background 0.12s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#fafcfa"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: `linear-gradient(135deg, ${s.accent}cc, ${s.accent}66)`, border: `2px solid ${s.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: s.text }}>
                    {msg.agent_name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{msg.agent_name}</span>
                      <BranchPill branch={msg.branch} />
                      <TemplateBadge type={msg.template_type} />
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginBottom: 3 }}>
                      To: <span style={{ fontWeight: 600, color: "#333" }}>{msg.customer_name ?? "—"}</span>
                      {msg.customer_phone && <span style={{ color: "#bbb", marginLeft: 6 }}>{msg.customer_phone}</span>}
                    </div>
                    <div title={msg.message_content ?? ""} style={{ fontSize: 12, color: "#999", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {isImg ? "📷 Image message" : msg.message_content ? msg.message_content.slice(0, 110) + (msg.message_content.length > 110 ? "…" : "") : "—"}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span style={{ fontSize: 11, color: "#bbb", whiteSpace: "nowrap" }}>{relativeTime(msg.created_at)}</span>
                    {msg.lead_id && <span style={{ fontSize: 10, color: "#d0d0d0", fontFamily: "monospace" }}>#{msg.lead_id}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pingDot { 75%,100% { transform:scale(2.2);opacity:0; } }
        @keyframes shimmer  { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes spin     { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Messages Modal ───────────────────────────────────────────────────────────

function MessagesModal({
  agentId, agentName, branchScope, isSuperadmin, timeRange, onClose, authHeader,
}: {
  agentId:      string | null;
  agentName:    string;
  branchScope:  string | null;
  isSuperadmin: boolean;
  timeRange:    TimeRange;
  onClose:      () => void;
  authHeader:   () => HeadersInit;
}) {
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [offset,   setOffset]   = useState(0);
  const PAGE = 30;

  const load = useCallback(async (off: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE), offset: String(off) });
      if (agentId)                             params.set("agent_id", agentId);
      if (isSuperadmin && branchScope)         params.set("branch",   branchScope);
      if (timeRange !== "all")                 params.set("timeRange", timeRange);
      const res  = await fetch(`${SERVER_URL}/admin/messages?${params}`, { headers: authHeader() });
      const data = await res.json();
      if (data.success) { setMessages(data.messages ?? []); setTotal(data.total ?? 0); }
    } catch (err) { console.error("[Modal] fetch error:", err); }
    finally { setLoading(false); }
  }, [agentId, branchScope, isSuperadmin, timeRange, authHeader]);

  useEffect(() => { setOffset(0); load(0); }, [load]);

  const prev = () => { const o = Math.max(0, offset - PAGE); setOffset(o); load(o); };
  const next = () => { const o = offset + PAGE; setOffset(o); load(o); };

  const COLS = ["Date & Time", "Agent", "Branch", "Customer", "Phone", "Lead ID", "Type", "Used #", "Message"];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 1080, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.28)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "18px 28px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8faf8", borderRadius: "20px 20px 0 0", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1a1a1a" }}>📋 Message Logs</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
              {agentId ? agentName : "All Agents"} · {branchScope ? <BranchPill branch={branchScope} /> : "All Branches"} — <strong>{total}</strong> records
            </p>
          </div>
          <button onClick={onClose} style={{ background: "#fee2e2", border: "none", borderRadius: 10, padding: "8px 20px", color: "#dc2626", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>✕ Close</button>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 220, color: "#5a8f5c", gap: 10 }}>
              <svg style={{ animation: "spin 1s linear infinite" }} width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/></svg>
              Loading messages…
            </div>
          ) : messages.length === 0 ? (
            <EmptyState branch={branchScope} context="feed" />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8faf8", position: "sticky", top: 0 }}>
                  {COLS.map((h) => (
                    <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#888", borderBottom: "2px solid #e8e8e8", whiteSpace: "nowrap", letterSpacing: "0.5px", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {messages.map((msg, i) => (
                  <tr key={String(msg.id)} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#555", whiteSpace: "nowrap" }}>{fmtDate(msg.created_at)}</td>
                    <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#1a1a1a", whiteSpace: "nowrap" }}>{msg.agent_name}</td>
                    <td style={{ padding: "10px 14px" }}><BranchPill branch={msg.branch} /></td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: "#333", whiteSpace: "nowrap" }}>{msg.customer_name ?? "—"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#555", whiteSpace: "nowrap" }}>{msg.customer_phone ?? "—"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#555" }}>{msg.lead_id ?? "—"}</td>
                    <td style={{ padding: "10px 14px" }}><TemplateBadge type={msg.template_type} /></td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#555", whiteSpace: "nowrap" }}>{msg.used_number ?? "—"}</td>
                    <td title={msg.message_content ?? ""} style={{ padding: "10px 14px", fontSize: 12, color: "#333", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {msg.message_content ? msg.message_content.slice(0, 80) + (msg.message_content.length > 80 ? "…" : "") : msg.image_url ? "📷 [Image]" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {total > PAGE && (
          <div style={{ padding: "12px 28px", borderTop: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8faf8", borderRadius: "0 0 20px 20px" }}>
            <span style={{ fontSize: 13, color: "#888" }}>{offset + 1}–{Math.min(offset + PAGE, total)} of {total}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={prev} disabled={offset === 0} style={{ padding: "6px 18px", borderRadius: 8, border: "1px solid #ddd", background: offset === 0 ? "#f5f5f5" : "#fff", color: offset === 0 ? "#ccc" : "#333", cursor: offset === 0 ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 13 }}>← Prev</button>
              <button onClick={next} disabled={offset + PAGE >= total} style={{ padding: "6px 18px", borderRadius: 8, border: "none", background: offset + PAGE >= total ? "#f5f5f5" : "#5a8f5c", color: offset + PAGE >= total ? "#ccc" : "#fff", cursor: offset + PAGE >= total ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13 }}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  const isSuperadmin = profile?.isSuperadmin ?? false;
  const [selectedView, setSelectedView] = useState<string>("Global");
  const [timeRange,    setTimeRange]    = useState<TimeRange>("today");

  const [stats,       setStats]       = useState<AdminStats | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [refreshing,  setRefreshing]  = useState(false);
  const [exporting,   setExporting]   = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [modalAgent,       setModalAgent]       = useState<{ agentId: string | null; name: string } | null>(null);
  const [showCreateAgent,  setShowCreateAgent]  = useState(false);
  const [dashTab,          setDashTab]          = useState<"analytics" | "numbers">("analytics");

  // ── Auth ──────────────────────────────────────────────────────────────────
  const getFreshAuthHeader = useCallback(async (): Promise<HeadersInit> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? "";
    if (!token) console.warn("[Admin] no access token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const [cachedHeaders, setCachedHeaders] = useState<HeadersInit>({});
  const syncAuthHeader = useCallback(() => cachedHeaders, [cachedHeaders]);

  // ── Stats fetch ────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const headers = await getFreshAuthHeader();
      setCachedHeaders(headers);

      const params = new URLSearchParams();
      if (isSuperadmin && selectedView !== "Global") params.set("branch", selectedView);
      if (timeRange !== "all") params.set("timeRange", timeRange);

      const url  = `${SERVER_URL}/admin/stats${params.toString() ? "?" + params : ""}`;
      const res  = await fetch(url, { headers });
      const data = await res.json();

      if (!res.ok) { setError(data.error ?? `Server error (${res.status})`); return; }
      if (data.success) {
        setStats({
          adminRole:       data.adminRole       ?? null,
          adminBranch:     data.adminBranch     ?? null,
          isGlobalView:    data.isGlobalView    ?? false,
          totalAll:        data.totalAll,
          todayAll:        data.todayAll,
          periodTotal:     data.periodTotal     ?? data.totalAll,
          periodLabel:     data.periodLabel     ?? "All Time",
          timeRange:       data.timeRange       ?? "all",
          agents:          data.agents          ?? [],
          branchBreakdown: data.branchBreakdown ?? [],
        });
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error("[Admin] fetchStats exception:", err);
      setError("Network error — could not reach the server.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getFreshAuthHeader, isSuperadmin, selectedView, timeRange]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    const t = setInterval(() => fetchStats(true), 30_000);
    return () => clearInterval(t);
  }, [fetchStats]);

  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try { bc = new BroadcastChannel("qht_message_sent"); bc.onmessage = () => fetchStats(true); } catch { /* n/a */ }
    const onStorage = (e: StorageEvent) => { if (e.key === "qht_last_send") fetchStats(true); };
    window.addEventListener("storage", onStorage);
    return () => { bc?.close(); window.removeEventListener("storage", onStorage); };
  }, [fetchStats]);

  const drillIntoBranch = useCallback((branch: string) => {
    setSelectedView(branch);
    setTimeRange("today");
  }, []);
  const handleLogout    = () => { navigate("/login", { replace: true }); logout(); };

  const scopeLabel = isSuperadmin
    ? (selectedView === "Global" ? "All Branches" : selectedView)
    : (profile?.branch ?? "Your Branch");

  const activeScopeStyle = isSuperadmin && selectedView !== "Global"
    ? bp(selectedView)
    : { bg: "#e8f5e9", text: "#2e7d32", border: "#a5d6a7", accent: "#4caf50" };

  const feedBranchScope = isSuperadmin && selectedView !== "Global" ? selectedView : null;

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportCSV({
        branchScope:  feedBranchScope,
        isSuperadmin,
        timeRange,
        scopeLabel,
        getToken:     getFreshAuthHeader,
      });
    } finally { setExporting(false); }
  };

  /** Called by CreateAgentModal on success — refresh stats + show toast. */
  const handleAgentCreated = useCallback((newUser: CreatedUser) => {
    // Refresh the leaderboard so the new agent appears immediately
    fetchStats(true);
    // Small visual confirmation in the control bar area (toast via DOM — no
    // external lib needed; the modal already shows a success screen)
    console.log(
      `[Admin] ✅ New ${newUser.role} created: ${newUser.full_name} ` +
      `(${newUser.email}) → ${newUser.branch}`
    );
  }, [fetchStats]);

  // Period display label for the primary stat card
  const periodStatLabel = stats?.periodLabel ?? "All Time";
  const primaryCount    = stats?.periodTotal ?? stats?.totalAll ?? 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(150deg, #f0f7f0 0%, #e6eee6 100%)",
      padding: "20px 20px 40px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      {showCreateAgent && (
        <CreateAgentModal
          isSuperadmin={isSuperadmin}
          adminBranch={profile?.branch ?? null}
          getAuthHeader={getFreshAuthHeader}
          onSuccess={handleAgentCreated}
          onClose={() => setShowCreateAgent(false)}
        />
      )}

      {modalAgent && (
        <MessagesModal
          agentId={modalAgent.agentId}
          agentName={modalAgent.name}
          branchScope={feedBranchScope}
          isSuperadmin={isSuperadmin}
          timeRange={timeRange}
          onClose={() => setModalAgent(null)}
          authHeader={syncAuthHeader}
        />
      )}

      <div style={{ maxWidth: 1340, margin: "0 auto" }}>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div style={{
          background: "#fff", borderRadius: 20, padding: "18px 28px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 18, flexWrap: "wrap", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src={logoImage} alt="QHT" style={{ width: 46, height: 46, objectFit: "contain" }} />
            <div>
              <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: "#5a8f5c" }}>Admin Dashboard</h1>
              <p style={{ margin: "3px 0 0", fontSize: 11, color: "#bbb" }}>
                QHT Clinic · WhatsApp Analytics
                {lastUpdated && <> · Updated {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}</>}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{
              background: isSuperadmin ? "#f3e8ff" : "#fff8e1",
              border: `1px solid ${isSuperadmin ? "#c084fc" : "#ffe082"}`,
              borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 700,
              color: isSuperadmin ? "#7c3aed" : "#b45309",
            }}>
              {isSuperadmin ? "🌐 Superadmin" : "👑 Admin"} · {profile?.name ?? "—"}
            </div>
            {!isSuperadmin && profile?.branch && <BranchPill branch={profile.branch} />}
            <button onClick={() => fetchStats(true)} disabled={refreshing} style={{ padding: "6px 14px", borderRadius: 9, border: "1px solid #d1d5db", background: refreshing ? "#f5f5f5" : "#fff", color: refreshing ? "#aaa" : "#333", cursor: refreshing ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 12 }}>
              {refreshing ? "⏳" : "🔄"} {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            {/* Export CSV */}
            <button
              onClick={handleExport}
              disabled={exporting || loading}
              style={{
                padding: "6px 14px", borderRadius: 9, border: "none",
                background: exporting ? "#f5f5f5" : "#0ea5e9",
                color: exporting ? "#aaa" : "#fff",
                cursor: exporting ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 12,
              }}
            >
              {exporting ? "⏳ Exporting…" : "⬇ Export CSV"}
            </button>
            <button
              onClick={() => setShowCreateAgent(true)}
              style={{ padding: "6px 14px", borderRadius: 9, border: "none", background: "linear-gradient(135deg, #5a8f5c, #4a7a4f)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 12, boxShadow: "0 2px 8px rgba(90,143,92,0.28)" }}
            >
              ➕ Add Agent
            </button>
            <button
              onClick={() => setDashTab((t) => t === "numbers" ? "analytics" : "numbers")}
              style={{
                padding: "6px 14px", borderRadius: 9, border: `1.5px solid ${dashTab === "numbers" ? "#5a8f5c" : "#e0e0e0"}`,
                background: dashTab === "numbers" ? "#e8f5e9" : "#fff",
                color: dashTab === "numbers" ? "#2e7d32" : "#666",
                cursor: "pointer", fontWeight: 700, fontSize: 12,
              }}
            >
              📱 {dashTab === "numbers" ? "← Analytics" : "Manage Numbers"}
            </button>
            <button onClick={() => navigate("/home")} style={{ padding: "6px 14px", borderRadius: 9, border: "none", background: "#5a8f5c", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>📱 Sender</button>
            <button onClick={handleLogout} style={{ padding: "6px 14px", borderRadius: 9, border: "none", background: "#dc2626", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>🚪 Logout</button>
          </div>
        </div>

        {/* ── Control bar: Branch Switcher + Time Range ─────────────────────── */}
        <div style={{
          background: "#fff", borderRadius: 16, padding: "14px 24px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          display: "flex", alignItems: "center", gap: 20,
          marginBottom: 18, flexWrap: "wrap",
        }}>
          {/* Branch switcher — superadmin only */}
          {isSuperadmin && (
            <>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.5px" }}>Branch</div>
                <div style={{ fontSize: 10, color: "#ccc" }}>Filter by branch</div>
              </div>
              <BranchSelect value={selectedView} onChange={(v) => { setSelectedView(v); setTimeRange("today"); }} />
              <div style={{ height: 32, width: 1, background: "#e8e8e8" }} />
            </>
          )}

          {/* Time range filter — all roles */}
          <TimeRangeFilter value={timeRange} onChange={setTimeRange} />

          {/* Scope pill */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#ccc" }}>Scope:</span>
            {selectedView === "Global" || !isSuperadmin
              ? (isSuperadmin
                  ? <span style={{ background: "#e8f5e9", color: "#2e7d32", border: "1px solid #a5d6a7", borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>🌐 All Branches</span>
                  : <BranchPill branch={profile?.branch ?? null} />)
              : <BranchPill branch={selectedView} />}
          </div>

          {/* Quick pills — superadmin */}
          {isSuperadmin && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {["Global", ...BRANCHES].map((br) => {
                const isActive = selectedView === br;
                const s = br === "Global" ? { bg: "#5a8f5c", text: "#fff", border: "#5a8f5c" } : bp(br);
                return (
                  <button key={br} onClick={() => { setSelectedView(br); setTimeRange("today"); }}
                    style={{ padding: "4px 11px", borderRadius: 20, cursor: "pointer", fontWeight: 700, fontSize: 11, border: isActive ? `2px solid ${s.text}` : "1.5px solid #e8e8e8", background: isActive ? s.bg : "#fafafa", color: isActive ? s.text : "#aaa", transition: "all 0.12s" }}>
                    {br === "Global" ? "🌐" : "📍"} {br}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "14px 20px", color: "#dc2626", marginBottom: 18, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span>⚠️ {error}</span>
            <button onClick={() => fetchStats(false)} style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fff", color: "#dc2626", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Retry</button>
          </div>
        )}

        {/* ── Manage Numbers tab ───────────────────────────────────────────── */}
        {dashTab === "numbers" && (
          <ManageNumbersPanel
            isSuperadmin={isSuperadmin}
            adminBranch={profile?.branch ?? null}
            getAuthHeader={getFreshAuthHeader}
          />
        )}

        {/* ── Analytics tab content ─────────────────────────────────────────── */}
        {dashTab === "analytics" && (loading ? (
          <div style={{ background: "#fff", borderRadius: 20, padding: 80, textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>⏳</div>
            <p style={{ color: "#888", fontSize: 15, margin: 0 }}>Loading {selectedView === "Global" ? "global" : selectedView} analytics…</p>
          </div>
        ) : (
          <>
            {/* ── Global breakdown cards ────────────────────────────────────── */}
            {isSuperadmin && stats?.isGlobalView && stats.branchBreakdown.length > 0 && (
              <BranchBreakdownGrid breakdown={stats.branchBreakdown} onDrillIn={drillIntoBranch} />
            )}

            {/* ── Branch Bar Chart (superadmin global only) ─────────────────── */}
            {isSuperadmin && stats?.isGlobalView && stats.branchBreakdown.length > 0 && (
              <BranchBarChart
                breakdown={stats.branchBreakdown}
                periodLabel={stats.periodLabel}
              />
            )}

            {/* ── Summary stat cards ────────────────────────────────────────── */}
            <div style={{ display: "flex", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
              <StatCard
                icon="📅"
                label={`${periodStatLabel} · ${scopeLabel}`}
                value={primaryCount}
                accent="#e8f5e9"
                sub={timeRange !== "all" ? `All-time: ${stats?.totalAll ?? 0}` : undefined}
              />
              <StatCard icon="🕐" label={`Today · ${scopeLabel}`} value={stats?.todayAll ?? 0} accent="#e3f2fd" />
              <StatCard icon="👥" label="Agents Active Today" value={stats?.agents.filter((a) => a.today > 0).length ?? 0} accent="#fce4ec" />
            </div>

            {/* ── Toolbar: scope + view-all + export ───────────────────────── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#888" }}>Data for</span>
                {selectedView === "Global" || !isSuperadmin
                  ? (isSuperadmin
                      ? <span style={{ background: "#e8f5e9", color: "#2e7d32", border: "1px solid #a5d6a7", borderRadius: 20, padding: "2px 12px", fontSize: 13, fontWeight: 700 }}>🌐 All Branches</span>
                      : <BranchPill branch={profile?.branch ?? null} />)
                  : <BranchPill branch={selectedView} />}
                <span style={{ fontSize: 13, color: "#bbb" }}>·</span>
                <span style={{ fontSize: 13, color: "#888" }}>
                  <strong style={{ color: "#5a8f5c" }}>{stats?.periodLabel}</strong>
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  style={{ padding: "8px 18px", borderRadius: 10, border: "1px solid #0ea5e9", background: "#f0f9ff", color: "#0369a1", cursor: exporting ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 12 }}
                >
                  {exporting ? "⏳" : "⬇"} Export CSV
                </button>
                <button
                  onClick={() => setShowCreateAgent(true)}
                  style={{ padding: "8px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #5a8f5c, #4a7a4f)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13, boxShadow: "0 4px 14px rgba(90,143,92,0.28)", display: "flex", alignItems: "center", gap: 6 }}
                >
                  ➕ Add Agent
                </button>
                <button
                  onClick={() => setModalAgent({ agentId: null, name: "All Agents" })}
                  style={{ padding: "8px 20px", borderRadius: 10, border: "1px solid #5a8f5c", background: "#f0faf0", color: "#5a8f5c", cursor: "pointer", fontWeight: 700, fontSize: 13 }}
                >
                  📋 View All Logs
                </button>
              </div>
            </div>

            {/* ── Agent Leaderboard ─────────────────────────────────────────── */}
            <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", overflow: "hidden" }}>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1a1a1a" }}>👥 Agent Performance</h2>
                  {selectedView === "Global" || !isSuperadmin
                    ? (isSuperadmin
                        ? <span style={{ background: "#e8f5e9", color: "#2e7d32", border: "1px solid #a5d6a7", borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>🌐 Global</span>
                        : <BranchPill branch={profile?.branch ?? null} />)
                    : <BranchPill branch={selectedView} />}
                  {timeRange !== "all" && (
                    <span style={{ background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
                      📅 {stats?.periodLabel}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: "#bbb" }}>
                  {stats?.agents.length ?? 0} agent{(stats?.agents.length ?? 0) !== 1 ? "s" : ""} ·{" "}
                  sorted by {timeRange === "all" ? "all-time" : stats?.periodLabel?.toLowerCase() ?? "period"}
                </span>
              </div>

              {!stats?.agents.length ? (
                <EmptyState
                  branch={isSuperadmin && selectedView !== "Global" ? selectedView : (profile?.branch ?? null)}
                  context="leaderboard"
                />
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8faf8" }}>
                        {[
                          "#",
                          "Agent",
                          ...(isSuperadmin ? ["Branch"] : []),
                          timeRange === "all" ? "Total Messages" : `${stats?.periodLabel ?? "Period"}`,
                          "All-Time",
                          "Today",
                          "Last Active",
                          "Share",
                          "Actions",
                        ].map((h, colIdx) => (
                          <th key={`th-${colIdx}`} style={{ padding: "12px 18px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#888", borderBottom: "2px solid #e8e8e8", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.agents.map((agent, idx) => {
                        const primaryVal = timeRange === "all" ? agent.total : agent.period;
                        const share      = (timeRange === "all" ? stats.totalAll : stats.periodTotal) > 0
                          ? Math.round((primaryVal / (timeRange === "all" ? stats.totalAll : stats.periodTotal)) * 100)
                          : 0;
                        const rankIcon = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
                        return (
                          <tr key={agent.agentId} style={{ borderBottom: "1px solid #f5f5f5", background: idx % 2 === 0 ? "#fff" : "#fafafa" }}>
                            {/* Rank */}
                            <td style={{ padding: "14px 18px", fontSize: idx < 3 ? 20 : 13, fontWeight: 700, color: idx === 0 ? "#f59e0b" : idx === 1 ? "#9ca3af" : idx === 2 ? "#92400e" : "#d1d5db" }}>{rankIcon}</td>

                            {/* Agent */}
                            <td style={{ padding: "14px 18px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${activeScopeStyle.accent}, #4a7a4f)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                                  {agent.name.charAt(0).toUpperCase()}
                                </div>
                                <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{agent.name}</span>
                              </div>
                            </td>

                            {/* Branch — superadmin only */}
                            {isSuperadmin && (
                              <td style={{ padding: "14px 18px" }}><BranchPill branch={agent.branch} /></td>
                            )}

                            {/* Primary metric (period or all-time) */}
                            <td style={{ padding: "14px 18px" }}>
                              <span style={{ fontSize: 24, fontWeight: 800, color: primaryVal > 0 ? "#5a8f5c" : "#e0e0e0" }}>{primaryVal}</span>
                            </td>

                            {/* All-Time (always) */}
                            <td style={{ padding: "14px 18px" }}>
                              <span style={{ fontSize: 20, fontWeight: 700, color: "#888" }}>{agent.total}</span>
                            </td>

                            {/* Today */}
                            <td style={{ padding: "14px 18px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 18, fontWeight: 700, color: agent.today > 0 ? "#2196f3" : "#e0e0e0" }}>{agent.today}</span>
                                {agent.today > 0 && <span style={{ background: "#e3f2fd", color: "#1565c0", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>NOW</span>}
                              </div>
                            </td>

                            {/* Last Active */}
                            <td style={{ padding: "14px 18px" }}>
                              {agent.lastActive ? (
                                <span title={fmtDate(agent.lastActive)} style={{ fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>
                                  {relativeTime(agent.lastActive)}
                                </span>
                              ) : (
                                <span style={{ color: "#ddd", fontSize: 12 }}>—</span>
                              )}
                            </td>

                            {/* Share bar */}
                            <td style={{ padding: "14px 18px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 80, height: 6, background: "#e8e8e8", borderRadius: 4, overflow: "hidden" }}>
                                  <div style={{ width: `${share}%`, height: "100%", background: `linear-gradient(90deg, ${activeScopeStyle.accent}, #4a7a4f)`, borderRadius: 4, transition: "width 0.6s ease" }} />
                                </div>
                                <span style={{ fontSize: 11, color: "#bbb", fontWeight: 600, whiteSpace: "nowrap" }}>{share}%</span>
                              </div>
                            </td>

                            {/* Actions */}
                            <td style={{ padding: "14px 18px" }}>
                              <button
                                onClick={() => setModalAgent({ agentId: agent.agentId, name: agent.name })}
                                style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid #5a8f5c", background: "#f0faf0", color: "#5a8f5c", cursor: "pointer", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}
                              >
                                📋 Logs
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{ padding: "10px 24px", borderTop: "1px solid #f5f5f5", fontSize: 10, color: "#ddd", textAlign: "right" }}>
                Auto-refreshes every 30 s · {scopeLabel} · {isSuperadmin ? "Superadmin" : "Admin"} · Period: {stats?.periodLabel}
              </div>
            </div>

            {/* ── Live Activity Feed ────────────────────────────────────────── */}
            <LiveActivityFeed
              branchScope={feedBranchScope}
              isSuperadmin={isSuperadmin}
              timeRange={timeRange}
              getAuthToken={getFreshAuthHeader}
              refreshKey={lastUpdated}
            />
          </>
        ) )}
      </div>
    </div>
  );
}
