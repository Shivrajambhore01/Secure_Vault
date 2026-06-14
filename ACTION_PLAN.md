# SecureVault - Action Plan

**Date**: June 14, 2026  
**Status**: Ready for Implementation

---

## 🎯 YOUR NEXT STEPS (In Order)

### Step 1: Fix Google OAuth (5 minutes) - REQUIRED

**What**: Configure Google Cloud Console to allow your localhost origins

**Why**: Currently getting 403 error blocking Google Sign-In

**How**:
1. Open: https://console.cloud.google.com/
2. Go to: **APIs & Services** → **Credentials**
3. Click: OAuth 2.0 Client ID `885886548234-as2p0jqnrsciat2o8lafkgaeir11ausa`
4. Add to **Authorized JavaScript origins**:
   ```
   http://localhost:3000
   http://127.0.0.1:3000
   ```
5. Add to **Authorized redirect URIs**:
   ```
   http://localhost:3000
   http://localhost:3000/login
   http://localhost:3000/signup
   ```
6. Click **Save**
7. ⏰ Wait 5-10 minutes for propagation

**Test**:
- Open http://localhost:3000/login
- Click "Sign in with Google"
- Should open Google login (not 403 error)

---

### Step 2: Restart Servers (2 minutes)

**Backend**:
```bash
# Navigate to backend
cd backend

# Stop current server (Ctrl+C)

# Start with new configuration
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend**:
```bash
# Navigate to frontend
cd frontend

# Stop current server (Ctrl+C)

# Start fresh
npm run dev
```

**Verify**:
- Backend: http://localhost:8000/docs
- Frontend: http://localhost:3000

---

### Step 3: Test Authentication (10 minutes)

**Test 1: Regular Signup**
1. Go to http://localhost:3000/signup
2. Enter test data:
   - Full Name: Test User
   - Email: test@example.com
   - Phone: +1234567890
   - DOB: 1990-01-01
   - Password: TestPass123!
   - Confirm Password: TestPass123!
3. Click Continue
4. Enter OTP from email (or check backend logs in dev mode)
5. Create 4-digit PIN
6. Should redirect to complete profile or dashboard
7. ✅ SUCCESS if you see dashboard

**Test 2: Regular Login**
1. Go to http://localhost:3000/login
2. Enter:
   - Email: test@example.com
   - Password: TestPass123!
3. Click Login
4. Should redirect to dashboard
5. ✅ SUCCESS if logged in without errors

**Test 3: Google OAuth** (after Step 1 propagates)
1. Go to http://localhost:3000/login
2. Click "Sign in with Google"
3. Choose Google account
4. Should redirect to dashboard
5. ✅ SUCCESS if logged in via Google

**Test 4: Session Persistence**
1. Login successfully
2. Refresh page (F5)
3. Should remain logged in
4. ✅ SUCCESS if still on dashboard

**Test 5: Session Timeout**
1. Login successfully
2. Open browser dev tools → Console
3. Wait 60 minutes OR manually test:
   ```javascript
   // In console, trigger logout manually
   localStorage.clear()
   location.reload()
   ```
4. Should show session expired message
5. ✅ SUCCESS if redirected to login

---

### Step 4: Security Hardening (Optional but Recommended)

These are not required for basic functionality but highly recommended for production.

**4A: Implement Token Blacklist (1 hour)**
- Prevents token reuse after logout
- See: `AUTHENTICATION_ERRORS_AND_FIXES.md` Section 6
- Priority: HIGH

**4B: Add Rate Limiting (1 hour)**
- Prevents brute force attacks
- See: `AUTHENTICATION_ERRORS_AND_FIXES.md` Section 9
- Priority: HIGH

**4C: Add CSRF Tokens (2 hours)**
- Prevents cross-site request forgery
- See: `AUTHENTICATION_ERRORS_AND_FIXES.md` Section 8
- Priority: MEDIUM

---

## 📋 VERIFICATION CHECKLIST

After completing steps 1-3:

### Backend Health
- [ ] Server starts without errors
- [ ] Can access API docs at http://localhost:8000/docs
- [ ] MongoDB connection successful (check logs)
- [ ] No JWT_SECRET errors in logs

### Frontend Health
- [ ] Server starts without errors
- [ ] Can access homepage at http://localhost:3000
- [ ] No console errors on page load
- [ ] Google OAuth provider loads

### Authentication Flows
- [ ] Signup flow works end-to-end
- [ ] Login flow works with correct credentials
- [ ] Login rejects incorrect credentials
- [ ] Google OAuth redirects to Google login
- [ ] Session persists on page refresh
- [ ] Logout clears session properly

### Session Management
- [ ] Access token expires after 60 minutes
- [ ] Refresh token works automatically
- [ ] Heartbeat requests every 30 seconds
- [ ] Session timeout after inactivity

### No Errors
- [ ] No 403 errors in console
- [ ] No "session expired" popup on fresh login
- [ ] No infinite redirect loops
- [ ] No CORS errors

---

## 🐛 TROUBLESHOOTING

### Problem: Backend won't start

**Error**: `pydantic_core._pydantic_core.ValidationError: 1 validation error for Settings`

**Solution**:
```bash
# Check .env exists
ls backend/.env

# If missing, copy from example
cp backend/.env.example backend/.env

# Edit and add your values
```

---

### Problem: "JWT_SECRET is required"

**Error**: Backend crashes on startup

**Solution**:
```bash
# Add to backend/.env
echo 'JWT_SECRET="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"' >> backend/.env

# Restart backend
```

---

### Problem: Google OAuth still shows 403

**Possible causes**:
1. **Changes not propagated yet** → Wait 10 minutes
2. **Wrong origin configured** → Check exact URL in console error
3. **Browser cache** → Try incognito mode
4. **Client ID mismatch** → Verify .env.local has correct ID

**Debug**:
```bash
# Check frontend .env
grep GOOGLE_CLIENT_ID frontend/.env.local

# Should output:
# NEXT_PUBLIC_GOOGLE_CLIENT_ID="885886548234-as2p0jqnrsciat2o8lafkgaeir11ausa.apps.googleusercontent.com"
```

---

### Problem: "Session expired" popup immediately

**Cause**: Old code cached in browser

**Solution**:
```bash
# Hard refresh
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)

# Or clear cache
# Chrome: Ctrl+Shift+Delete → Clear browsing data
```

---

### Problem: Can't connect to MongoDB

**Error**: `Failed to connect to MongoDB Atlas`

**Solution**:
```bash
# Test connection
mongosh "mongodb+srv://shivrajambhore01_db_user:MF1Jh5NjiMHSonuT@cluster0.1xzzedg.mongodb.net/"

# If fails, check:
# 1. MongoDB Atlas IP whitelist (add 0.0.0.0/0 for testing)
# 2. Correct username/password
# 3. Network connectivity
```

---

### Problem: OTP email not received

**Possible causes**:
1. **Gmail app password incorrect** → Regenerate in Google Account
2. **SMTP blocked by firewall** → Check port 587
3. **Dev mode enabled** → Check backend logs for OTP

**Solution**:
```bash
# Check backend logs for:
[DEV MODE] Would send email to test@example.com: Your OTP is 123456

# If in dev mode, OTP is printed in backend console
```

---

## 📊 SUCCESS METRICS

You'll know everything is working when:

✅ **No errors in browser console**  
✅ **No errors in backend logs**  
✅ **Can signup with email**  
✅ **Can login with email**  
✅ **Can login with Google**  
✅ **Session persists on refresh**  
✅ **Session expires after 60 minutes**  
✅ **Dashboard loads after login**  
✅ **Can logout successfully**

---

## 🚀 WHAT'S NEXT?

Once everything is working:

### For Development
1. Continue building features
2. Add unit tests
3. Implement security hardening (Step 4)
4. Add error monitoring

### For Production
1. Complete security hardening
2. Set up production environment
3. Configure production domains in Google OAuth
4. Enable HTTPS
5. Set up monitoring and logging
6. Perform security audit
7. Deploy!

---

## 📚 HELPFUL COMMANDS

### Backend
```bash
# Start backend
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Check logs
# Just watch the terminal output

# Test API
curl http://localhost:8000/docs
```

### Frontend
```bash
# Start frontend
cd frontend
npm run dev

# Clear cache and reinstall
rm -rf .next node_modules
npm install
npm run dev
```

### Database
```bash
# Connect to MongoDB
mongosh "mongodb+srv://shivrajambhore01_db_user:MF1Jh5NjiMHSonuT@cluster0.1xzzedg.mongodb.net/"

# List databases
show dbs

# Use securevault
use securevault

# List collections
show collections

# Query users
db.users.find().pretty()
```

### Testing
```bash
# Test backend health
curl http://localhost:8000/docs

# Test frontend health
curl http://localhost:3000

# Test auth endpoint
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}'
```

---

## 💡 PRO TIPS

1. **Always use incognito mode** when testing auth changes
2. **Check both browser console AND backend logs** for errors
3. **Clear cookies between tests** to avoid cached sessions
4. **Use strong passwords** even in development
5. **Keep .env files secure** - never commit to git
6. **Document any custom changes** you make
7. **Test on multiple browsers** before deploying
8. **Use environment-specific configs** (dev vs prod)

---

## 🆘 NEED HELP?

### Documentation Files
1. **QUICK_FIX_GUIDE.md** - Immediate problem solving
2. **AUTHENTICATION_ERRORS_AND_FIXES.md** - Detailed fixes
3. **PROJECT_ANALYSIS_SUMMARY.md** - Complete analysis
4. **ACTION_PLAN.md** - This file

### Logs to Check
1. **Backend console** - Server errors, JWT issues
2. **Browser console** - Frontend errors, network issues
3. **Network tab** - API requests/responses
4. **Application tab** - Cookies, localStorage

### Common Commands
```bash
# Restart everything
Ctrl+C in both terminals
cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
cd frontend && npm run dev

# Clear everything
rm -rf backend/__pycache__ backend/app/__pycache__
rm -rf frontend/.next frontend/node_modules
npm install
```

---

## ✨ FINAL NOTES

Your authentication system is now:
- ✅ More secure (strong JWT secret)
- ✅ More stable (fixed race condition)
- ✅ Better UX (60-minute session timeout)
- ✅ Well documented (4 comprehensive guides)

**Still needs**:
- ⚠️ Google OAuth origin configuration (manual, 5 minutes)
- ⚠️ Optional security hardening (recommended, 4 hours)

**You're ready to**:
- ✅ Test the complete authentication flow
- ✅ Continue feature development
- ✅ Prepare for production deployment

---

**Good luck! 🚀**

Generated: June 14, 2026
