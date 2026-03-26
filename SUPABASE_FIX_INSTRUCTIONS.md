# 🔧 Supabase Database Fix Instructions

## Problem Summary
Users cannot login. The application uses Supabase Auth, but there may be missing columns or RLS policy issues.

---

## ✅ Step 1: Add Missing Column to message_logs

Run this SQL in **Supabase SQL Editor**:

```sql
-- Add used_number column to message_logs table
ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS used_number TEXT;

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'message_logs' 
AND column_name = 'used_number';
```

---

## ✅ Step 2: Verify Table Structures

Run this to check your tables:

```sql
-- Check profiles table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- Check message_logs table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'message_logs'
ORDER BY ordinal_position;

-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('profiles', 'message_logs');
```

---

## ✅ Step 3: Fix RLS Policies for profiles Table

```sql
-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Service role can do anything" ON profiles;

-- Allow users to read their own profile
CREATE POLICY "Users can view their own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Allow service role full access (for admin operations)
CREATE POLICY "Service role can do anything"
ON profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

---

## ✅ Step 4: Fix RLS Policies for message_logs Table

```sql
-- Enable RLS on message_logs table
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Users can view their own messages" ON message_logs;
DROP POLICY IF EXISTS "Users can insert their own messages" ON message_logs;
DROP POLICY IF EXISTS "Service role can do anything on message_logs" ON message_logs;

-- Allow users to view their own message logs
CREATE POLICY "Users can view their own messages"
ON message_logs
FOR SELECT
TO authenticated
USING (auth.uid() = agent_id);

-- Allow users to insert their own message logs
CREATE POLICY "Users can insert their own messages"
ON message_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = agent_id);

-- Allow service role full access
CREATE POLICY "Service role can do anything on message_logs"
ON message_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

---

## ✅ Step 5: Verify Auth Users Exist

Check if your users exist in Supabase Auth:

```sql
-- List all auth users (run in SQL Editor)
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;
```

---

## ✅ Step 6: Verify Profile Records Match Auth Users

```sql
-- Check if all auth users have profiles
SELECT 
  u.id as user_id,
  u.email,
  p.full_name,
  p.role
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

-- Find users WITHOUT profiles (these will cause login failures)
SELECT 
  u.id as user_id,
  u.email,
  'MISSING PROFILE' as issue
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL;
```

---

## ✅ Step 7: Create Missing Profiles (If Needed)

If you find users without profiles, create them:

```sql
-- Example: Create a profile for a user
-- Replace 'USER_UUID_HERE' with actual user ID from Step 6
-- Replace 'John Doe' with actual name
-- Replace 'agent' with actual role ('admin' or 'agent')

INSERT INTO public.profiles (id, full_name, role, created_at)
VALUES 
  ('USER_UUID_HERE', 'John Doe', 'agent', NOW())
ON CONFLICT (id) DO NOTHING;
```

---

## ✅ Step 8: Test Login

1. Open browser console (F12)
2. Try to login
3. Check console for detailed error messages
4. Look for these indicators:

### ✅ Success Messages:
```
✅ Authentication successful!
👤 User ID (UID): xxxxx
✅ Profile fetched successfully!
🎭 Role: admin (or agent)
```

### ❌ Error Messages to Watch For:

**"Invalid login credentials"**
- User doesn't exist in auth.users
- Wrong password
- Email not confirmed

**"No profile found"**
- User exists in auth.users but NOT in public.profiles
- Solution: Run Step 7

**"permission denied"**
- RLS policy blocking query
- Solution: Re-run Step 3 and 4

**"Column 'used_number' does not exist"**
- Column not added to message_logs
- Solution: Re-run Step 1

---

## 🎯 Quick Verification Checklist

- [ ] `used_number` column exists in message_logs
- [ ] RLS is enabled on both tables
- [ ] RLS policies allow authenticated users to SELECT their own data
- [ ] RLS policies allow authenticated users to INSERT their own data
- [ ] All auth.users have matching records in public.profiles
- [ ] User email is confirmed (email_confirmed_at is not NULL)

---

## 📞 Still Having Issues?

**Share these console logs:**
1. Full error message from browser console during login
2. User ID (UUID) if authentication succeeds
3. SQL query results from Step 6

**Common Solutions:**
- Clear browser cache and localStorage
- Try logging in with a different user
- Check if Supabase project is active (not paused)
- Verify API keys in `/utils/supabase/info.tsx` are correct
