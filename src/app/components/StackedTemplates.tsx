/**
 * StackedTemplates v3.0 — B2B SaaS Card Deck with Pill Tab Switcher
 *
 * Visual design: Clean white cards on soft-gray background
 * Tab switcher: Sliding pill indicator with smooth 200ms ease
 * Card deck: spring-eased physical card stacking (translateY)
 * Both hover-on-peek and clicking tabs switch the active card
 */

import { useState, useRef } from "react";
import type { CSSProperties } from "react";
import { QuickTemplates } from "./QuickTemplates";
import { ImageTemplates } from "./ImageTemplates";

const PEEK_H = 72; // px of inactive card visible at bottom
const EASE   = "cubic-bezier(0.34, 1.08, 0.64, 1)";
const DUR    = "320ms";

interface StackedTemplatesProps {
  onSelectTemplate: (message: string) => void;
  onSelectImage:    (url: string) => void;
  selectedImageUrl: string | null;
  userBranch?:      string | null;
}

export function StackedTemplates({
  onSelectTemplate,
  onSelectImage,
  selectedImageUrl,
  userBranch,
}: StackedTemplatesProps) {
  const [active,   setActive]   = useState<"quick" | "image">("quick");
  const timerRef               = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bringToFront = (card: "quick" | "image") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setActive(card), 80);
  };

  const cardWrapStyle = (card: "quick" | "image"): CSSProperties => {
    const isActive = active === card;
    return {
      position:   "absolute",
      inset:       0,
      zIndex:      isActive ? 20 : 10,
      transform:   isActive
        ? "translateY(0) scale(1)"
        : `translateY(calc(100% - ${PEEK_H}px)) scale(0.992)`,
      transition:  `transform ${DUR} ${EASE}`,
      willChange:  "transform",
    };
  };

  return (
    <div className="h-full flex flex-col gap-3">

      {/* ── Pill Tab Switcher ────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 relative flex items-center p-1 rounded-2xl"
        style={{
          background: "#FFFFFF",
          border:     "1.5px solid #E2E8F0",
          boxShadow:  "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        {/* Sliding pill indicator */}
        <div
          className="absolute rounded-xl transition-transform duration-200 ease-out"
          style={{
            top:       4,
            bottom:    4,
            width:     "calc(50% - 4px)",
            background: "linear-gradient(135deg, #1E1B4B 0%, #7C3AED 100%)",
            boxShadow:  "0 2px 8px rgba(124,58,237,0.35)",
            transform:  active === "quick"
              ? "translateX(4px)"
              : "translateX(calc(100% + 4px))",
          }}
        />

        {(["quick", "image"] as const).map((card) => {
          const isActive = active === card;
          return (
            <button
              key={card}
              type="button"
              onClick={() => setActive(card)}
              className="relative z-10 flex-1 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold border-0 cursor-pointer transition-colors duration-150"
              style={{
                padding: "10px 0",
                color:   isActive ? "#FFFFFF" : "#64748B",
                background: "transparent",
              }}
            >
              {card === "quick" ? (
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              ) : (
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              )}
              <span>{card === "quick" ? "Quick Templates" : "Image Templates"}</span>
              {card === "image" && selectedImageUrl && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: isActive ? "rgba(255,255,255,0.9)" : "#059669" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Card Stack ──────────────────────────────────────────────────── */}
      <div className="flex-1 relative min-h-0 overflow-hidden" style={{ borderRadius: 20 }}>

        {/* Image card — peeks behind Quick by default */}
        <div
          style={cardWrapStyle("image")}
          onMouseEnter={() => { if (active !== "image") bringToFront("image"); }}
        >
          <ImageTemplates
            onSelectImage={onSelectImage}
            selectedImageUrl={selectedImageUrl}
            userBranch={userBranch}
            fillHeight
            peekLabel={active !== "image" ? "↑  Image Templates — hover to bring forward" : undefined}
          />
        </div>

        {/* Quick card — in front by default */}
        <div
          style={cardWrapStyle("quick")}
          onMouseEnter={() => { if (active !== "quick") bringToFront("quick"); }}
        >
          <QuickTemplates
            onSelectTemplate={onSelectTemplate}
            userBranch={userBranch}
            fillHeight
            peekLabel={active !== "quick" ? "↑  Quick Templates — hover to bring forward" : undefined}
          />
        </div>

      </div>
    </div>
  );
}
