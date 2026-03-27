/**
 * useQuickTemplates — CRUD hook for agent-owned quick message templates.
 *
 * Reads/writes global_templates WHERE template_type = 'quick'.
 * Security: agent_id is ALWAYS derived from supabase.auth.getUser().
 * The caller never passes agent_id as a prop or parameter.
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/app/lib/supabaseClient";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface AgentQuickTemplate {
  id: string;
  agent_id: string;
  name: string;
  content: string;          // message body
  language: "en" | "hinglish";
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface CreateQuickTemplateInput {
  name: string;
  content: string;
  language: "en" | "hinglish";
}

export interface UseQuickTemplatesReturn {
  englishTemplates: AgentQuickTemplate[];    // language='en'  + is_active=true
  hinglishTemplates: AgentQuickTemplate[];   // language='hinglish' + is_active=true
  allTemplates: AgentQuickTemplate[];        // all, unfiltered — for management UI
  loading: boolean;
  error: string | null;
  addTemplate: (input: CreateQuickTemplateInput) => Promise<boolean>;
  updateTemplate: (id: string, input: Partial<CreateQuickTemplateInput>) => Promise<boolean>;
  deleteTemplate: (id: string) => Promise<boolean>;
  refetch: () => void;
}

// ─── Raw DB row ───────────────────────────────────────────────────────────────

interface RawQuickRow {
  id: string;
  agent_id: string;
  name: string;
  content: string | null;
  language: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getAuthUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useQuickTemplates(): UseQuickTemplatesReturn {
  const [allTemplates, setAllTemplates] = useState<AgentQuickTemplate[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────

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
      .select("id, agent_id, name, content, language, is_active, sort_order, created_at")
      .eq("agent_id", user.id)
      .eq("template_type", "quick")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (fetchErr) {
      setError(fetchErr.message);
    } else {
      const mapped: AgentQuickTemplate[] = ((data ?? []) as RawQuickRow[]).map((row) => ({
        id:         row.id,
        agent_id:   row.agent_id,
        name:       row.name,
        content:    row.content ?? "",
        language:   row.language as "en" | "hinglish",
        is_active:  row.is_active,
        sort_order: row.sort_order,
        created_at: row.created_at,
      }));
      setAllTemplates(mapped);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // ── Add ──────────────────────────────────────────────────────────────────

  const addTemplate = useCallback(
    async (input: CreateQuickTemplateInput): Promise<boolean> => {
      const user = await getAuthUser();
      if (!user) {
        toast.error("Not authenticated");
        return false;
      }

      const { error: insertErr } = await supabase.from("global_templates").insert({
        agent_id:      user.id,
        template_type: "quick",
        name:          input.name,
        content:       input.content,
        language:      input.language,
        is_active:     true,
        created_by:    user.id,
      });

      if (insertErr) {
        toast.error(`Failed to add template: ${insertErr.message}`);
        return false;
      }

      toast.success("Template added!");
      await fetchTemplates();
      return true;
    },
    [fetchTemplates]
  );

  // ── Update ───────────────────────────────────────────────────────────────

  const updateTemplate = useCallback(
    async (id: string, input: Partial<CreateQuickTemplateInput>): Promise<boolean> => {
      const user = await getAuthUser();
      if (!user) {
        toast.error("Not authenticated");
        return false;
      }

      const { error: updateErr } = await supabase
        .from("global_templates")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("agent_id", user.id);

      if (updateErr) {
        toast.error(`Failed to update template: ${updateErr.message}`);
        return false;
      }

      toast.success("Template updated");
      await fetchTemplates();
      return true;
    },
    [fetchTemplates]
  );

  // ── Delete ───────────────────────────────────────────────────────────────

  const deleteTemplate = useCallback(
    async (id: string): Promise<boolean> => {
      const user = await getAuthUser();
      if (!user) {
        toast.error("Not authenticated");
        return false;
      }

      const { error: deleteErr } = await supabase
        .from("global_templates")
        .delete()
        .eq("id", id)
        .eq("agent_id", user.id);

      if (deleteErr) {
        toast.error(`Failed to delete template: ${deleteErr.message}`);
        return false;
      }

      toast.success("Template deleted");
      await fetchTemplates();
      return true;
    },
    [fetchTemplates]
  );

  // ── Derived lists ────────────────────────────────────────────────────────

  const englishTemplates  = allTemplates.filter((t) => t.language === "en"       && t.is_active);
  const hinglishTemplates = allTemplates.filter((t) => t.language === "hinglish" && t.is_active);

  return {
    englishTemplates,
    hinglishTemplates,
    allTemplates,
    loading,
    error,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    refetch: fetchTemplates,
  };
}
