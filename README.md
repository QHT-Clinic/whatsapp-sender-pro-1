# QHT Clinic - WhatsApp Message Sender

## 🎯 Production-Ready Authentication System

Clean, professional authentication with Supabase Auth integration using `agent_profile_password` table.

---

## 🚀 Features

### **1. Authentication**
- ✅ Supabase Auth with `signInWithPassword`
- ✅ Maps session UID to `agent_profile_password.id`
- ✅ Fetches agent name and role from `agent_profile_password`
- ✅ Session management
- ✅ Auto-redirect after login
- ✅ Logout functionality

### **2. Agent Dashboard**
- ✅ Personalized welcome (fetches `name` from `agent_profile_password` table)
- ✅ WhatsApp message sender form
- ✅ Quick templates (English/Hinglish)
- ✅ Image templates with preview
- ✅ Today's message count button

### **3. Today's Statistics**
- ✅ Modal popup showing daily message count
- ✅ Fetches from `message_logs` table
- ✅ Filters by `agent_id` (current user's UID)
- ✅ Filters by `created_at` (today only)
- ✅ Auto-updates after sending message

### **4. Database Logging**
- ✅ Logs to `public.message_logs`
- ✅ Captures `agent_id` from session
- ✅ Captures `used_number` from UI dropdown
- ✅ Full webhook integration

---

## 📋 User Flow

### **Login Flow:**
```
1. User opens app
2. App checks for active session
3. If no session → Show login page
4. User enters email & password
5. Click "Login"
6. Supabase Auth validates credentials
7. Session created with UID
8. Map UID to agent_profile_password.id
9. Fetch name and role from agent_profile_password
10. Redirect to WhatsApp Sender Dashboard ✅
```

### **Dashboard Flow:**
```
1. User sees personalized greeting: "Welcome, [Agent Name]"
2. Two action buttons:
   - 📊 Today's Stats → Opens modal with message count
   - 🚪 Logout → Signs out user
3. Fill message form
4. Send message
5. Message sent to webhook ✅
6. Message logged to database ✅
7. Today's count auto-updates ✅
```

---

## 🗃️ Database Schema

### **Required Tables:**

#### **1. `public.agent_profile_password`**
```sql
CREATE TABLE agent_profile_password (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  password TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Important:** The `id` column MUST match the UID from `auth.users` for proper mapping.

#### **2. `public.message_logs`**
```sql
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

### **Required Columns:**
- ✅ `agent_profile_password.id` - UUID matching auth.users UID
- ✅ `agent_profile_password.name` - Agent's display name
- ✅ `agent_profile_password.role` - Agent's role (logged but not used for routing)
- ✅ `message_logs.agent_id` - UUID of logged-in user
- ✅ `message_logs.used_number` - WhatsApp number selected in UI
- ✅ `message_logs.created_at` - Timestamp for filtering today's messages

---

## 🔐 Authentication Setup

### **1. Create Test Agent in Supabase:**

#### **Step 1: Create Auth User**
Go to Supabase Dashboard → Authentication → Users → "Add User"
```
Email: agent@qht.com
Password: password123
```

**Note the UUID generated** (e.g., `abc123-def456-...`)

#### **Step 2: Create Profile Entry**
Go to Supabase Dashboard → SQL Editor → Run:

```sql
-- Use the UUID from Step 1
INSERT INTO public.agent_profile_password (id, name, email, role, password)
VALUES (
  'abc123-def456-...',  -- Replace with actual UUID from auth.users
  'Test Agent',
  'agent@qht.com',
  'agent',
  'password123'  -- Optional: Store hashed password if needed
);
```

**Critical:** The `id` in `agent_profile_password` MUST match the `id` in `auth.users`.

---

## 🧪 Testing

### **1. Login:**
```
Email: agent@qht.com
Password: password123
```

Click "Login" → Should redirect to dashboard immediately.

### **2. Expected Console Output:**
```
Attempting login...
✅ Login successful!
Fetching agent data...
User ID: abc123-def456-...
Fetching agent profile from agent_profile_password...
Agent logged in: Test Agent | Role: agent
Fetching today's count...
Today's count: 0
```

### **3. Dashboard:**
Should see:
- "Welcome, Test Agent"
- 📊 Today's Stats button
- 🚪 Logout button
- Message sender form

### **4. Today's Stats:**
Click "📊 Today's Stats" → Modal opens showing:
```
📊 Today's Statistics
Messages Sent Today
0
```

### **5. Send Test Message:**
```
Lead ID: TEST123
WhatsApp: QHT Mediways Pvt Ltd.- 918679009323
Customer: John Doe
Phone: 9876543210
Message: (select template)
```

Click "Send Message" → Should see:
- ✅ Success toast
- Message logged to database
- Today's Stats count increments to 1

### **6. Verify Database:**
```sql
SELECT 
  agent_id,
  used_number,
  customer_name,
  template_type,
  created_at
FROM message_logs
ORDER BY created_at DESC
LIMIT 1;
```

Should show:
- `agent_id` = User's UUID (matches agent_profile_password.id)
- `used_number` = "918679009323"
- All other fields populated ✅

### **7. Logout:**
Click "🚪 Logout" → Should redirect to login page.

---

## 📊 Authentication Mapping Logic

### **On Login:**
```javascript
// 1. Authenticate with Supabase
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'agent@qht.com',
  password: 'password123'
});

// 2. Get user UID from session
const { data: { user } } = await supabase.auth.getUser();
const userId = user.id; // e.g., "abc123-def456-..."

// 3. Fetch agent profile from agent_profile_password
const { data: agentProfile } = await supabase
  .from("agent_profile_password")
  .select("name, role")
  .eq("id", userId)  // Map UID to agent_profile_password.id
  .single();

// 4. Set agent name
setAgentName(agentProfile.name); // "Test Agent"
console.log("Agent logged in:", agentProfile.name, "| Role:", agentProfile.role);
```

### **Critical Requirement:**
```
auth.users.id  =  agent_profile_password.id
     ↓                      ↓
abc123-def456-...  =  abc123-def456-...
```

**If these don't match, the profile fetch will fail.**

---

## 📊 Today's Message Count Logic

### **Query:**
```javascript
const today = new Date();
const startOfDay = new Date(
  today.getFullYear(),
  today.getMonth(),
  today.getDate(),
  0, 0, 0
).toISOString();

const endOfDay = new Date(
  today.getFullYear(),
  today.getMonth(),
  today.getDate(),
  23, 59, 59
).toISOString();

const { count } = await supabase
  .from("message_logs")
  .select("*", { count: "exact", head: true })
  .eq("agent_id", userId)
  .gte("created_at", startOfDay)
  .lte("created_at", endOfDay);
```

### **Filters:**
1. `agent_id` matches current user's UID ✅
2. `created_at` >= start of today (00:00:00) ✅
3. `created_at` <= end of today (23:59:59) ✅

### **Result:**
Returns count of messages sent by THIS agent TODAY only.

---

## 🔧 Configuration

### **Change Webhook URL:**
Edit `/src/app/WhatsAppSender.tsx`:
```javascript
const WEBHOOK_URL = "YOUR_WEBHOOK_URL_HERE";
```

### **Change WhatsApp Numbers:**
Edit `/src/app/WhatsAppSender.tsx`:
```javascript
const SALES_AGENTS = [
  {
    value: "918679009323",
    label: "QHT Mediways Pvt Ltd.- 918679009323",
    phone: "918679009323",
  },
  // Add more...
];
```

---

## 🎨 UI Components

### **Login Page:**
- QHT logo (100px × 100px)
- Email input
- Password input
- Login button with loading state
- Clean green color scheme (#5a8f5c)

### **Dashboard:**
- Personalized welcome message
- Today's Stats button (opens modal)
- Logout button
- 3-column grid layout:
  - Left: Message form
  - Center: Quick templates
  - Right: Image templates
- Bottom: Live image preview

### **Stats Modal:**
- Gradient green background
- Large number display
- Close button
- Click outside to close

---

## ⚠️ Important Notes

### **1. UID Mapping:**
The `id` in `agent_profile_password` MUST match the `id` in `auth.users`.

**Correct:**
```
auth.users.id: abc123-def456-...
agent_profile_password.id: abc123-def456-...  ✅
```

**Wrong:**
```
auth.users.id: abc123-def456-...
agent_profile_password.id: xyz789-...  ❌ (Profile fetch will fail)
```

### **2. Session Persistence:**
Session is stored in `localStorage` by Supabase.  
User stays logged in across browser refreshes.

### **3. Agent ID:**
No longer hardcoded! Each agent logs their own messages with their unique UID.

### **4. Role Field:**
The `role` field is fetched and logged to console but NOT used for routing or permissions in this implementation. All logged-in users see the same dashboard.

### **5. RLS (Row Level Security):**
You may want to add RLS policies:

```sql
-- Allow agents to insert their own messages
CREATE POLICY "Agents can insert own messages"
ON message_logs FOR INSERT
WITH CHECK (auth.uid() = agent_id);

-- Allow agents to read their own messages
CREATE POLICY "Agents can read own messages"
ON message_logs FOR SELECT
USING (auth.uid() = agent_id);

-- Allow agents to read their own profile
CREATE POLICY "Users can read own profile"
ON agent_profile_password FOR SELECT
USING (auth.uid() = id);
```

**Or disable RLS for testing:**
```sql
ALTER TABLE message_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_profile_password DISABLE ROW LEVEL SECURITY;
```

---

## 🐛 Error Handling

### **Login Errors:**
- "Please enter email and password" → Empty fields
- "Invalid email or password" → Wrong credentials
- Clean red toast notifications

### **Profile Fetch Errors:**
- If `agent_profile_password.id` doesn't match UID:
  - Logs error to console
  - Falls back to "Agent" as display name
  - Dashboard still loads

### **Database Errors:**
- Logs detailed error to console
- Shows toast: "Database logging failed: [error]"
- Still shows webhook success message
- Does NOT block message sending

### **Network Errors:**
- Logs to console
- Shows toast: "Error: Network error occurred"
- User can retry

---

## 📂 Project Structure

```
/src/app/
  ├── App.tsx                  # Session check & routing
  ├── Login.tsx                # Login page
  ├── WhatsAppSender.tsx       # Main dashboard
  └── components/
      ├── FormInput.tsx        # Input component
      ├── FormTextarea.tsx     # Textarea component
      ├── FormSelect.tsx       # Select dropdown
      ├── Alert.tsx            # Success/error alerts
      ├── LoadingSpinner.tsx   # Loading animation
      ├── QuickTemplates.tsx   # Text templates
      ├── ImageTemplates.tsx   # Image templates
      └── ImagePreview.tsx     # Live image preview
```

---

## 🔄 Data Flow

### **On App Load:**
```
1. App.tsx checks session
2. If session exists:
   - Set session state
   - Render WhatsAppSender
3. If no session:
   - Render Login
```

### **On Login:**
```
1. User submits email/password
2. Call supabase.auth.signInWithPassword()
3. If success:
   - Session created with UID
   - App.tsx detects session change
   - Renders WhatsAppSender
4. WhatsAppSender useEffect runs:
   - Fetch user.id from session
   - Query agent_profile_password WHERE id = user.id
   - Fetch name and role
   - Set agentName state
   - Fetch today's message count
   - Display dashboard
```

### **On Send Message:**
```
1. Validate form
2. Send to webhook
3. If webhook success:
   - Insert to message_logs with:
     - agent_id = user.id
     - used_number = selected dropdown value
     - all other fields
4. If database success:
   - Show success toast
   - Refresh today's count
   - Clear form
```

### **On Logout:**
```
1. Call supabase.auth.signOut()
2. Session cleared
3. App.tsx detects session change
4. Renders Login page
```

---

## ✅ Checklist

Before deploying, ensure:

- [ ] Supabase project is NOT paused
- [ ] `agent_profile_password` table exists with `name` and `role` columns
- [ ] `message_logs` table exists with `used_number` column
- [ ] Email confirmation is disabled in Supabase settings
- [ ] At least one test agent is created
- [ ] **`agent_profile_password.id` matches `auth.users.id`** ← CRITICAL
- [ ] RLS policies are configured (or disabled for testing)
- [ ] Webhook URL is correct
- [ ] WhatsApp numbers are up to date

---

## 🚀 Deployment

No special setup needed. Just deploy and it works.

**Environment Variables Required:**
- `VITE_SUPABASE_URL` (from Supabase project settings)
- `VITE_SUPABASE_ANON_KEY` (from Supabase project settings)

---

## 📊 Console Output

### **Successful Login:**
```
Attempting login...
✅ Login successful!
Fetching agent data...
User ID: abc123-def456-...
Fetching agent profile from agent_profile_password...
Agent logged in: Test Agent | Role: agent
Fetching today's count...
Today's count: 0
```

### **Successful Message Send:**
```
📤 Sending Payload: {
  "leadId": "TEST123",
  "agentPhone": "918679009323",
  "customerName": "John Doe",
  "customerPhone": "+919876543210",
  "message": "Hello! Welcome...",
  "imageUrl": ""
}
📥 Response Status: 200
✅ Response Data: {...}
📝 Logging to database: {
  agent_id: "abc123-def456-...",
  lead_id: "TEST123",
  customer_phone: "+919876543210",
  customer_name: "John Doe",
  template_type: "quick",
  message_content: "Hello! Welcome...",
  image_url: null,
  used_number: "918679009323"
}
✅ Message logged successfully
Refreshing today's count...
Today's count: 1
```

### **Today's Stats Click:**
```
Opening stats modal...
Fetching today's count...
Query: agent_id = abc123-def456-...
Date range: 2026-02-25T00:00:00 to 2026-02-25T23:59:59
Today's count: 5
```

---

## 🎯 Summary

**What This System Provides:**
1. ✅ Clean Supabase Auth login
2. ✅ UID mapping to `agent_profile_password.id`
3. ✅ Personalized agent dashboard with name from `agent_profile_password`
4. ✅ Today's message count feature
5. ✅ Proper agent_id logging (from session)
6. ✅ used_number capture (from UI)
7. ✅ Full webhook integration
8. ✅ Professional error handling
9. ✅ Session persistence
10. ✅ Logout functionality

**What's Removed:**
- ❌ Demo mode
- ❌ Server status checks
- ❌ Complex error overlays
- ❌ Hardcoded agent IDs
- ❌ Admin panel
- ❌ `profiles` table (replaced with `agent_profile_password`)

**Database Schema Change:**
- ❌ Old: `profiles` table
- ✅ New: `agent_profile_password` table

**Use Case:**
Production-ready WhatsApp message sender for QHT Clinic agents with proper authentication, session management, and daily statistics tracking using the `agent_profile_password` schema.

---

**Created:** February 25, 2026  
**Version:** 71 (agent_profile_password Schema)  
**Status:** ✅ Production Ready  
**Authentication:** Supabase Auth  
**Profile Table:** agent_profile_password  
**Database:** Fully Integrated  
**Stats:** Today's Count Working
