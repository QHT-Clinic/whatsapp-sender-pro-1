/**
 * ImageTemplates v4.0 — B2B SaaS design with:
 *   • Left-border accent on hover (blue tint)
 *   • Selected row: violet tint + checkmark
 *   • Clean Inter typography
 *   • Skeleton loaders
 */

interface ImageTemplate {
  name: string;
  url:  string;
  tag?: string;
}

interface ImageTemplatesProps {
  onSelectImage:    (url: string) => void;
  selectedImageUrl: string | null;
  userBranch?:      string | null;
  fillHeight?:      boolean;
  loading?:         boolean;
  peekLabel?:       string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const GLOBAL_IMAGES: ImageTemplate[] = [
  { name: "Before / After Results",     url: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&h=600&fit=crop", tag: "Results" },
  { name: "Clinic Facility Tour",       url: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&h=600&fit=crop", tag: "Facility" },
  { name: "Hair Transplant Process",    url: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=600&fit=crop", tag: "Process" },
  { name: "Doctor Consultation",        url: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=800&h=600&fit=crop", tag: "Consult" },
  { name: "Advanced Equipment",         url: "https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=800&h=600&fit=crop", tag: "Tech" },
  { name: "Patient Success Story",      url: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=800&h=600&fit=crop", tag: "Success" },
  { name: "Modern Clinic Interior",     url: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&h=600&fit=crop", tag: "Clinic" },
  { name: "Hair Care Tips",             url: "https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800&h=600&fit=crop", tag: "Tips" },
];

const BRANCH_IMAGE_MAP: Record<string, ImageTemplate[]> = {};

function resolveImages(branch: string | null | undefined): ImageTemplate[] {
  if (branch && branch !== "All" && BRANCH_IMAGE_MAP[branch]) return BRANCH_IMAGE_MAP[branch];
  return GLOBAL_IMAGES;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-1.5 p-1">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div
          key={i}
          className="rounded-xl flex items-center gap-3 px-4 animate-pulse"
          style={{ height: 44, background: "#F8FAFC", border: "1.5px solid #F1F5F9" }}
        >
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#E2E8F0" }} />
          <div className="flex-1 h-3 rounded" style={{ background: "#E2E8F0" }} />
          <div className="w-12 h-4 rounded-full" style={{ background: "#F1F5F9" }} />
        </div>
      ))}
    </div>
  );
}

// ─── Tag badge ─────────────────────────────────────────────────────────────────

function TagBadge({ tag }: { tag: string }) {
  return (
    <span
      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
      style={{
        background:  "#F0F9FF",
        color:       "#0369A1",
        border:      "1px solid #BAE6FD",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {tag}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImageTemplates({
  onSelectImage,
  selectedImageUrl,
  userBranch,
  fillHeight = false,
  loading    = false,
  peekLabel,
}: ImageTemplatesProps) {
  const images = resolveImages(userBranch);

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
            background:   "linear-gradient(90deg, #EFF6FF, #DBEAFE)",
            borderBottom: "1.5px solid #BFDBFE",
          }}
        >
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none"
            stroke="#2563EB" strokeWidth={2.5} strokeLinecap="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
          <span className="text-[11px] font-semibold" style={{ color: "#2563EB" }}>
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
              style={{ width: 30, height: 30, background: "linear-gradient(135deg, #DBEAFE, #BFDBFE)" }}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                stroke="#2563EB" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-none" style={{ color: "#1E293B", letterSpacing: "-0.01em" }}>
                Image Templates
              </h2>
              <p className="text-[10px] mt-0.5" style={{ color: "#94A3B8" }}>
                {images.length} image{images.length !== 1 ? "s" : ""} available
              </p>
            </div>
          </div>

          {/* Selected badge */}
          {selectedImageUrl ? (
            <div
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
              style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0" }}
            >
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none"
                stroke="#059669" strokeWidth={2.5} strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-[10px] font-semibold" style={{ color: "#059669" }}>Selected</span>
            </div>
          ) : (
            <span
              className="text-[11px] rounded-full px-2.5 py-1"
              style={{ background: "#F0F9FF", color: "#0369A1", border: "1px solid #BAE6FD", fontWeight: 600 }}
            >
              {images.length}
            </span>
          )}
        </div>

        {/* Info hint */}
        <div
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 mb-3"
          style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}
        >
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none"
            stroke="#94A3B8" strokeWidth={2.5} strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="text-[11px]" style={{ color: "#94A3B8" }}>
            Click any image to attach to your message
          </span>
        </div>
      </div>

      {/* ── Image List ─────────────────────────────────────────────────── */}
      <div
        className={`${fillHeight ? "flex-1 min-h-0" : ""} overflow-y-auto px-3 pb-3`}
        style={{ scrollbarWidth: "thin", scrollbarColor: "#E2E8F0 transparent" }}
      >
        {loading ? <SkeletonRows /> : (
          <div className="flex flex-col gap-1">
            {images.map((img) => {
              const isSelected = selectedImageUrl === img.url;
              return (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => onSelectImage(img.url)}
                  className="text-left text-[12.5px] rounded-xl border-0 cursor-pointer transition-all duration-200 flex items-center gap-3 group"
                  style={{
                    padding:    "10px 14px 10px 16px",
                    background: isSelected ? "#F5F3FF" : "#FAFAFA",
                    color:      isSelected ? "#5B21B6" : "#334155",
                    border:     isSelected ? "1.5px solid #DDD6FE" : "1.5px solid transparent",
                    borderLeft: isSelected ? "3px solid #7C3AED" : "3px solid transparent",
                    fontWeight: isSelected ? 600 : 400,
                    boxShadow:  isSelected ? "0 2px 12px rgba(124,58,237,0.10)" : "none",
                    fontFamily: "Inter, sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background  = "#F0F9FF";
                      e.currentTarget.style.color        = "#0369A1";
                      e.currentTarget.style.border       = "1.5px solid #BAE6FD";
                      e.currentTarget.style.borderLeft   = "3px solid #2563EB";
                      e.currentTarget.style.transform    = "scale(1.005) translateX(2px)";
                      e.currentTarget.style.boxShadow    = "0 2px 12px rgba(37,99,235,0.08)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background  = "#FAFAFA";
                      e.currentTarget.style.color        = "#334155";
                      e.currentTarget.style.border       = "1.5px solid transparent";
                      e.currentTarget.style.borderLeft   = "3px solid transparent";
                      e.currentTarget.style.transform    = "scale(1) translateX(0)";
                      e.currentTarget.style.boxShadow    = "none";
                    }
                  }}
                >
                  {/* Color dot */}
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0 transition-all duration-200"
                    style={{
                      background: isSelected
                        ? "#7C3AED"
                        : "#CBD5E1",
                      boxShadow: isSelected ? "0 0 6px rgba(124,58,237,0.5)" : "none",
                    }}
                  />
                  <span className="flex-1 font-['Inter',sans-serif]">{img.name}</span>
                  {img.tag && <TagBadge tag={img.tag} />}
                  {isSelected && (
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                      stroke="#7C3AED" strokeWidth={2.5} strokeLinecap="round" className="flex-shrink-0">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
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
