/**
 * TemplateTestPage — LOCAL TESTING ONLY
 *
 * Mounts GlobalTemplateManager so we can verify the global_templates CRUD
 * flow end-to-end before touching any production component.
 *
 * This page and its /template-test route will be REMOVED once the migration
 * to production (WhatsAppSender + QuickTemplates + ImageTemplates) is complete.
 */

import { GlobalTemplateManager } from "@/components/GlobalTemplateManager";

export default function TemplateTestPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F8FAFC",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 20px",
      }}
    >
      {/* Test banner */}
      <div
        style={{
          width: "100%",
          maxWidth: 700,
          marginBottom: 20,
          padding: "10px 16px",
          borderRadius: 8,
          background: "#FEF9C3",
          border: "1px solid #FDE047",
          color: "#713F12",
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontWeight: 600 }}>⚠ Local Testing Only</span>
        <span>— This page is for local testing only and will be removed before production migration.</span>
      </div>

      {/* Page header */}
      <div
        style={{
          width: "100%",
          maxWidth: 700,
          marginBottom: 16,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            color: "#1E293B",
          }}
        >
          Template Manager — Local Test
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: "#64748B" }}>
          Testing <code>global_templates</code> table via <code>useGlobalTemplates</code> hook.
        </p>
      </div>

      {/* Component under test */}
      <div style={{ width: "100%", maxWidth: 700 }}>
        <GlobalTemplateManager />
      </div>
    </div>
  );
}
