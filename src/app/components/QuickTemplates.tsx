/**
 * QuickTemplates v4.0 — B2B SaaS design with:
 *   • English / Hinglish pill toggle with sliding indicator
 *   • Template rows: left-accent border on hover, scale(1.01) lift, shadow
 *   • Selected row highlighted in violet tint
 *   • Clean Inter typography, #1E293B / #64748B text
 */

import { useState } from "react";

// ─── Template data ────────────────────────────────────────────────────────────

const GLOBAL_ENGLISH = [
  "When will you reach at clinic?",
  "Your appointment is scheduled for tomorrow. (— Branch) Kindly be on time.",
  `We called you but your number was not available. Please message us to get a callback.
Our working hours: 9:00 AM – 7:00 PM

Are you coming on ——— for Hair Transplant?

If YES, kindly fill:
Pt. Name –
Clinic Branch –
Pt. Address –
Arrival Timing –
Payment Mode –
Age – Occupation –
Medical History / Medicine –
Alcohol / Smoking –
Return Ticket –
Blood Report –

If you have already filled/informed these details, kindly ignore this message.`,
  "Are you free now for consultation?",
  "Kindly share your BP / Sugar reading 24 hrs before your appointment date.",
  "Is your EMI approved or not?",
  "Kindly confirm your pickup timing for tomorrow and share your ticket as well. (Are you coming alone or with someone?)",
  "Kindly confirm your arrival timing so we can arrange your hotel stay. (Are you coming alone or with someone?)",
];

const GLOBAL_HINGLISH = [
  "Hi, aapka graft estimate ready hai. Kya baat kar sakte hain?",
  "Hello, hair transplant ke liye kya abhi call kar sakta hoon?",
  "Please free consultation ke liye head photos share karein.",
  "Aapka personalized hair plan ready ho gaya hai!",
  "QHT se namaste! Transplant ko lekar koi doubt hai?",
  "Hi, aaj aapke hair design ke liye slot available hai.",
  "Hello, kuch help chahiye ho toh batayein — hum yahan hain.",
  "Hi, report verify ho gayi hai. OT kab ki fix karein?",
];

const BRANCH_MAP: Record<string, { english: string[]; hinglish: string[] }> = {};

function resolveTemplates(branch: string | null | undefined) {
  if (branch && branch !== "All" && BRANCH_MAP[branch]) return BRANCH_MAP[branch];
  return { english: GLOBAL_ENGLISH, hinglish: GLOBAL_HINGLISH };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-1.5 p-1">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="rounded-xl animate-pulse"
          style={{
            height:     i % 3 === 0 ? 52 : 40,
            background: "linear-gradient(90deg,#f1f5f9 25%,#e8edf3 50%,#f1f5f9 75%)",
            backgroundSize: "200% 100%",
            animation: "skShimmer 1.5s infinite",
          }}
        />
      ))}
      <style>{`@keyframes skShimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuickTemplatesProps {
  onSelectTemplate: (message: string) => void;
  userBranch?:      string | null;
  fillHeight?:      boolean;
  loading?:         boolean;
  peekLabel?:       string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuickTemplates({
  onSelectTemplate,
  userBranch,
  fillHeight  = false,
  loading     = false,
  peekLabel,
}: QuickTemplatesProps) {
  const [activeTab, setActiveTab] = useState<"english" | "hinglish">("english");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const resolved  = resolveTemplates(userBranch);
  const templates = activeTab === "english" ? resolved.english : resolved.hinglish;

  return (
    <div
      className={`w-full ${fillHeight ? "h-full flex flex-col" : ""}`}
      style={{
        background:   "#FFFFFF",
        borderRadius:  20,
        overflow:      "hidden",
        border:       "1.5px solid #E2E8F0",
        boxShadow:    "0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* ── Peek bar ──────────────────────────────────────────────────── */}
      {peekLabel && (
        <div
          className="flex-shrink-0 flex items-center justify-center gap-2 py-2.5 cursor-pointer"
          style={{
            background: "linear-gradient(90deg, #EDE9FE, #F5F3FF)",
            borderBottom: "1.5px solid #DDD6FE",
          }}
        >
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none"
            stroke="#7C3AED" strokeWidth={2.5} strokeLinecap="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
          <span className="text-[11px] font-semibold" style={{ color: "#7C3AED" }}>
            {peekLabel}
          </span>
        </div>
      )}

      {/* ── Header — 72px zone ────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-4 pt-4 pb-0"
        style={{ minHeight: peekLabel ? "auto" : 72, display: "flex", flexDirection: "column", justifyContent: "center" }}
      >
        <div className="flex items-center justify-between mb-3">
          {/* Title */}
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center rounded-lg"
              style={{ width: 30, height: 30, background: "linear-gradient(135deg, #EDE9FE, #DDD6FE)" }}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                stroke="#7C3AED" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-none" style={{ color: "#1E293B", letterSpacing: "-0.01em" }}>
                Quick Templates
              </h2>
              <p className="text-[10px] mt-0.5" style={{ color: "#94A3B8" }}>
                {templates.length} message{templates.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Pill toggle: English / Hinglish */}
          <div
            className="relative flex items-center p-0.5 rounded-xl"
            style={{ background: "#F1F5F9", border: "1px solid #E2E8F0" }}
          >
            {/* Sliding pill */}
            <div
              className="absolute rounded-lg transition-transform duration-200 ease-out"
              style={{
                top:       2,
                bottom:    2,
                width:     "calc(50% - 2px)",
                background: "#FFFFFF",
                boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
                transform:  activeTab === "english"
                  ? "translateX(2px)"
                  : "translateX(calc(100% + 2px))",
              }}
            />
            {(["english", "hinglish"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className="relative z-10 flex items-center gap-1 text-[11px] font-semibold rounded-lg border-0 cursor-pointer transition-colors duration-150"
                style={{
                  padding: "5px 10px",
                  background: "transparent",
                  color: activeTab === tab ? "#1E293B" : "#94A3B8",
                  whiteSpace: "nowrap",
                }}
              >
                {tab === "english" ? "🇬🇧 EN" : "🇮🇳 HI"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Template List ─────────────────────────────────────────────── */}
      <div
        className={`${fillHeight ? "flex-1 min-h-0" : ""} overflow-y-auto px-3 pb-3 pt-2`}
        style={{ scrollbarWidth: "thin", scrollbarColor: "#E2E8F0 transparent" }}
      >
        {loading ? <SkeletonRows /> : (
          <div className="flex flex-col gap-1">
            {templates.map((tpl, i) => {
              const isHovered = hoveredIdx === i;
              return (
                <button
                  key={`${activeTab}-${i}`}
                  type="button"
                  onClick={() => onSelectTemplate(tpl)}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="text-left text-[12.5px] rounded-xl border-0 cursor-pointer transition-all duration-200"
                  style={{
                    padding:    "10px 14px 10px 16px",
                    lineHeight: 1.65,
                    background:  isHovered ? "#F5F3FF" : "#FAFAFA",
                    color:       isHovered ? "#5B21B6" : "#334155",
                    border:      isHovered
                      ? "1.5px solid #DDD6FE"
                      : "1.5px solid transparent",
                    borderLeft:  isHovered ? "3px solid #7C3AED" : "3px solid transparent",
                    transform:   isHovered ? "scale(1.005) translateX(2px)" : "scale(1) translateX(0)",
                    boxShadow:   isHovered
                      ? "0 2px 12px rgba(124,58,237,0.10)"
                      : "none",
                    fontFamily:  "Inter, sans-serif",
                  }}
                >
                  {tpl}
                </button>
              );
            })}
          </div>
        )}

        <style>{`
          .overflow-y-auto::-webkit-scrollbar { width: 4px; }
          .overflow-y-auto::-webkit-scrollbar-track { background: transparent; }
          .overflow-y-auto::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 4px; }
          .overflow-y-auto::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
        `}</style>
      </div>
    </div>
  );
}
