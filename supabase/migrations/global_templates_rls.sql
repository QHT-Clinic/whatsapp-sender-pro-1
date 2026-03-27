-- ─────────────────────────────────────────────────────────────────────────────
-- RLS policies for public.global_templates
--
-- Run this in the Supabase SQL editor (or as a migration).
-- IMPORTANT: only affects global_templates — does NOT touch agent_custom_templates.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Enable RLS on the table
ALTER TABLE public.global_templates ENABLE ROW LEVEL SECURITY;

-- ─── SELECT ──────────────────────────────────────────────────────────────────
-- Each authenticated user sees ONLY their own rows.

CREATE POLICY "global_templates: select own"
  ON public.global_templates
  FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid());

-- ─── INSERT ──────────────────────────────────────────────────────────────────
-- Authenticated users can only insert rows where agent_id = their own uid.
-- This prevents a client from spoofing another agent's id.

CREATE POLICY "global_templates: insert own"
  ON public.global_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (agent_id = auth.uid());

-- ─── UPDATE ──────────────────────────────────────────────────────────────────
-- Users can only update their own rows, and cannot change agent_id to
-- someone else's uid (double-guard via WITH CHECK).

CREATE POLICY "global_templates: update own"
  ON public.global_templates
  FOR UPDATE
  TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- ─── DELETE ──────────────────────────────────────────────────────────────────
-- Users can only delete their own rows.

CREATE POLICY "global_templates: delete own"
  ON public.global_templates
  FOR DELETE
  TO authenticated
  USING (agent_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION — run these queries to confirm policies are active:
--
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'global_templates';
--
-- Expected: 4 rows (select, insert, update, delete), all with agent_id = auth.uid()
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- OPTIONAL: updated_at trigger (keeps updated_at in sync automatically)
-- Skip if you already have a generic updated_at trigger on this table.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER global_templates_updated_at
  BEFORE UPDATE ON public.global_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
