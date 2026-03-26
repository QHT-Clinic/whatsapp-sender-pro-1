# 🔧 Network Error Diagnostic Guide

## ❌ Error: "Failed to fetch"

This error means the browser cannot reach Supabase servers.

---

## 🔍 Quick Checks

### **1. Check Supabase Project Status**

**Go to:** https://supabase.com/dashboard

**Verify:**
- ✅ Project is **ACTIVE** (not paused)
- ✅ Project status shows **GREEN**
- ✅ No maintenance alerts

**If paused:**
1. Click on your project
2. Click "Restore" or "Resume"
3. Wait 2-3 minutes for project to start
4. Try login again

---

### **2. Verify Internet Connection**

**Test connectivity:**
```bash
# In browser console (F12):
fetch('https://www.google.com')
  .then(() => console.log('✅ Internet OK'))
  .catch(() => console.error('❌ No Internet'));
```

**Or:**
- Open any website (google.com)
- If it loads → Internet is OK
- If not → Check WiFi/Network

---

### **3. Test Supabase URL Directly**

**Copy this URL and open in browser:**
```
https://zqcspamakvfzvlqbunit.supabase.co
```

**Expected Response:**
```json
{"msg":"ok"}
```

**If you get:**
- ✅ `{"msg":"ok"}` → Supabase is reachable
- ❌ "Cannot reach this page" → Network/DNS issue
- ❌ "404 Not Found" → Project doesn't exist
- ❌ "Project paused" → Resume project in dashboard

---

### **4. Check Browser Console**

**Open Console (F12) and look for:**

**✅ Success (should see):**
```
🔧 Initializing Supabase Client...
📍 Supabase URL: https://zqcspamakvfzvlqbunit.supabase.co
✅ Supabase client initialized successfully
```

**❌ Error (might see):**
```
❌ CRITICAL: Supabase credentials missing!
❌ Network Error: Failed to fetch
❌ CORS error
```

---

## 🛠️ Solutions

### **Solution 1: Resume Paused Project**

**If Supabase project is paused:**

1. **Dashboard:** https://supabase.com/dashboard
2. Click on **"zqcspamakvfzvlqbunit"** project
3. Look for **"Resume"** or **"Restore"** button
4. Click it
5. Wait **2-3 minutes**
6. Refresh your app
7. Try login again

---

### **Solution 2: Clear Browser Cache**

**Sometimes cached network errors cause this:**

1. **Chrome/Edge:**
   - Press `Ctrl + Shift + Delete`
   - Select "Cached images and files"
   - Click "Clear data"

2. **Firefox:**
   - Press `Ctrl + Shift + Delete`
   - Select "Cache"
   - Click "Clear Now"

3. **After clearing:**
   - Close browser completely
   - Reopen and try again

---

### **Solution 3: Try Different Network**

**Test if it's a network restriction:**

1. **Mobile Hotspot:**
   - Enable hotspot on phone
   - Connect laptop to hotspot
   - Try login again

2. **Different WiFi:**
   - Connect to different network
   - Try login again

3. **If it works on different network:**
   - Your office/home network is blocking Supabase
   - Contact network admin
   - Or use VPN

---

### **Solution 4: Disable Browser Extensions**

**Some extensions block requests:**

1. **Open Incognito/Private window**
   - Chrome: `Ctrl + Shift + N`
   - Firefox: `Ctrl + Shift + P`

2. **Try login in incognito**

3. **If it works:**
   - An extension is blocking requests
   - Disable extensions one by one
   - Find the culprit

**Common blockers:**
- Ad blockers
- Privacy extensions
- VPN extensions
- Firewall extensions

---

### **Solution 5: Check Firewall/Antivirus**

**Corporate firewall might block Supabase:**

1. **Whitelist these domains:**
   ```
   *.supabase.co
   *.supabase.io
   zqcspamakvfzvlqbunit.supabase.co
   ```

2. **Or temporarily disable:**
   - Windows Defender
   - Corporate firewall
   - Antivirus software

3. **Test login**

4. **If it works:**
   - Add Supabase to whitelist permanently

---

### **Solution 6: Verify Supabase Credentials**

**Check if credentials are correct:**

**Run in browser console (F12):**
```javascript
// Check what the app is using
console.log("Project ID:", "zqcspamakvfzvlqbunit");
console.log("URL:", `https://zqcspamakvfzvlqbunit.supabase.co`);

// Test the URL
fetch('https://zqcspamakvfzvlqbunit.supabase.co')
  .then(res => res.json())
  .then(data => console.log('✅ Supabase Response:', data))
  .catch(err => console.error('❌ Error:', err.message));
```

**Expected output:**
```
✅ Supabase Response: {msg: "ok"}
```

---

### **Solution 7: DNS Issue**

**Sometimes DNS can't resolve Supabase domain:**

**Windows:**
```cmd
# Flush DNS
ipconfig /flushdns

# Use Google DNS
# Control Panel → Network → Change adapter settings
# Right-click WiFi → Properties → IPv4 → Properties
# Set DNS to: 8.8.8.8 and 8.8.4.4
```

**Mac:**
```bash
# Flush DNS
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

**Linux:**
```bash
# Flush DNS
sudo systemd-resolve --flush-caches
```

---

## 📊 Diagnostic Checklist

Run through this checklist:

- [ ] **Supabase project is active** (not paused)
- [ ] **Internet connection works** (can access google.com)
- [ ] **Supabase URL loads** (https://zqcspamakvfzvlqbunit.supabase.co shows "ok")
- [ ] **Browser console shows no CORS errors**
- [ ] **Tried in incognito mode**
- [ ] **Cleared browser cache**
- [ ] **No VPN/Proxy blocking**
- [ ] **Firewall not blocking Supabase**

---

## 🆘 Advanced Debugging

### **Test 1: Network Tab**

1. **Open DevTools (F12)**
2. **Go to "Network" tab**
3. **Try to login**
4. **Look for failed requests**

**Red/failed requests indicate:**
- URL is wrong
- CORS issue
- Network blocked
- Server down

**Check:**
- Request URL (should be `https://zqcspamakvfzvlqbunit.supabase.co/auth/v1/token...`)
- Status code:
  - `0` = Network error
  - `404` = Wrong URL
  - `403` = CORS/Permission
  - `500` = Server error

---

### **Test 2: CURL Test**

**Open terminal/command prompt:**

```bash
curl https://zqcspamakvfzvlqbunit.supabase.co
```

**Expected:**
```
{"msg":"ok"}
```

**If you get error:**
- `Could not resolve host` → DNS issue
- `Connection refused` → Network blocking
- `Timeout` → Firewall

---

### **Test 3: Ping Test**

```bash
ping zqcspamakvfzvlqbunit.supabase.co
```

**Expected:**
```
Reply from 104.xxx.xxx.xxx: bytes=32 time=50ms
```

**If you get:**
- `Request timed out` → Network issue
- `Could not find host` → DNS issue

---

## 📞 Still Not Working?

### **Collect This Information:**

1. **Browser Console Output:**
   ```
   Open Console (F12)
   Copy ALL the red errors
   ```

2. **Network Tab Screenshot:**
   ```
   DevTools → Network tab
   Try login
   Screenshot the failed requests
   ```

3. **Supabase Project Status:**
   ```
   https://supabase.com/dashboard
   Is project Active or Paused?
   Screenshot the status
   ```

4. **Test Results:**
   ```bash
   # Run and share output:
   curl https://zqcspamakvfzvlqbunit.supabase.co
   ping zqcspamakvfzvlqbunit.supabase.co
   ```

5. **Environment:**
   - Operating System: (Windows/Mac/Linux)
   - Browser: (Chrome/Firefox/Edge)
   - Browser Version:
   - Network: (Office/Home/Mobile)

---

## ✅ Quick Fix Summary

**Most common cause:** Supabase project is paused

**Fix:**
1. Go to https://supabase.com/dashboard
2. Click your project
3. Resume/Restore it
4. Wait 2-3 minutes
5. Try again

**If that doesn't work:**
1. Clear browser cache
2. Try incognito mode
3. Try different network
4. Check firewall settings

---

## 🎯 Success Indicators

You'll know it's fixed when:

- ✅ Console shows "✅ Supabase client initialized successfully"
- ✅ No "Failed to fetch" errors
- ✅ Login attempt progresses past authentication
- ✅ Network tab shows successful requests (green, status 200)

---

**Last Updated:** February 25, 2026  
**Error:** AuthRetryableFetchError: Failed to fetch  
**Status Code:** 0
