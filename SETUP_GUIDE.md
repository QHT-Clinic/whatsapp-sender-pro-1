# Quick Setup Guide - agent_profile_password Schema

## 🎯 Critical Change: UID Mapping

The authentication now uses `agent_profile_password` table instead of `profiles`.

---

## ✅ Setup Steps

### **1. Create Test Agent**

#### **Step A: Create Auth User**
Go to Supabase Dashboard:
```
Authentication → Users → "Add User"

Email: agent@qht.com
Password: password123
```

**IMPORTANT:** Copy the UUID generated (e.g., `abc123-def456-ghi789-...`)

---

#### **Step B: Create Profile Entry**
Go to SQL Editor and run:

```sql
-- Replace 'YOUR_UUID_HERE' with the UUID from Step A
INSERT INTO public.agent_profile_password (id, name, email, role, password)
VALUES (
  'YOUR_UUID_HERE',  -- ← PASTE UUID FROM STEP A
  'Test Agent',
  'agent@qht.com',
  'agent',
  'password123'
);
```

**Example:**
```sql
INSERT INTO public.agent_profile_password (id, name, email, role, password)
VALUES (
  'abc123-def456-ghi789-...',  -- Real UUID from auth.users
  'Test Agent',
  'agent@qht.com',
  'agent',
  'password123'
);
```

---

### **2. Verify Mapping**

Run this query to confirm the IDs match:

```sql
SELECT 
  au.id AS auth_user_id,
  app.id AS profile_id,
  app.name,
  app.email,
  app.role,
  CASE 
    WHEN au.id = app.id THEN '✅ MATCH'
    ELSE '❌ MISMATCH'
  END AS status
FROM auth.users au
LEFT JOIN public.agent_profile_password app ON au.id = app.id
WHERE au.email = 'agent@qht.com';
```

**Expected Result:**
```
auth_user_id          | profile_id           | name       | email           | role  | status
abc123-def456-...     | abc123-def456-...    | Test Agent | agent@qht.com   | agent | ✅ MATCH
```

---

### **3. Disable RLS (For Testing)**

```sql
ALTER TABLE agent_profile_password DISABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs DISABLE ROW LEVEL SECURITY;
```

---

### **4. Test Login**

Open your app:
```
Email: agent@qht.com
Password: password123
```

**Expected Console Output:**
```
✅ Login successful!
User ID: abc123-def456-...
Fetching agent profile from agent_profile_password...
Agent logged in: Test Agent | Role: agent
Today's count: 0
```

**Expected Dashboard:**
```
Welcome, Test Agent
[📊 Today's Stats] [🚪 Logout]
```

---

## ❌ Common Issues

### **Issue 1: "Error fetching agent profile"**

**Cause:** The `id` in `agent_profile_password` doesn't match the `id` in `auth.users`.

**Solution:**
1. Check the UUID in `auth.users`:
```sql
SELECT id, email FROM auth.users WHERE email = 'agent@qht.com';
```

2. Update `agent_profile_password` with the correct UUID:
```sql
UPDATE agent_profile_password
SET id = 'CORRECT_UUID_FROM_AUTH_USERS'
WHERE email = 'agent@qht.com';
```

---

### **Issue 2: Dashboard shows "Welcome, Agent" (generic)**

**Cause:** Profile fetch failed, fell back to default name.

**Solution:** Check console for errors and verify the mapping query in Issue 1.

---

### **Issue 3: "Invalid email or password"**

**Cause:** User doesn't exist in `auth.users` or password is wrong.

**Solution:**
1. Verify user exists:
```sql
SELECT email FROM auth.users WHERE email = 'agent@qht.com';
```

2. If missing, create via Supabase Dashboard → Authentication → Users → "Add User"

---

## 🔄 Migration from `profiles` to `agent_profile_password`

If you had old data in `profiles`, migrate it:

```sql
-- Copy existing profiles to agent_profile_password
INSERT INTO agent_profile_password (id, name, email, role)
SELECT 
  p.id,
  p.full_name AS name,
  p.email,
  'agent' AS role
FROM profiles p
ON CONFLICT (id) DO NOTHING;
```

---

## ✅ Final Verification

Run this to see all agents:

```sql
SELECT 
  app.id,
  app.name,
  app.email,
  app.role,
  au.email AS auth_email,
  CASE 
    WHEN au.id IS NOT NULL THEN '✅ Has Auth'
    ELSE '❌ No Auth'
  END AS auth_status
FROM agent_profile_password app
LEFT JOIN auth.users au ON app.id = au.id
ORDER BY app.created_at DESC;
```

**All rows should show "✅ Has Auth"**

---

## 🎯 Summary

**Critical Requirement:**
```
auth.users.id  MUST EQUAL  agent_profile_password.id
```

**If they don't match:**
- Profile fetch fails
- Dashboard shows "Welcome, Agent" (generic)
- Console shows error

**If they match:**
- Profile fetch succeeds
- Dashboard shows "Welcome, [Agent Name]"
- Role is logged to console
- Everything works ✅

---

**Questions? Check the main README.md for full documentation.**
