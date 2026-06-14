# SecureVault Authentication - Complete Error Analysis & Fixes

## 🔴 CRITICAL ERRORS

### 1. **Google OAuth 403 Error - "Origin not allowed"**
**Location**: Browser Console  
**Error Message**: `Failed to load resource: the server responded with a status of 403 () [GSI_LOGGER]: The given origin is not allowed for the given client ID`

**Root Cause**:
- Google Cloud Console OAuth2 client is not configured to allow your current origin
- Missing authorized JavaScript origins for localhost

**Fix**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Find OAuth 2.0 Client ID: `885886548234-as2p0jqnrsciat2o8lafkgaeir11ausa`
4. Add these **Authorized JavaScript origins**:
   ```
   http://localhost:3000
   http://127.0.0.1:3000
   http://localhost:8000
   ```
5. Add these **Authorized redirect URIs**:
   ```
   http://localhost:3000
   http://localhost:3000/login
   http://localhost:3000/signup
   http://localhost:3000/auth/callback
   ```
6. Click **Save** and wait 5-10 minutes for propagation

---

### 2. **Session Expired Popup Appearing Prematurely**
**Location**: `frontend/components/auth/session-timeout-tracker.tsx`  
**Error**: Users getting logged out after short inactivity

**Root Cause**:
- Frontend session timeout was 15 minutes
- Backend token expiry was 24 hours
- Mismatch caused premature logout

**Status**: ✅ FIXED (Changed to 60 minutes)

**Verification**:
```typescript
const SESSION_TIMEOUT_MS = 60 * 60 * 1000 // 60 minutes (1 hour)
```

---

### 3. **Exposed Sensitive Credentials in .env Files**
**Location**: `backend/.env` and `frontend/.env.local`  
**Severity**: CRITICAL SECURITY RISK

**Exposed Credentials**:
- MongoDB URI with username/password
- Twilio Account SID and Auth Token
- Gmail app password
- JWT secrets
- Google OAuth Client ID

**Fix Required**:
```bash
# 1. Add .env to .gitignore (if not already)
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore

# 2. Remove from git history
git rm --cached backend/.env
git rm --cached frontend/.env.local
git commit -m "Remove sensitive environment files"

# 3. Create .env.example files with placeholder values
```

**Create** `backend/.env.example`:
```env
MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/"
ENCRYPTION_KEY="your_32_character_encryption_key"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your_app_password"
TWILIO_ACCOUNT_SID="your_account_sid"
TWILIO_AUTH_TOKEN="your_auth_token"
TWILIO_FLOW_SID="your_flow_sid"
TWILIO_PHONE_NUMBER="+1234567890"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your_client_id"
JWT_SECRET="your_jwt_secret_key"
ACCESS_TOKEN_EXPIRY_MINUTES=60
REFRESH_TOKEN_EXPIRY_DAYS=7
```

---

### 4. **Weak JWT Secret Configuration**
**Location**: `backend/app/core/config.py` (line 33)

**Issue**:
```python
JWT_SECRET: str = "fallback_secret_for_dev_only"  # ❌ INSECURE
```

**Fix**:
```python
JWT_SECRET: str = Field(..., description="JWT signing secret")  # Required field
```

**Update `.env`**:
```env
JWT_SECRET="your_strong_random_secret_at_least_32_chars_long_12345678"
```

**Generate Strong Secret**:
```python
import secrets
print(secrets.token_hex(32))  # 64-character hex string
```

---

## 🟡 HIGH PRIORITY ERRORS

### 5. **Dual State Management (Backend Cookies + Frontend LocalStorage)**
**Location**: `frontend/lib/store.ts` + Backend cookies

**Issue**:
- Authentication state stored in BOTH HTTP-only cookies AND localStorage
- Client can manipulate localStorage to appear logged in
- State desynchronization possible

**Current Flow**:
```
Backend: Set HTTP-only cookies with JWT
Frontend: ALSO stores user data in localStorage
Problem: localStorage can be manipulated, cookies can't
```

**Fix Strategy**: Remove dependency on localStorage for auth state

**Update** `frontend/lib/api.ts`:
```typescript
// Remove all localStorage auth checks
// Rely solely on cookie-based authentication
// Backend will return 401 if session invalid

export async function secureFetch(endpoint: string, options: RequestInit = {}) {
    const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`

    const defaultOptions: RequestInit = {
        ...options,
        credentials: "include", // ✅ Keep this - sends cookies
        headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            ...options.headers,
        },
    }

    try {
        let response = await fetch(url, defaultOptions)

        // Handle 401 - token expired
        if (response.status === 401 && !endpoint.includes('/auth/refresh-token')) {
            const refreshResponse = await fetch(`${BASE_URL}/auth/refresh-token`, {
                method: "POST",
                credentials: "include",
            })

            if (refreshResponse.ok) {
                response = await fetch(url, defaultOptions)
            } else {
                // Session truly expired
                if (typeof window !== "undefined") {
                    window.location.href = "/login"
                }
                throw new Error("Session expired")
            }
        }

        return response
    } catch (error) {
        console.error("API Fetch Error:", error)
        throw error
    }
}
```

---

### 6. **Missing Token Invalidation on Logout**
**Location**: `backend/app/api/auth.py` (logout endpoint)

**Issue**:
- Logout only deletes cookies
- JWT tokens remain valid until expiry (60 minutes)
- Tokens can be reused if intercepted

**Current Implementation**:
```python
@router.post("/logout")
async def logout(response: Response, current_user: dict = Depends(get_current_user)):
    # ❌ Only deletes cookies, doesn't invalidate token
    response.delete_cookie("accessToken")
    response.delete_cookie("refreshToken")
    return {"message": "Logged out successfully"}
```

**Solution 1**: Token Blacklist (Recommended for small scale)
```python
# Add to database
token_blacklist_col = db["token_blacklist"]

@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["userId"]
    
    # Get the token from cookie
    access_token = request.cookies.get("accessToken")
    refresh_token = request.cookies.get("refreshToken")
    
    # Blacklist both tokens
    if access_token:
        decoded = decode_token(access_token)
        await token_blacklist_col.insert_one({
            "token": access_token,
            "userId": user_id,
            "expiresAt": datetime.fromtimestamp(decoded["exp"], tz=timezone.utc),
            "blacklistedAt": datetime.now(timezone.utc)
        })
    
    if refresh_token:
        decoded = decode_token(refresh_token)
        await token_blacklist_col.insert_one({
            "token": refresh_token,
            "userId": user_id,
            "expiresAt": datetime.fromtimestamp(decoded["exp"], tz=timezone.utc),
            "blacklistedAt": datetime.now(timezone.utc)
        })
    
    # Update user logout time
    await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"logoutTime": datetime.now(timezone.utc).isoformat()}}
    )
    
    response.delete_cookie("accessToken")
    response.delete_cookie("refreshToken")
    return {"message": "Logged out successfully"}
```

**Update `get_current_user` in `backend/app/core/security.py`**:
```python
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("accessToken")
    if not token:
        raise HTTPException(status_code=401, detail="Access denied. No token provided.")

    try:
        decoded = decode_token(token)
        
        # ✅ Check if token is blacklisted
        from app.core.database import db
        token_blacklist_col = db["token_blacklist"]
        blacklisted = await token_blacklist_col.find_one({"token": token})
        if blacklisted:
            raise HTTPException(status_code=401, detail="Token has been revoked")
        
        return decoded
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
```

**Create TTL Index** (tokens auto-delete after expiry):
```python
# In backend/app/main.py startup
await db["token_blacklist"].create_index("expiresAt", expireAfterSeconds=0)
```

---

### 7. **Race Condition in Token Refresh**
**Location**: `frontend/lib/api.ts`

**Issue**:
- Multiple simultaneous 401 responses can trigger parallel refresh attempts
- Can cause token refresh storms

**Fix**: Add mutex lock for token refresh

```typescript
// Add at top of file
let isRefreshing = false
let refreshPromise: Promise<Response> | null = null

export async function secureFetch(endpoint: string, options: RequestInit = {}) {
    const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`

    const defaultOptions: RequestInit = {
        ...options,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            ...options.headers,
        },
    }

    try {
        let response = await fetch(url, defaultOptions)

        if (response.status === 401 && !endpoint.includes('/auth/refresh-token')) {
            // ✅ Prevent multiple simultaneous refreshes
            if (!isRefreshing) {
                isRefreshing = true
                refreshPromise = fetch(`${BASE_URL}/auth/refresh-token`, {
                    method: "POST",
                    credentials: "include",
                }).finally(() => {
                    isRefreshing = false
                    refreshPromise = null
                })
            }

            const refreshResponse = await refreshPromise!

            if (refreshResponse.ok) {
                response = await fetch(url, defaultOptions)
            } else {
                setLoggedIn(false)
                if (typeof window !== "undefined") {
                    window.location.href = "/login"
                }
                toast.error("Your session has expired. Please login again.")
                throw new Error("Session expired")
            }
        }

        return response
    } catch (error) {
        console.error("API Fetch Error:", error)
        throw error
    }
}
```

---

## 🟢 MEDIUM PRIORITY ERRORS

### 8. **Missing CSRF Protection**
**Location**: All state-changing endpoints

**Issue**:
- Only using `X-Requested-With` header (weak CSRF protection)
- No CSRF tokens for form submissions

**Fix**: Implement CSRF tokens

**Backend** `backend/app/core/security.py`:
```python
import secrets

def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)

def verify_csrf_token(token: str, stored_token: str) -> bool:
    return secrets.compare_digest(token, stored_token)

# Add to set_auth_cookies
def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    is_production = settings.NODE_ENV == "production"
    
    # ✅ Add CSRF token
    csrf_token = generate_csrf_token()
    
    response.set_cookie(
        key="accessToken",
        value=access_token,
        httponly=True,
        secure=is_production,
        samesite="strict",
        max_age=settings.ACCESS_TOKEN_EXPIRY_MINUTES * 60,
    )
    response.set_cookie(
        key="refreshToken",
        value=refresh_token,
        httponly=True,
        secure=is_production,
        samesite="strict",
        max_age=7 * 24 * 60 * 60,
    )
    response.set_cookie(
        key="csrfToken",
        value=csrf_token,
        httponly=False,  # ✅ Must be readable by JavaScript
        secure=is_production,
        samesite="strict",
        max_age=settings.ACCESS_TOKEN_EXPIRY_MINUTES * 60,
    )
```

**Frontend** `frontend/lib/api.ts`:
```typescript
export async function secureFetch(endpoint: string, options: RequestInit = {}) {
    const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`

    // ✅ Get CSRF token from cookie
    const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrfToken='))
        ?.split('=')[1]

    const defaultOptions: RequestInit = {
        ...options,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            ...(csrfToken && { "X-CSRF-Token": csrfToken }),  // ✅ Add CSRF header
            ...options.headers,
        },
    }

    // ... rest of the function
}
```

---

### 9. **Missing Rate Limiting on Auth Endpoints**
**Location**: All auth endpoints

**Issue**:
- No rate limiting on login, signup, OTP requests
- Vulnerable to brute force attacks

**Fix**: Add rate limiting middleware

**Install**:
```bash
pip install slowapi
```

**Backend** `backend/app/main.py`:
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

**Apply to auth endpoints** `backend/app/api/auth.py`:
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/login")
@limiter.limit("5/minute")  # ✅ 5 attempts per minute
async def login(request: Request, data: LoginRequest, response: Response):
    # ... existing code
```

---

### 10. **Insecure Cookie Settings in Development**
**Location**: `backend/app/core/security.py`

**Issue**:
```python
secure=is_production  # ❌ False in development, allows HTTP transmission
```

**Fix**: Use secure cookies even in development with HTTPS proxy

**Better approach**:
```python
def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    is_production = settings.NODE_ENV == "production"
    
    # ✅ Always use secure in production, optional in dev
    secure_cookie = is_production or settings.USE_SECURE_COOKIES
    
    response.set_cookie(
        key="accessToken",
        value=access_token,
        httponly=True,
        secure=secure_cookie,
        samesite="strict" if is_production else "lax",
        max_age=settings.ACCESS_TOKEN_EXPIRY_MINUTES * 60,
    )
```

**Add to `.env`**:
```env
USE_SECURE_COOKIES=false  # Set to true if using HTTPS locally
```

---

## 📝 TESTING CHECKLIST

### Authentication Flow Tests

**1. Signup Flow**:
```bash
# Test 1: Valid signup
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "test@example.com",
    "password": "StrongPass123!",
    "pin": "1234",
    "phone": "+1234567890",
    "dob": "1990-01-01"
  }'

# Test 2: Duplicate email
# Should return 400 error

# Test 3: Weak password
# Should return 400 error
```

**2. Login Flow**:
```bash
# Test 1: Valid login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "test@example.com",
    "password": "StrongPass123!"
  }'

# Test 2: Invalid credentials
# Should return 401 error

# Test 3: Check cookies set
cat cookies.txt
```

**3. Token Refresh**:
```bash
# Test token refresh
curl -X POST http://localhost:8000/api/auth/refresh-token \
  -b cookies.txt \
  -c cookies.txt
```

**4. Logout**:
```bash
# Test logout
curl -X POST http://localhost:8000/api/auth/logout \
  -b cookies.txt
```

**5. Google OAuth**:
- Open browser to `http://localhost:3000/login`
- Click "Sign in with Google"
- Check browser console for errors
- Verify redirect after authentication

---

## 🚀 DEPLOYMENT CHECKLIST

Before deploying to production:

- [ ] Remove all `.env` files from git history
- [ ] Set strong JWT_SECRET (64+ character random string)
- [ ] Configure Google OAuth authorized origins for production domain
- [ ] Enable `secure=True` for cookies (requires HTTPS)
- [ ] Set `samesite="strict"` for production
- [ ] Add rate limiting on all auth endpoints
- [ ] Implement token blacklist system
- [ ] Set up proper error logging (not console.log)
- [ ] Add monitoring for failed login attempts
- [ ] Configure proper CORS origins (remove localhost)
- [ ] Set short token expiry times (15-30 min access, 1-3 day refresh)
- [ ] Enable 2FA for all admin accounts
- [ ] Set up MongoDB connection pooling
- [ ] Add database indexes for performance
- [ ] Configure proper backup strategy
- [ ] Set up SSL/TLS certificates
- [ ] Enable security headers (HSTS, CSP, etc.)

---

## 🔧 RECOMMENDED CONFIGURATION

**Production `.env` settings**:
```env
# Security
JWT_SECRET="<64-character-random-hex-string>"
ACCESS_TOKEN_EXPIRY_MINUTES=30
REFRESH_TOKEN_EXPIRY_DAYS=3
USE_SECURE_COOKIES=true
NODE_ENV=production

# CORS
FRONTEND_URL="https://yourdomain.com"

# MongoDB
MONGODB_URI="<production-connection-string-with-read-replica>"

# Rate Limiting
RATE_LIMIT_ENABLED=true
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=15
```

---

## 📊 PRIORITY SUMMARY

| Priority | Issue | Impact | Effort |
|----------|-------|--------|--------|
| 🔴 CRITICAL | Google OAuth 403 | Blocks feature | Low |
| 🔴 CRITICAL | Exposed credentials | Security breach | Low |
| 🔴 CRITICAL | Weak JWT secret | Token forgery | Low |
| 🟡 HIGH | Dual state management | Auth bypass | Medium |
| 🟡 HIGH | Missing token invalidation | Session hijacking | Medium |
| 🟡 HIGH | Token refresh race | Token storms | Low |
| 🟢 MEDIUM | Missing CSRF | CSRF attacks | Medium |
| 🟢 MEDIUM | No rate limiting | Brute force | Low |
| 🟢 MEDIUM | Insecure dev cookies | Dev security | Low |

**Total Estimated Time**: 4-6 hours for all fixes

---

## 🎯 IMMEDIATE ACTION ITEMS

1. **Fix Google OAuth** (5 minutes)
2. **Remove exposed credentials** (10 minutes)
3. **Set strong JWT secret** (5 minutes)
4. **Implement token blacklist** (1 hour)
5. **Fix token refresh race condition** (30 minutes)
6. **Add rate limiting** (1 hour)
7. **Test complete authentication flow** (1 hour)

---

Generated: June 14, 2026
Project: SecureVault Digital Asset Inheritance Platform
