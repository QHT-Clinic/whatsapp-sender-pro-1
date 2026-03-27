/**
 * RecentLogsSidebar v3.0 — B2B SaaS Timeline Feed
 *
 * Design:
 *   • White panel with subtle shadow
 *   • Timeline connector: vertical line on the left between avatar circles
 *   • Avatar: gradient circle with initials (indigo→violet gradient)
 *   • Branch tags: color-coded pill badges with map-pin icon
 *   • Quick Fill: primary violet gradient button
 *   • Copy: ghost icon button
 *   • Skeleton loaders while fetching
 *   • Fade-in-up animation with index stagger on mount
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { env } from "@/config/env";

const SERVER_URL = env.serverUrl;

// ─── Branch color map ─────────────────────────────────────────────────────────

const BRANCH_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Haridwar:  { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A", dot: "#F59E0B" },
  Delhi:     { bg: "#F5F3FF", text: "#5B21B6", border: "#DDD6FE", dot: "#7C3AED" },
  Hyderabad: { bg: "#FDF2F8", text: "#9D174D", border: "#FBCFE8", dot: "#EC4899" },
  Gurgaon:   { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", dot: "#3B82F6" },
};

function branchStyle(branch: string | null) {
  if (!branch) return null;
  return BRANCH_STYLES[branch] ?? { bg: "#F8FAFC", text: "#475569", border: "#E2E8F0", dot: "#94A3B8" };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogEntry {
  id:              string;
  created_at:      string;
  template_type:   "quick" | "image" | null;
  message_content: string | null;
  image_url:       string | null;
  customer_name:   string | null;
  customer_phone:  string | null;
  used_number:     string | null;
  branch:          string | null;
}

interface RecentLogsSidebarProps {
  refreshKey?: number;
  onQuickFill?: (message: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, type }: { name: string | null; type: "quick" | "image" | null }) {
  const text = initials(name);
  const bg = type === "image"
    ? "linear-gradient(135deg, #1E1B4B 0%, #2563EB 100%)"
    : "linear-gradient(135deg, #1E1B4B 0%, #7C3AED 100%)";
  return (
    <div
      className="flex items-center justify-center rounded-full flex-shrink-0 text-[11px] font-bold text-white select-none"
      style={{ width: 30, height: 30, background: bg, boxShadow: "0 2px 8px rgba(124,58,237,0.25)" }}
    >
      {text}
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard({ isLast }: { isLast: boolean }) {
  return (
    <div className="flex gap-3">
      {/* Timeline column */}
      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 30 }}>
        <div className="w-7 h-7 rounded-full animate-pulse" style={{ background: "#E2E8F0" }} />
        {!isLast && <div className="flex-1 w-px mt-2" style={{ background: "#F1F5F9", minHeight: 40 }} />}
      </div>
      {/* Content */}
      <div className="flex-1 pb-4 animate-pulse">
        <div className="flex items-center justify-between mb-2">
          <div className="h-3 w-24 rounded" style={{ background: "#E2E8F0" }} />
          <div className="h-3 w-10 rounded" style={{ background: "#F1F5F9" }} />
        </div>
        <div className="h-2.5 w-full rounded mb-1.5" style={{ background: "#F1F5F9" }} />
        <div className="h-2.5 w-3/4 rounded" style={{ background: "#F8FAFC" }} />
        <div className="flex gap-2 mt-2">
          <div className="h-5 w-16 rounded-full" style={{ background: "#F1F5F9" }} />
          <div className="h-5 w-20 rounded-lg" style={{ background: "#F1F5F9" }} />
        </div>
      </div>
    </div>
  );
}

// ─── Log card ─────────────────────────────────────────────────────────────────

function LogCard({
  log,
  index,
  isLast,
  copiedId,
  filledId,
  onCopy,
  onQuickFill,
}: {
  log:         LogEntry;
  index:       number;
  isLast:      boolean;
  copiedId:    string | null;
  filledId:    string | null;
  onCopy:      (id: string, text: string) => void;
  onQuickFill: ((msg: string) => void) | undefined;
}) {
  const isImage  = log.template_type === "image";
  const copyText = log.message_content || log.image_url || "";
  const bs       = branchStyle(log.branch);
  const isCopied = copiedId === log.id;
  const isFilled = filledId === log.id;

  return (
    <div
      className="flex gap-3"
      style={{
        animation: `fadeInUp 0.3s ease both`,
        animationDelay: `${index * 50}ms`,
      }}
    >
      {/* ── Timeline column ──────────────────────────────────────────── */}
      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 30 }}>
        <Avatar name={log.customer_name} type={log.template_type} />
        {!isLast && (
          <div
            className="flex-1 w-px mt-1.5"
            style={{
              background: "linear-gradient(to bottom, #E2E8F0 0%, #F1F5F9 100%)",
              minHeight: 32,
            }}
          />
        )}
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className={`flex-1 min-w-0 ${isLast ? "pb-2" : "pb-4"}`}>
        {/* Top row */}
        <div className="flex items-start justify-between gap-1 mb-1">
          <p
            className="text-[12.5px] font-semibold truncate"
            style={{ color: "#1E293B", letterSpacing: "-0.01em" }}
          >
            {log.customer_name || "Unknown Customer"}
          </p>
          <span className="text-[10px] flex-shrink-0 whitespace-nowrap mt-0.5" style={{ color: "#94A3B8" }}>
            {relativeTime(log.created_at)}
          </span>
        </div>

        {/* Message preview */}
        {log.message_content && (
          <p
            className="text-[11.5px] mb-2 leading-relaxed"
            style={{
              color:           "#64748B",
              display:         "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as const,
              overflow:        "hidden",
            }}
          >
            {log.message_content}
          </p>
        )}
        {isImage && !log.message_content && (
          <p className="text-[11px] mb-2 italic" style={{ color: "#94A3B8" }}>
            🖼 Image message
          </p>
        )}

        {/* Badges + actions row */}
        <div className="flex items-center flex-wrap gap-1.5">
          {/* Branch tag */}
          {bs && log.branch && (
            <span
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: bs.bg, color: bs.text, border: `1px solid ${bs.border}` }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: bs.dot }}
              />
              {log.branch}
            </span>
          )}

          {/* Type tag */}
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: isImage ? "#EFF6FF" : "#F5F3FF",
              color:      isImage ? "#1D4ED8" : "#5B21B6",
              border:     `1px solid ${isImage ? "#BFDBFE" : "#DDD6FE"}`,
            }}
          >
            {isImage ? "🖼 Image" : "💬 Quick"}
          </span>

          {/* Quick Fill button */}
          {log.message_content && onQuickFill && (
            <button
              type="button"
              onClick={() => onQuickFill(log.message_content!)}
              className="flex items-center gap-1 rounded-lg text-[10px] font-semibold border-0 cursor-pointer transition-all duration-150"
              style={{
                padding:    "3px 8px",
                background: isFilled
                  ? "linear-gradient(135deg, #059669, #047857)"
                  : "linear-gradient(135deg, #1E1B4B, #7C3AED)",
                color:      "#FFFFFF",
                boxShadow:  isFilled
                  ? "0 1px 6px rgba(5,150,105,0.35)"
                  : "0 1px 6px rgba(124,58,237,0.30)",
              }}
              onMouseEnter={(e) => {
                if (!isFilled) e.currentTarget.style.boxShadow = "0 2px 12px rgba(124,58,237,0.45)";
              }}
              onMouseLeave={(e) => {
                if (!isFilled) e.currentTarget.style.boxShadow = "0 1px 6px rgba(124,58,237,0.30)";
              }}
            >
              {isFilled ? (
                <>
                  <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Filled!
                </>
              ) : (
                <>
                  <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Quick Fill
                </>
              )}
            </button>
          )}

          {/* Copy icon button */}
          {copyText && (
            <button
              type="button"
              onClick={() => onCopy(log.id, copyText)}
              title="Copy to clipboard"
              className="flex items-center justify-center rounded-lg border-0 cursor-pointer transition-all duration-150"
              style={{
                width:      26,
                height:     26,
                background: isCopied ? "#F0FDF4" : "#F8FAFC",
                border:     `1px solid ${isCopied ? "#BBF7D0" : "#E2E8F0"}`,
                color:      isCopied ? "#059669" : "#94A3B8",
              }}
              onMouseEnter={(e) => {
                if (!isCopied) {
                  e.currentTarget.style.background  = "#F5F3FF";
                  e.currentTarget.style.borderColor  = "#DDD6FE";
                  e.currentTarget.style.color        = "#7C3AED";
                }
              }}
              onMouseLeave={(e) => {
                if (!isCopied) {
                  e.currentTarget.style.background  = "#F8FAFC";
                  e.currentTarget.style.borderColor  = "#E2E8F0";
                  e.currentTarget.style.color        = "#94A3B8";
                }
              }}
            >
              {isCopied ? (
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RecentLogsSidebar({ refreshKey = 0, onQuickFill }: RecentLogsSidebarProps) {
  const [logs,     setLogs]     = useState<LogEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filledId, setFilledId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token    = data.session?.access_token ?? "";
      const res      = await fetch(`${SERVER_URL}/recent-logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) setLogs(json.logs ?? []);
    } catch (err) {
      console.error("[RecentLogs] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchLogs();
  }, [fetchLogs, refreshKey]);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* no-op */ }
  };

  const handleQuickFill = (id: string, msg: string) => {
    onQuickFill?.(msg);
    setFilledId(id);
    setTimeout(() => setFilledId(null), 2500);
  };

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{ background: "#FFFFFF" }}
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-4 pt-4 pb-3"
        style={{ borderBottom: "1.5px solid #F1F5F9" }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center rounded-lg"
              style={{
                width: 30, height: 30,
                background: "linear-gradient(135deg, #EDE9FE, #DDD6FE)",
              }}
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none"
                stroke="#7C3AED" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div>
              <h3
                className="text-sm font-semibold leading-none"
                style={{ color: "#1E293B", letterSpacing: "-0.01em" }}
              >
                Recent Activity
              </h3>
              <p className="text-[10px] mt-0.5" style={{ color: "#94A3B8" }}>
                Last {logs.length} sends
              </p>
            </div>
          </div>
          {/* Count badge */}
          <span
            className="text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "#F5F3FF", color: "#7C3AED", border: "1px solid #DDD6FE" }}
          >
            {loading ? "…" : logs.length}
          </span>
        </div>

        {/* Quick Fill hint */}
        {!loading && logs.some((l) => l.message_content) && onQuickFill && (
          <div
            className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg"
            style={{ background: "#FAFAFA", border: "1px solid #F1F5F9" }}
          >
            <svg width={9} height={9} viewBox="0 0 24 24" fill="none"
              stroke="#94A3B8" strokeWidth={2.5} strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-[10px]" style={{ color: "#94A3B8" }}>
              Tap <strong style={{ color: "#7C3AED" }}>Quick Fill</strong> to reuse a message
            </span>
          </div>
        )}
      </div>

      {/* ── Timeline Feed ─────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ minHeight: 0, scrollbarWidth: "thin", scrollbarColor: "#E2E8F0 transparent" }}
      >
        {loading ? (
          <div className="flex flex-col gap-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} isLast={i === 4} />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full select-none py-8">
            <div
              className="flex items-center justify-center rounded-2xl mb-3"
              style={{
                width: 56, height: 56,
                background: "linear-gradient(135deg, #EDE9FE, #F5F3FF)",
                border: "1.5px solid #DDD6FE",
              }}
            >
              <span style={{ fontSize: 22 }}>📭</span>
            </div>
            <p className="text-sm font-semibold" style={{ color: "#64748B" }}>
              No activity yet
            </p>
            <p className="text-[11px] mt-1 text-center px-4" style={{ color: "#94A3B8" }}>
              Your recent sends will appear here as a timeline
            </p>
          </div>
        ) : (
          <div>
            {logs.map((log, i) => (
              <LogCard
                key={log.id}
                log={log}
                index={i}
                isLast={i === logs.length - 1}
                copiedId={copiedId}
                filledId={filledId}
                onCopy={handleCopy}
                onQuickFill={
                  log.message_content
                    ? (msg) => handleQuickFill(log.id, msg)
                    : undefined
                }
              />
            ))}
          </div>
        )}

        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0);    }
          }
          .overflow-y-auto::-webkit-scrollbar { width: 4px; }
          .overflow-y-auto::-webkit-scrollbar-track { background: transparent; }
          .overflow-y-auto::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 4px; }
          .overflow-y-auto::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
        `}</style>
      </div>
    </div>
  );
}
