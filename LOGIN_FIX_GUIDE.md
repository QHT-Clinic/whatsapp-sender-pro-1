# 🔐 Complete Login System Fix Guide

## ✅ What Was Fixed

### **1. Complete Login Rewrite** (`/src/app/Login.tsx`)

**Authentication Flow:**
```javascript
Step 1: Authenticate with Supabase Auth
  ↓ supabase.auth.signInWithPassword(email, password)
  ↓ Uses auth.users table (built-in Supabase Auth)
  
Step 2: Fetch User Profile
  ↓ Query public.profiles WHERE id = authenticated_user_id
  ↓ Get role (admin/agent) and full_name
  
Step 3: Store Session
  ↓ localStorage: session, role, name, user_id, expiry
  
Step 4: Redirect
  ↓ admin → /admin-panel
  ↓ agent → /agent-dashboard
```

**Key Features:**
- ✅ **NOT using** `agents_profile_password` table for authentication
- ✅ **Uses standard Supabase Auth** (`auth.users` table)
- ✅ **Detailed console logging** at every step
- ✅ **Specific error messages** for different failure scenarios
- ✅ **Proper session management** with 15-day expiry

---

### **2. Enhanced Session Management** (`/src/app/App.tsx`)

**Session Validation:**
```javascript
1. Check localStorage for session data
2. Verify session hasn't expired (15-day limit)
3. Validate with Supabase Auth (supabase.auth.getSession())
4. Verify user ID matches
5. Redirect based on role
```

**Auto-Logout on:**
- Session expiry (15 days)
- Invalid session in Supabase
- User ID mismatch
- Invalid role

---

## 🎯 Error Messages Explained

| Error Message | Cause | Solution |
|---------------|-------|----------|
| **"Invalid email or password"** | Wrong credentials in auth.users | Check email/password are correct |
| **"User profile not initialized"** | User exists in auth.users but NOT in profiles table | Run SQL to create profile (see below) |
| **"Database permission error"** | RLS policy blocking query | Run the SQL setup script |
| **"Invalid user role"** | Role is not 'admin' or 'agent' | Update role in profiles table |

---

## 🚀 Setup Instructions

### **Step 1: Run SQL Setup Script**

1. Open **Supabase Dashboard**
2. Go to **SQL Editor**
3. Copy and paste entire content from `/COMPLETE_SUPABASE_SETUP.sql`
4. Click **Run**

This will:
- ✅ Add `used_number` column to message_logs
- ✅ Enable RLS on both tables
- ✅ Create proper RLS policies
- ✅ Allow authenticated users to read profiles
- ✅ Check for missing profiles

---

### **Step 2: Verify Auth Users Have Profiles**

After running the SQL, check the output of **Step 10** which shows:

```
user_id | email | profile_status | full_name | role
--------|-------|----------------|-----------|------
uuid... | admin@example.com | ✅ Profile exists | John Doe | admin
uuid... | agent@example.com | ❌ MISSING PROFILE | NULL | NULL
```

---

### **Step 3: Create Missing Profiles**

If you see **"❌ MISSING PROFILE"**, run this SQL:

```sql
-- Replace with actual values from Step 10
INSERT INTO public.profiles (id, full_name, role)
VALUES 
  ('USER_UUID_FROM_STEP_10', 'Actual Name', 'admin')  -- or 'agent'
ON CONFLICT (id) DO UPDATE
SET 
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;
```

**Example:**
```sql
INSERT INTO public.profiles (id, full_name, role)
VALUES 
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'John Smith', 'admin'),
  ('b2c3d4e5-f6g7-8901-bcde-f12345678901', 'Jane Doe', 'agent')
ON CONFLICT (id) DO NOTHING;
```

---

### **Step 4: Test Login**

1. **Clear browser cache and localStorage:**
   - Press `Ctrl + Shift + Delete`
   - Clear browsing data
   - OR just clear localStorage in DevTools

2. **Refresh the page:**
   - Press `Ctrl + F5` (hard refresh)

3. **Open Browser Console:**
   - Press `F12`
   - Go to Console tab

4. **Try to login:**
   - Enter email and password
   - Click "Sign In"

5. **Watch console logs:**

---

## 📊 Console Log Examples

### ✅ **Successful Login:**
```
🔐 ===== LOGIN ATTEMPT STARTED =====
📧 Email: admin@example.com
🔑 Step 1: Attempting authentication with Supabase Auth...
✅ ===== AUTHENTICATION SUCCESSFUL =====
👤 User ID (UID): a1b2c3d4-e5f6-7890-abcd-ef1234567890
📧 User Email: admin@example.com
Session User: {id: "a1b2c3d4...", email: "admin@example.com", ...}
📋 Step 2: Fetching user profile from public.profiles...
🔍 Querying WHERE id = a1b2c3d4-e5f6-7890-abcd-ef1234567890
✅ ===== PROFILE FETCH SUCCESSFUL =====
👤 Full Name: John Smith
🎭 Role: admin
💾 Step 3: Storing session in localStorage...
✅ Session stored successfully
🚀 Step 4: Redirecting user...
📍 Target Page: /admin
✅ ===== LOGIN COMPLETED SUCCESSFULLY =====
```

---

### ❌ **Login Failed - Invalid Credentials:**
```
🔐 ===== LOGIN ATTEMPT STARTED =====
📧 Email: wrong@example.com
🔑 Step 1: Attempting authentication with Supabase Auth...
❌ ===== AUTHENTICATION FAILED =====
Error Message: Invalid login credentials
```

**Fix:** Check email/password are correct in Supabase Auth

---

### ❌ **Login Failed - Profile Not Found:**
```
✅ ===== AUTHENTICATION SUCCESSFUL =====
👤 User ID (UID): a1b2c3d4-e5f6-7890-abcd-ef1234567890
📋 Step 2: Fetching user profile from public.profiles...
❌ ===== PROFILE FETCH FAILED =====
Error Code: PGRST116
💡 DIAGNOSIS: User authenticated but NO profile found in public.profiles
💡 SOLUTION: Create profile record:
   INSERT INTO public.profiles (id, full_name, role) 
   VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'User Name', 'agent');
```

**Fix:** Run the SQL from Step 3 above

---

### ❌ **Login Failed - RLS Policy Error:**
```
❌ ===== PROFILE FETCH FAILED =====
Error Code: 42501
💡 DIAGNOSIS: RLS policy blocking SELECT on profiles table
💡 SOLUTION: Update RLS policy to allow authenticated users to read profiles
```

**Fix:** Re-run `/COMPLETE_SUPABASE_SETUP.sql`

---

## 🔍 Debugging Checklist

### **Before you contact support, verify:**

- [ ] **SQL setup script ran successfully** (check for green checkmarks in output)
- [ ] **All auth users have profiles** (Step 10 of SQL script shows ✅)
- [ ] **RLS is enabled** on both tables
- [ ] **Browser cache cleared** and page refreshed
- [ ] **Console shows detailed logs** (Press F12)
- [ ] **Correct email/password** being used

---

## 📝 Key Files Updated

| File | Changes |
|------|---------|
| `/src/app/Login.tsx` | Complete rewrite with proper Supabase Auth flow |
| `/src/app/App.tsx` | Enhanced session validation and logging |
| `/COMPLETE_SUPABASE_SETUP.sql` | Complete database setup script |
| `/LOGIN_FIX_GUIDE.md` | This guide |

---

## 🎯 Common Issues & Solutions

### **Issue 1: "Invalid email or password"**

**Possible Causes:**
1. Wrong email or password
2. User doesn't exist in Supabase Auth
3. Email not confirmed (if email confirmation is required)

**Solution:**
```sql
-- Check if user exists
SELECT id, email, email_confirmed_at 
FROM auth.users 
WHERE email = 'your-email@example.com';
```

If user doesn't exist, create one in Supabase Dashboard:
- Go to **Authentication → Users**
- Click **"Add user"**
- Enter email and password
- ✅ **Auto Confirm User** (important!)

---

### **Issue 2: "User profile not initialized"**

**Cause:** User exists in auth.users but not in profiles table

**Solution:**
```sql
-- Get the user ID first
SELECT id, email FROM auth.users WHERE email = 'user@example.com';

-- Create profile with that ID
INSERT INTO public.profiles (id, full_name, role)
VALUES ('USER_ID_FROM_ABOVE', 'User Name', 'agent');
```

---

### **Issue 3: Login works but immediately logs out**

**Cause:** Session validation failing

**Solution:**
1. Clear all localStorage
2. Check console for session validation logs
3. Verify Supabase project is not paused

---

### **Issue 4: Different users getting mixed up**

**Cause:** User ID mismatch in session

**Solution:**
```javascript
// Clear localStorage completely
localStorage.clear();

// Or specifically:
localStorage.removeItem('qht_session');
localStorage.removeItem('qht_user_role');
localStorage.removeItem('qht_user_name');
localStorage.removeItem('qht_user_id');
localStorage.removeItem('qht_session_expiry');
```

---

## 🆘 Still Having Issues?

**Share these with support:**

1. **Complete console log** from login attempt (copy entire console output)
2. **SQL query results:**
   ```sql
   -- Run this and share output
   SELECT 
     u.id,
     u.email,
     p.full_name,
     p.role
   FROM auth.users u
   LEFT JOIN public.profiles p ON u.id = p.id
   WHERE u.email = 'your-email@example.com';
   ```
3. **RLS policy check:**
   ```sql
   SELECT policyname, cmd, qual 
   FROM pg_policies 
   WHERE tablename = 'profiles';
   ```

---

## ✅ Success Indicators

You'll know login is working when you see:

1. ✅ Console shows "LOGIN COMPLETED SUCCESSFULLY"
2. ✅ Redirected to correct dashboard (admin or agent)
3. ✅ No errors in console
4. ✅ Session persists after page refresh
5. ✅ Logout button works correctly

---

**Last Updated:** February 25, 2026  
**System Version:** QHT Clinic WhatsApp Sender v1.0  
**Author:** AI Assistant
