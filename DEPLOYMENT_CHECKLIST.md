# 🚀 Production Deployment Checklist

## ✅ What's Been Fixed

### **1. Complete Login System Rewrite**
- ✅ Uses standard **Supabase Auth** (`auth.users` table)
- ✅ **NOT using** `agents_profile_password` table
- ✅ Fetches user data from `public.profiles` table
- ✅ Proper error handling with specific messages
- ✅ Comprehensive console logging for debugging

### **2. Session Management**
- ✅ 15-day session expiry
- ✅ Auto-validation on app load
- ✅ Secure logout functionality
- ✅ User ID verification

### **3. Message Logging**
- ✅ `used_number` field added to track sender WhatsApp number
- ✅ Proper error handling for database operations
- ✅ Graceful degradation if logging fails

---

## 📋 Pre-Deployment Steps

### **Step 1: Database Setup** (5 minutes)

1. Open **Supabase Dashboard**
2. Go to **SQL Editor**
3. Run `/COMPLETE_SUPABASE_SETUP.sql`
4. Verify output shows:
   - ✅ RLS Enabled on both tables
   - ✅ Policies created successfully
   - ✅ All auth users have profiles

### **Step 2: Create Test Users** (3 minutes)

Create at least one admin and one agent for testing:

#### **Via Supabase Dashboard:**
1. Go to **Authentication → Users**
2. Click **"Add user"**
3. Fill in:
   - Email: `admin@qht.com`
   - Password: `SecurePassword123!`
   - ✅ **Auto Confirm User** ← IMPORTANT!
4. Click **Create user**
5. Copy the **User ID**

#### **Via SQL:**
```sql
-- Create profile for the user
INSERT INTO public.profiles (id, full_name, role)
VALUES 
  ('USER_ID_FROM_DASHBOARD', 'Admin User', 'admin');
```

Repeat for agent user.

---

### **Step 3: Verify RLS Policies** (2 minutes)

Run this SQL to verify policies:

```sql
-- Should show 3 policies for profiles
SELECT policyname, cmd, roles
FROM pg_policies 
WHERE tablename = 'profiles';

-- Should show 4 policies for message_logs
SELECT policyname, cmd, roles
FROM pg_policies 
WHERE tablename = 'message_logs';
```

**Expected Output:**

**profiles table:**
- ✅ Authenticated users can view all profiles (SELECT)
- ✅ Users can update own profile (UPDATE)
- ✅ Service role has full access (ALL)

**message_logs table:**
- ✅ Agents can view own messages (SELECT)
- ✅ Admins can view all messages (SELECT)
- ✅ Users can insert own messages (INSERT)
- ✅ Service role has full access (ALL)

---

### **Step 4: Test Login Flow** (5 minutes)

1. **Clear browser cache:**
   ```
   Ctrl + Shift + Delete → Clear everything
   ```

2. **Open app in Incognito/Private window**

3. **Open DevTools Console** (F12)

4. **Test Admin Login:**
   - Email: `admin@qht.com`
   - Password: `SecurePassword123!`
   - Expected: Redirect to Admin Panel

5. **Verify Console Logs:**
   ```
   ✅ ===== AUTHENTICATION SUCCESSFUL =====
   ✅ ===== PROFILE FETCH SUCCESSFUL =====
   🎭 Role: admin
   ✅ ===== LOGIN COMPLETED SUCCESSFULLY =====
   ```

6. **Test Logout:**
   - Click logout button
   - Verify redirect to login page
   - Verify localStorage cleared

7. **Test Agent Login:**
   - Email: `agent@qht.com`
   - Password: `AgentPassword123!`
   - Expected: Redirect to Agent Dashboard

---

### **Step 5: Test Message Sending** (3 minutes)

1. **Login as Agent**

2. **Fill Message Form:**
   - Lead ID: `TEST123`
   - Select WhatsApp Number
   - Customer Name: `Test Customer`
   - Phone: `+919876543210`
   - Message: `Test message from QHT Clinic`

3. **Send Message**

4. **Verify Console:**
   ```
   📝 Inserting to message_logs table: {...}
   📱 Used Number (Sender WhatsApp): 918679009323
   ✅ Message logged successfully
   ```

5. **Verify Database:**
   ```sql
   SELECT * FROM message_logs 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```
   - ✅ `used_number` field should contain the WhatsApp number

---

### **Step 6: Test Admin Features** (3 minutes)

1. **Login as Admin**

2. **Verify Employee Management:**
   - Can view all agents
   - Can create new agent (via dashboard UI)

3. **Verify Message Logs:**
   - Can see all messages from all agents
   - Activity calendar shows data

---

## 🔍 Post-Deployment Verification

### **Checklist:**

- [ ] Admin can login successfully
- [ ] Agent can login successfully
- [ ] Invalid credentials show proper error
- [ ] Session persists after page refresh
- [ ] Logout clears session
- [ ] Messages are logged with `used_number`
- [ ] Admin can see all messages
- [ ] Agent can see only their own messages
- [ ] No errors in browser console
- [ ] No errors in Supabase logs

---

## 🐛 Common Issues After Deployment

### **Issue: "Invalid email or password"**

**Debug Steps:**
1. Check console for detailed error
2. Verify user exists in auth.users:
   ```sql
   SELECT * FROM auth.users WHERE email = 'user@example.com';
   ```
3. Check if email is confirmed:
   ```sql
   SELECT email, email_confirmed_at FROM auth.users;
   ```

**Fix:**
- If email not confirmed, update:
  ```sql
  UPDATE auth.users 
  SET email_confirmed_at = NOW() 
  WHERE email = 'user@example.com';
  ```

---

### **Issue: "User profile not initialized"**

**Debug Steps:**
1. Check console - it will show the exact User ID
2. Verify profile exists:
   ```sql
   SELECT * FROM profiles WHERE id = 'USER_ID_FROM_CONSOLE';
   ```

**Fix:**
```sql
INSERT INTO public.profiles (id, full_name, role)
VALUES ('USER_ID', 'Full Name', 'admin')  -- or 'agent'
ON CONFLICT (id) DO NOTHING;
```

---

### **Issue: "Database permission error"**

**Debug Steps:**
1. Check RLS is enabled:
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename IN ('profiles', 'message_logs');
   ```

2. Check policies exist:
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename IN ('profiles', 'message_logs');
   ```

**Fix:**
- Re-run `/COMPLETE_SUPABASE_SETUP.sql`

---

### **Issue: Messages not logging**

**Debug Steps:**
1. Check console for database insert error
2. Verify `used_number` column exists:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'message_logs' 
   AND column_name = 'used_number';
   ```

**Fix:**
```sql
ALTER TABLE message_logs ADD COLUMN used_number TEXT;
```

---

## 📊 Monitoring

### **Daily Checks:**

1. **Check Supabase Logs:**
   - Go to Supabase Dashboard → Database → Logs
   - Look for any errors

2. **Verify Login Analytics:**
   ```sql
   SELECT 
     DATE(last_sign_in_at) as date,
     COUNT(*) as logins
   FROM auth.users
   WHERE last_sign_in_at > NOW() - INTERVAL '7 days'
   GROUP BY DATE(last_sign_in_at)
   ORDER BY date DESC;
   ```

3. **Check Message Activity:**
   ```sql
   SELECT 
     DATE(created_at) as date,
     COUNT(*) as messages_sent
   FROM message_logs
   WHERE created_at > NOW() - INTERVAL '7 days'
   GROUP BY DATE(created_at)
   ORDER BY date DESC;
   ```

---

## 🔐 Security Checklist

- [ ] **RLS enabled** on all tables
- [ ] **Service role key** never exposed to frontend
- [ ] **Session tokens** stored securely in localStorage
- [ ] **Passwords** meet minimum requirements
- [ ] **Email confirmation** enabled (if required)
- [ ] **CORS** properly configured in Supabase

---

## 📞 Support Information

### **If login fails:**

**Provide to support:**
1. Complete browser console log (entire output from login attempt)
2. User email trying to login
3. Screenshots of any error messages
4. Results from these SQL queries:
   ```sql
   -- User check
   SELECT id, email, email_confirmed_at 
   FROM auth.users 
   WHERE email = 'FAILING_USER_EMAIL';
   
   -- Profile check
   SELECT * FROM profiles 
   WHERE id = 'USER_ID_FROM_ABOVE';
   
   -- RLS check
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename = 'profiles';
   ```

---

## 🎉 Success Criteria

System is production-ready when:

1. ✅ All test users can login
2. ✅ Role-based routing works (admin → admin panel, agent → dashboard)
3. ✅ Sessions persist across page refreshes
4. ✅ Messages are logged with all required fields
5. ✅ No console errors during normal operation
6. ✅ Logout works correctly
7. ✅ RLS policies prevent unauthorized access

---

## 📝 Files Reference

| File | Purpose |
|------|---------|
| `/src/app/Login.tsx` | Main login component with Supabase Auth |
| `/src/app/App.tsx` | Session management and routing |
| `/src/app/WhatsAppSender.tsx` | Message sending with logging |
| `/COMPLETE_SUPABASE_SETUP.sql` | Database setup script |
| `/LOGIN_FIX_GUIDE.md` | Detailed login troubleshooting |
| `/DEPLOYMENT_CHECKLIST.md` | This file |

---

**System Version:** 1.0  
**Last Updated:** February 25, 2026  
**Status:** ✅ Production Ready
