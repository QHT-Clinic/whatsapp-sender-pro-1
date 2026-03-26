-- =====================================================
-- QHT CLINIC - COMPLETE SUPABASE DATABASE SETUP
-- v2.0 — Multi-Branch Support
-- =====================================================
-- Run this ENTIRE file in Supabase SQL Editor.
-- It is fully idempotent — safe to run multiple times.
-- All statements use IF NOT EXISTS / ON CONFLICT DO NOTHING.
--
-- TABLE OVERVIEW:
--   public.branches      ← NEW  — clinic branches (Haridwar, Hyderabad, Delhi, Gurgaon)
--   public.profiles      ← UPDATED — now has branch_id FK
--   public.message_logs  ← UPDATED — now has branch_id FK
-- =====================================================


-- =====================================================
-- STEP 1: VERIFY CURRENT TABLE STRUCTURES (before changes)
-- =====================================================

-- Check profiles table (current state)
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Check message_logs table (current state)
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'message_logs'
ORDER BY ordinal_position;


-- =====================================================
-- STEP 2: CREATE BRANCHES TABLE  ← NEW
-- =====================================================
-- Fixed well-known UUIDs are used so agents can be assigned
-- to branches predictably (no random UUIDs on each run).
--
-- Branch UUIDs (memorise / copy these for profile assignment):
--   Haridwar  → a0000000-0001-0000-0000-000000000001
--   Hyderabad → a0000000-0001-0000-0000-000000000002
--   Delhi     → a0000000-0001-0000-0000-000000000003
--   Gurgaon   → a0000000-0001-0000-0000-000000000004
-- =====================================================

CREATE TABLE IF NOT EXISTS public.branches (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL UNIQUE,
  city       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert 4 initial branches (ON CONFLICT DO NOTHING = safe to re-run)
INSERT INTO public.branches (id, name, city) VALUES
  ('a0000000-0001-0000-0000-000000000001', 'QHT Haridwar',  'Haridwar'),
  ('a0000000-0001-0000-0000-000000000002', 'QHT Hyderabad', 'Hyderabad'),
  ('a0000000-0001-0000-0000-000000000003', 'QHT Delhi',     'Delhi'),
  ('a0000000-0001-0000-0000-000000000004', 'QHT Gurgaon',   'Gurgaon')
ON CONFLICT (id) DO NOTHING;

-- Confirm branches were inserted
SELECT id, name, city, created_at FROM public.branches ORDER BY city;


-- =====================================================
-- STEP 3: CREATE / UPDATE PROFILES TABLE
-- =====================================================

-- Create profiles table (if not exists — original schema)
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT,
  role       TEXT        NOT NULL CHECK (role IN ('admin', 'agent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add branch_id column to profiles (nullable — existing rows are unaffected)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND column_name  = 'branch_id'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ profiles.branch_id column added';
  ELSE
    RAISE NOTICE 'ℹ️  profiles.branch_id already exists — skipped';
  END IF;
END $$;


-- =====================================================
-- STEP 4: CREATE / UPDATE MESSAGE_LOGS TABLE
-- =====================================================

-- Create message_logs table (if not exists — original schema)
CREATE TABLE IF NOT EXISTS public.message_logs (
  id              BIGSERIAL   PRIMARY KEY,
  agent_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id         TEXT,
  customer_phone  TEXT        NOT NULL,
  customer_name   TEXT        NOT NULL,
  template_type   TEXT        CHECK (template_type IN ('quick', 'image')),
  message_content TEXT,
  image_url       TEXT,
  used_number     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add used_number column if it doesn't exist (legacy migration guard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'message_logs'
      AND column_name  = 'used_number'
  ) THEN
    ALTER TABLE public.message_logs ADD COLUMN used_number TEXT;
    RAISE NOTICE '✅ message_logs.used_number column added';
  ELSE
    RAISE NOTICE 'ℹ️  message_logs.used_number already exists — skipped';
  END IF;
END $$;

-- Add branch_id column to message_logs (nullable — all existing logs are unaffected)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'message_logs'
      AND column_name  = 'branch_id'
  ) THEN
    ALTER TABLE public.message_logs
      ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ message_logs.branch_id column added';
  ELSE
    RAISE NOTICE 'ℹ️  message_logs.branch_id already exists — skipped';
  END IF;
END $$;


-- =====================================================
-- STEP 5: INDEXES FOR PERFORMANCE
-- =====================================================

-- message_logs indexes
CREATE INDEX IF NOT EXISTS idx_message_logs_agent_id
  ON public.message_logs(agent_id);

CREATE INDEX IF NOT EXISTS idx_message_logs_created_at
  ON public.message_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_logs_branch_id   -- NEW
  ON public.message_logs(branch_id);

-- profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON public.profiles(role);

CREATE INDEX IF NOT EXISTS idx_profiles_branch_id        -- NEW
  ON public.profiles(branch_id);

-- branches indexes
CREATE INDEX IF NOT EXISTS idx_branches_city             -- NEW
  ON public.branches(city);


-- =====================================================
-- STEP 6: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches     ENABLE ROW LEVEL SECURITY;  -- NEW


-- =====================================================
-- STEP 7: DROP EXISTING POLICIES (Clean Slate)
-- =====================================================

-- profiles
DROP POLICY IF EXISTS "Users can view their own profile"                ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile"              ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles"                    ON public.profiles;
DROP POLICY IF EXISTS "Service role full access"                        ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone"               ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles"       ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"                    ON public.profiles;
DROP POLICY IF EXISTS "Service role has full access to profiles"        ON public.profiles;

-- message_logs
DROP POLICY IF EXISTS "Users can view their own messages"               ON public.message_logs;
DROP POLICY IF EXISTS "Users can insert their own messages"             ON public.message_logs;
DROP POLICY IF EXISTS "Admins can view all messages"                    ON public.message_logs;
DROP POLICY IF EXISTS "Service role full access on messages"            ON public.message_logs;
DROP POLICY IF EXISTS "Agents can view own messages"                    ON public.message_logs;
DROP POLICY IF EXISTS "Users can insert own messages"                   ON public.message_logs;
DROP POLICY IF EXISTS "Service role has full access to messages"        ON public.message_logs;

-- branches (new — drop if any were previously created)
DROP POLICY IF EXISTS "Authenticated users can view all branches"       ON public.branches;
DROP POLICY IF EXISTS "Service role has full access to branches"        ON public.branches;


-- =====================================================
-- STEP 8: RLS POLICIES — BRANCHES TABLE  ← NEW
-- =====================================================

-- All authenticated users can read all branches (needed by frontend dropdowns)
CREATE POLICY "Authenticated users can view all branches"
  ON public.branches
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role (backend) can insert / update / delete branches
CREATE POLICY "Service role has full access to branches"
  ON public.branches
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- =====================================================
-- STEP 9: RLS POLICIES — PROFILES TABLE
-- =====================================================

-- Any logged-in user can read all profiles (needed for name lookups)
CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can only update their own row
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING     (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Backend (service_role) has full access — bypasses RLS
CREATE POLICY "Service role has full access to profiles"
  ON public.profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- =====================================================
-- STEP 10: RLS POLICIES — MESSAGE_LOGS TABLE
-- =====================================================

-- Agents can read their OWN messages only
CREATE POLICY "Agents can view own messages"
  ON public.message_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = agent_id);

-- Admins can read ALL messages (cross-agent, cross-branch)
CREATE POLICY "Admins can view all messages"
  ON public.message_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id   = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Any authenticated user can insert their own logs (agent_id must match JWT uid)
CREATE POLICY "Users can insert own messages"
  ON public.message_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = agent_id);

-- Backend (service_role) has full access
CREATE POLICY "Service role has full access to messages"
  ON public.message_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- =====================================================
-- STEP 11: TRIGGER — AUTO-UPDATE profiles.updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- =====================================================
-- STEP 12: VERIFY SETUP
-- =====================================================

-- Check RLS is enabled on all three tables
SELECT
  schemaname,
  tablename,
  rowsecurity AS "RLS Enabled"
FROM pg_tables
WHERE tablename IN ('branches', 'profiles', 'message_logs')
  AND schemaname = 'public'
ORDER BY tablename;

-- List all active policies
SELECT
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('branches', 'profiles', 'message_logs')
  AND schemaname = 'public'
ORDER BY tablename, cmd;

-- Confirm final columns on profiles
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Confirm final columns on message_logs
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'message_logs'
ORDER BY ordinal_position;


-- =====================================================
-- STEP 13: VERIFY AUTH USERS HAVE PROFILES + BRANCH
-- =====================================================

SELECT
  u.id            AS user_id,
  u.email,
  CASE
    WHEN p.id IS NULL THEN '❌ MISSING PROFILE'
    ELSE '✅ OK'
  END             AS profile_status,
  p.full_name,
  p.role,
  CASE
    WHEN p.id IS NULL        THEN NULL
    WHEN p.branch_id IS NULL THEN '⚠️  No branch assigned'
    ELSE b.name
  END             AS branch
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.branches  b ON p.branch_id = b.id
ORDER BY u.created_at DESC;


-- =====================================================
-- STEP 14: ASSIGN BRANCHES TO EXISTING PROFILES
-- =====================================================
-- Run the relevant UPDATE below for each agent/admin.
-- Replace 'agent-uuid-here' with the actual UUID from Step 13.
--
-- Branch UUIDs (copy-paste ready):
--   Haridwar  → a0000000-0001-0000-0000-000000000001
--   Hyderabad → a0000000-0001-0000-0000-000000000002
--   Delhi     → a0000000-0001-0000-0000-000000000003
--   Gurgaon   → a0000000-0001-0000-0000-000000000004
-- =====================================================

/*
-- Example — assign Kartik to Haridwar branch:
UPDATE public.profiles
SET branch_id = 'a0000000-0001-0000-0000-000000000001'
WHERE id = 'kartik-user-uuid-here';

-- Example — assign an agent to Hyderabad:
UPDATE public.profiles
SET branch_id = 'a0000000-0001-0000-0000-000000000002'
WHERE id = 'agent-user-uuid-here';

-- Bulk assign ALL unassigned agents to Delhi (use carefully):
UPDATE public.profiles
SET branch_id = 'a0000000-0001-0000-0000-000000000003'
WHERE branch_id IS NULL;
*/


-- =====================================================
-- STEP 15: SAMPLE PROFILES (if any are still missing)
-- =====================================================
-- Uncomment and fill in real UUIDs from Step 13 if needed.

/*
INSERT INTO public.profiles (id, full_name, role, branch_id)
VALUES
  ('your-admin-uuid', 'Kartik',       'admin', 'a0000000-0001-0000-0000-000000000001'),
  ('your-agent-uuid', 'Shivay',       'agent', 'a0000000-0001-0000-0000-000000000001'),
  ('another-uuid',    'Agent Name',   'agent', 'a0000000-0001-0000-0000-000000000003')
ON CONFLICT (id) DO UPDATE
SET
  full_name = EXCLUDED.full_name,
  role      = EXCLUDED.role,
  branch_id = EXCLUDED.branch_id;
*/


-- =====================================================
-- STEP 16: TEST QUERIES
-- =====================================================

-- Messages per branch (all-time)
SELECT
  COALESCE(b.name, '(No Branch)') AS branch,
  COUNT(m.id)                      AS total_messages
FROM public.message_logs m
LEFT JOIN public.branches b ON m.branch_id = b.id
GROUP BY b.name
ORDER BY total_messages DESC;

-- Messages per branch TODAY (IST = UTC+5:30)
SELECT
  COALESCE(b.name, '(No Branch)') AS branch,
  COUNT(m.id)                      AS messages_today
FROM public.message_logs m
LEFT JOIN public.branches b ON m.branch_id = b.id
WHERE m.created_at >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date::timestamptz
                       AT TIME ZONE 'Asia/Kolkata'
GROUP BY b.name
ORDER BY messages_today DESC;

-- Agent leaderboard with branch info
SELECT
  p.full_name,
  p.role,
  COALESCE(b.name, '(No Branch)') AS branch,
  COUNT(m.id)                      AS total_messages
FROM public.profiles p
LEFT JOIN public.message_logs m ON p.id = m.agent_id
LEFT JOIN public.branches      b ON p.branch_id = b.id
GROUP BY p.id, p.full_name, p.role, b.name
ORDER BY total_messages DESC;

-- Recent 10 messages with agent + branch
SELECT
  m.id,
  p.full_name         AS agent_name,
  COALESCE(b.name, '(No Branch)') AS branch,
  m.customer_name,
  m.customer_phone,
  m.template_type,
  m.used_number,
  m.created_at
FROM public.message_logs m
JOIN  public.profiles p ON m.agent_id = p.id
LEFT JOIN public.branches b ON m.branch_id = b.id
ORDER BY m.created_at DESC
LIMIT 10;


-- =====================================================
-- SETUP COMPLETE ✅
-- =====================================================
--
-- Summary of changes in v2.0:
--   + public.branches table created (4 branches seeded)
--   + profiles.branch_id  UUID FK column added (nullable)
--   + message_logs.branch_id UUID FK column added (nullable)
--   + Indexes: idx_profiles_branch_id, idx_message_logs_branch_id, idx_branches_city
--   + RLS: branches table protected (read: authenticated, write: service_role only)
--
-- Next Steps:
--   1. Run Step 13 to see which users need a branch assigned
--   2. Run Step 14 UPDATE statements to assign branches to agents/admins
--   3. Tell the developer to update:
--        - /supabase/functions/server/index.tsx  → include branch_id in log-message
--        - /src/app/AdminDashboard.tsx           → branch filter + branch column
--        - /src/app/WhatsAppSender.tsx           → auto-read branch_id from profile
--   4. Re-run Step 16 test queries to verify data integrity
--
-- =====================================================

SELECT '✅ QHT Multi-Branch schema setup completed successfully!' AS status;
