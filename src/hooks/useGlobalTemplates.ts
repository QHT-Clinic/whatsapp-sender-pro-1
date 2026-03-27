/**
 * useGlobalTemplates — CRUD hook for the global_templates table.
 *
 * LOCAL-ONLY FEATURE FLAG: this hook targets global_templates.
 * Production still uses agent_custom_templates via the existing components.
 * Do NOT import this hook from WhatsAppSender, QuickTemplates, or ImageTemplates
 * until the explicit migration sprint.
 *
 * Security: agent_id is ALWAYS derived from the authenticated session server-side
 * (Supabase RLS) and client-side (we call supabase.auth.getUser() before every
 * mutation). The caller never passes agent_id manually.
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/app/lib/supabaseClient";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface GlobalTemplate {
  id: string;
  agent_id: string;
  template_type: "quick" | "image";
  name: string;
  content: string | null;
  media_url: string | null;
  branch: string | null;
  language: "en" | "hinglish";
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateInput {
  template_type: "quick" | "image";
  name: string;
  content?: string;
  media_url?: string;
  language: "en" | "hinglish";
  is_active?: boolean;
}

export interface UseGlobalTemplatesReturn {
  templates: GlobalTemplate[];
  quickTemplates: GlobalTemplate[];   // type='quick' + is_active=true
  imageTemplates: GlobalTemplate[];   // type='image' + is_active=true
  loading: boolean;
  error: string | null;
  refetch: () => void;
  addTemplate: (data: CreateTemplateInput) => Promise<boolean>;
  updateTemplate: (id: string, data: Partial<CreateTemplateInput>) => Promise<boolean>;
  deleteTemplate: (id: string) => Promise<boolean>;
  toggleActive: (id: string, is_active: boolean) => Promise<boolean>;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function getAuthUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGlobalTemplates(): UseGlobalTemplatesReturn {
  const [templates, setTemplates] = useState<GlobalTemplate[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    const user = await getAuthUser();
    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const { data, error: fetchErr } = await supabase
      .from("global_templates")
      .select("*")
      .eq("agent_id", user.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (fetchErr) {
      setError(fetchErr.message);
    } else {
      setTemplates((data as GlobalTemplate[]) ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // ── Add ────────────────────────────────────────────────────────────────────

  const addTemplate = useCallback(
    async (input: CreateTemplateInput): Promise<boolean> => {
      setLoading(true);

      const user = await getAuthUser();
      if (!user) {
        toast.error("Not authenticated");
        setLoading(false);
        return false;
      }

      const { error: insertErr } = await supabase.from("global_templates").insert({
        ...input,
        agent_id:   user.id,
        created_by: user.id,
      });

      if (insertErr) {
        toast.error(`Failed to add template: ${insertErr.message}`);
        setLoading(false);
        return false;
      }

      toast.success("Template added");
      await fetchTemplates();
      return true;
    },
    [fetchTemplates]
  );

  // ── Update ─────────────────────────────────────────────────────────────────

  const updateTemplate = useCallback(
    async (id: string, input: Partial<CreateTemplateInput>): Promise<boolean> => {
      setLoading(true);

      const user = await getAuthUser();
      if (!user) {
        toast.error("Not authenticated");
        setLoading(false);
        return false;
      }

      const { error: updateErr } = await supabase
        .from("global_templates")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("agent_id", user.id);   // ownership check on update

      if (updateErr) {
        toast.error(`Failed to update template: ${updateErr.message}`);
        setLoading(false);
        return false;
      }

      toast.success("Template updated");
      await fetchTemplates();
      return true;
    },
    [fetchTemplates]
  );

  // ── Delete ─────────────────────────────────────────────────────────────────

  const deleteTemplate = useCallback(
    async (id: string): Promise<boolean> => {
      setLoading(true);

      const user = await getAuthUser();
      if (!user) {
        toast.error("Not authenticated");
        setLoading(false);
        return false;
      }

      const { error: deleteErr } = await supabase
        .from("global_templates")
        .delete()
        .eq("id", id)
        .eq("agent_id", user.id);   // ownership check on delete

      if (deleteErr) {
        toast.error(`Failed to delete template: ${deleteErr.message}`);
        setLoading(false);
        return false;
      }

      toast.success("Template deleted");
      await fetchTemplates();
      return true;
    },
    [fetchTemplates]
  );

  // ── Toggle active ──────────────────────────────────────────────────────────

  const toggleActive = useCallback(
    async (id: string, is_active: boolean): Promise<boolean> => {
      const user = await getAuthUser();
      if (!user) return false;

      const { error: toggleErr } = await supabase
        .from("global_templates")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("agent_id", user.id);

      if (toggleErr) {
        toast.error(`Failed to update template: ${toggleErr.message}`);
        return false;
      }

      // Optimistic local update avoids a full refetch for a simple toggle
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, is_active } : t))
      );
      return true;
    },
    []
  );

  // ── Derived lists ──────────────────────────────────────────────────────────

  const quickTemplates = templates.filter(
    (t) => t.template_type === "quick" && t.is_active
  );
  const imageTemplates = templates.filter(
    (t) => t.template_type === "image" && t.is_active
  );

  return {
    templates,
    quickTemplates,
    imageTemplates,
    loading,
    error,
    refetch: fetchTemplates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    toggleActive,
  };
}
