# Quick Fix Guide - Critical Issues

## ⚡ IMMEDIATE FIXES (Do These Now)

### 1. Fix Google OAuth 403 Error (5 minutes)

**Problem**: "The given origin is not allowed for the given client ID"

**Solution**:
1. Go to: https://console.cloud.google.com/
2. Navigate to: **APIs & Services** → **Credentials**
3. Click on OAuth 2.0 Client ID: `885886548234-as2p0jqnrsciat2o8lafkgaeir11ausa`
4. Under **Authorized JavaScript origins**, add:
   ```
   http://localhost:3000
   http://127.0.0.1:3000
   ```
5. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:3000
   http://localhost:3000/login
   http://localhost:3000/signup
   ```
6. Click **Save**
7. Wait 5-10 minutes for changes to propagate
8. Clear browser cache and try again

---

### 2. Restart Both Servers (2 minutes)

**Backend**:
```bash
cd backend
# Stop the server (Ctrl+C if running)
# Start it again
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend**:
```bash
cd frontend
# Stop the server (Ctrl+C if running)
# Start it again
npm run dev
```

---

### 3. Test Authentication Flow (5 minutes)

**Test 1: Regular Signup**
1. Go to: http://localhost:3000/signup
2. Fill in all fields with valid data
3. Submit and check for OTP email
4. Complete the flow

**Test 2: Google OAuth**
1. Go to: http://localhost:3000/login
2. Click "Sign in with Google"
3. Should redirect to Google login
4. After authentication, should redirect back to dashboard

**Test 3: Regular Login**
1. Go to: http://localhost:3000/login
2. Enter email and password
3. Should login successfully
4. Check session persists on page refresh

**Test 4: Session Timeout**
1. Login successfully
2. Wait 60 minutes OR
3. Manually test by advancing system clock
4. Should show session expired message

---

## 🔧 WHAT WAS FIXED

### ✅ Session Timeout Issue
- **Before**: 15 minutes
- **After**: 60 minutes
- **File**: `frontend/components/auth/session-timeout-tracker.tsx`

### ✅ Token Refresh Race Condition
- **Before**: Multiple simultaneous refresh attempts
- **After**: Mutex lock prevents race conditions
- **File**: `frontend/lib/api.ts`

### ✅ JWT Secret Configuration
- **Before**: Weak fallback secret
- **After**: Strong 64-character secret required
- **File**: `backend/app/core/config.py` and `backend/.env`

### ✅ Token Expiry Configuration
- **Before**: 24 hours (too long)
- **After**: 60 minutes (more secure)
- **File**: `backend/.env`

### ✅ Environment File Security
- **Created**: `.env.example` files for both frontend and backend
- **Action**: Share example files, never commit actual .env files

---

## 🚨 STILL NEEDS MANUAL FIX

### Google Cloud Console Configuration
You MUST manually configure Google OAuth origins:
1. This cannot be automated
2. Takes 5-10 minutes for changes to propagate
3. Required for Google Sign-In to work

---

## 📋 VERIFICATION CHECKLIST

After fixes:
- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Can access http://localhost:3000
- [ ] Can access http://localhost:8000/docs (API docs)
- [ ] Regular signup works
- [ ] Regular login works
- [ ] Session persists on refresh
- [ ] Session expires after 60 minutes
- [ ] Google OAuth works (after Cloud Console fix)
- [ ] No console errors related to authentication

---

## 🐛 DEBUGGING

### If Backend Won't Start

**Error**: "JWT_SECRET is required"
```bash
# Check .env file exists
ls backend/.env

# Verify JWT_SECRET is set
grep JWT_SECRET backend/.env

# If missing, add it:
echo 'JWT_SECRET="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"' >> backend/.env
```

### If Frontend Shows Errors

**Error**: "Cannot connect to backend"
```bash
# Check backend is running
curl http://localhost:8000/docs

# If not running, start it:
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### If Google OAuth Still Fails

**Error**: "403 Origin not allowed"
```bash
# Check Google Client ID is set
grep GOOGLE_CLIENT_ID frontend/.env.local

# Check Google Cloud Console:
# 1. Origins must include http://localhost:3000
# 2. Wait 5-10 minutes after saving
# 3. Clear browser cache
# 4. Try incognito mode
```

### If Session Expires Too Quickly

**Check**: Session timeout setting
```bash
# Should show 60 * 60 * 1000
grep SESSION_TIMEOUT_MS frontend/components/auth/session-timeout-tracker.tsx
```

---

## 📝 NEXT STEPS

After these immediate fixes work:

1. **Security**: Remove .env files from git history (if committed)
2. **Rate Limiting**: Add rate limiting to prevent brute force
3. **Token Blacklist**: Implement proper logout token invalidation
4. **CSRF Protection**: Add CSRF tokens for form submissions
5. **Monitoring**: Set up error logging and monitoring

See `AUTHENTICATION_ERRORS_AND_FIXES.md` for complete details.

---

## 💡 TIPS

1. **Always use incognito/private mode** when testing authentication changes
2. **Clear cookies between tests** to avoid cached session issues
3. **Check browser console** for detailed error messages
4. **Check backend logs** for server-side errors
5. **Test on different browsers** to catch browser-specific issues

---

## 🆘 STILL HAVING ISSUES?

**Check these in order**:
1. Backend is running on port 8000
2. Frontend is running on port 3000
3. MongoDB connection is working
4. .env files exist in both backend and frontend
5. Google Cloud Console origins are configured
6. Browser cache is cleared
7. No firewall blocking localhost ports

**Get detailed logs**:
```bash
# Backend logs (verbose)
cd backend
uvicorn app.main:app --reload --log-level debug

# Frontend logs
cd frontend
npm run dev
# Check browser console
```

---

Generated: June 14, 2026
