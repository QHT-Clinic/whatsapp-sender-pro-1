# Troubleshooting Guide

## ❌ Error: "Failed to fetch" / Network Error

### **Symptoms:**
```
❌ Network Error: {
  "url": "https://zqcspamakvfzvlqbunit.supabase.co/auth/v1/token?grant_type=password",
  "error": "Failed to fetch",
  "type": "TypeError"
}
TypeError: Failed to fetch
Login error: AuthRetryableFetchError: Failed to fetch
```

### **Most Common Cause:**
**Your Supabase project is paused.**

---

## ✅ Solution: Resume Your Supabase Project

### **Step 1: Go to Supabase Dashboard**
Open this link in your browser:
```
https://supabase.com/dashboard/project/zqcspamakvfzvlqbunit
```

### **Step 2: Check Project Status**
Look for a banner or notification that says:
- "Project is paused"
- "Project is inactive"
- "Resume project"

### **Step 3: Resume the Project**
1. Click the **"Resume Project"** button
2. Wait for the project to become active (usually takes 30-60 seconds)
3. You'll see a green status indicator when it's ready

### **Step 4: Refresh Your App**
1. Go back to your application
2. Press `F5` or refresh the page
3. The connection error should disappear
4. You should now be able to login

---

## 🔍 How to Verify Project is Active

### **Check 1: Dashboard Status**
In your Supabase dashboard, you should see:
- ✅ Green status indicator
- ✅ "Project is active" message
- ✅ Database URL is accessible

### **Check 2: Connection Test**
The login page automatically tests the connection on load. If successful, you'll see:
```
🔍 Testing Supabase connection...
✅ Supabase connection successful
```

If failed, you'll see:
```
🔍 Testing Supabase connection...
❌ Supabase connection test failed
```

---

## 🚨 Other Possible Causes

### **Issue 2: Incorrect Credentials**

**Error:**
```
Invalid login credentials
```

**Solution:**
- Check that you're using the correct email and password
- Verify the user exists in Supabase Dashboard → Authentication → Users
- Ensure the user's email is confirmed (or email confirmation is disabled)

---

### **Issue 3: Missing Database Tables**

**Error:**
```
relation "agent_profile_password" does not exist
```

**Solution:**
Create the required tables:

```sql
-- Create agent_profile_password table
CREATE TABLE agent_profile_password (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  password TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create message_logs table
CREATE TABLE message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  lead_id TEXT,
  customer_phone TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  template_type TEXT NOT NULL,
  message_content TEXT,
  image_url TEXT,
  used_number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

### **Issue 4: RLS Policies Blocking Access**

**Error:**
```
new row violates row-level security policy
```

**Solution:**
Disable RLS for testing:

```sql
ALTER TABLE agent_profile_password DISABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs DISABLE ROW LEVEL SECURITY;
```

Or create permissive policies:

```sql
CREATE POLICY "Allow all access to agent_profile_password"
ON agent_profile_password FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all access to message_logs"
ON message_logs FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
```

---

### **Issue 5: User Doesn't Have Profile**

**Error:**
```
Error fetching agent profile
Dashboard shows "Welcome, Agent" (generic)
```

**Solution:**
Ensure every user in `auth.users` has a matching entry in `agent_profile_password`:

```sql
-- Check if user has profile
SELECT 
  au.id AS auth_id,
  au.email AS auth_email,
  app.id AS profile_id,
  app.name AS profile_name
FROM auth.users au
LEFT JOIN agent_profile_password app ON au.id = app.id
WHERE au.email = 'your-email@example.com';
```

If `profile_id` is NULL, create the profile:

```sql
INSERT INTO agent_profile_password (id, name, email, role)
VALUES (
  '[USER_UUID_FROM_ABOVE_QUERY]',
  'Agent Name',
  'your-email@example.com',
  'agent'
);
```

---

## 📊 Console Debugging

### **Enable Detailed Logging**

Open your browser's Developer Tools:
- Chrome/Edge: Press `F12`
- Firefox: Press `F12`
- Safari: Press `Cmd+Option+I` (Mac)

Go to the **Console** tab and look for:

### **Successful Connection:**
```
🔧 Initializing Supabase Client...
📍 Supabase URL: https://zqcspamakvfzvlqbunit.supabase.co
🔑 Anon Key: eyJhbGciOiJIUzI1NiI...
✅ Supabase client initialized successfully
🔍 Testing Supabase connection...
✅ Supabase connection successful
```

### **Failed Connection (Project Paused):**
```
🔧 Initializing Supabase Client...
📍 Supabase URL: https://zqcspamakvfzvlqbunit.supabase.co
🔑 Anon Key: eyJhbGciOiJIUzI1NiI...
✅ Supabase client initialized successfully
🔍 Testing Supabase connection...
❌ Network Error: {
  "url": "https://zqcspamakvfzvlqbunit.supabase.co/rest/v1/agent_profile_password...",
  "error": "Failed to fetch",
  "type": "TypeError"
}
❌ Supabase connection test failed
```

### **Successful Login:**
```
🔐 Attempting login...
📧 Email: agent@qht.com
🌐 Supabase API Request: https://zqcspamakvfzvlqbunit.supabase.co/auth/v1/token?grant_type=password
✅ Login successful!
Fetching agent data...
User ID: abc123-def456-...
Fetching agent profile from agent_profile_password...
Agent logged in: Test Agent | Role: agent
```

---

## 🔧 Quick Fix Checklist

Before reporting an issue, check:

- [ ] Is Supabase project active (not paused)?
- [ ] Are Supabase credentials correct in `/utils/supabase/info.tsx`?
- [ ] Do all required tables exist?
- [ ] Does the user exist in `auth.users`?
- [ ] Does the user have a matching profile in `agent_profile_password`?
- [ ] Is RLS disabled or configured correctly?
- [ ] Is email confirmation disabled in Supabase settings?
- [ ] Are there any errors in the browser console?

---

## 📞 Still Having Issues?

### **Check Supabase Status:**
Visit: https://status.supabase.com/

### **Review Logs:**
Go to: https://supabase.com/dashboard/project/zqcspamakvfzvlqbunit/logs

### **Test Connection Manually:**
```sql
-- In Supabase SQL Editor
SELECT 1;
```

If this fails, your project is definitely having issues.

---

## ✅ Expected Working State

### **Login Page:**
- No connection errors
- Form inputs enabled
- Button says "Login" (not "Project Paused")

### **Console:**
```
✅ Supabase connection successful
```

### **After Login:**
- Redirects to dashboard
- Shows "Welcome, [Your Name]"
- Today's Stats button works
- Message form is functional

---

**Last Updated:** February 25, 2026  
**Project ID:** zqcspamakvfzvlqbunit  
**Dashboard:** https://supabase.com/dashboard/project/zqcspamakvfzvlqbunit
