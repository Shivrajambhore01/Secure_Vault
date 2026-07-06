# SecureVault - Comprehensive Security, Routing, and Workflow Analysis Report

**Report Date**: July 06, 2026  
**Analyzed By**: Antigravity AI Pair Programmer  
**Target Platform**: SecureVault Digital Asset Inheritance Platform  

---

## 🛡️ EXECUTIVE SUMMARY
SecureVault is designed to preserve and securely inherit digital assets. While the cryptographic foundation (bcrypt password hashing, AES-256 CBC encryption utilities) is sound, there are **critical architectural flaws and security vulnerabilities** in the active codebase that compromise the reliability and confidentiality of the platform.

### Security Rating: 🛑 HIGH RISK (Needs Hardening)
- **Vulnerabilities**: Direct Object Reference (IDOR) on secure files, unencrypted storage of user files at rest.
- **Workflow Flaws**: The inactivity re-engagement system fails to trigger under normal passive exit conditions, which breaks the core legacy inheritance mechanism.

---

## 🔄 WORKFLOW & DATA ROUTING

```
[ USER REGISTRATION & SIGNUP ]
  └── User registers with Email, Password, and PIN
  └── Hashed using bcrypt ($2b$ schema)
  └── verificationToken generated and sent via Gmail SMTP
  └── HTTP-only Access & Refresh cookies issued

[ ACTIVE STATE & MONITORING ]
  └── Frontend sends regular /api/auth/heartbeat POST requests
  └── Heartbeat updates lastActive timestamp
  └── Heartbeat resets re-engagement fields (logoutTime = None)

[ PASSIVE INACTIVITY OR LOGOUT ]
  └── Scenario A: User clicks "Logout" ──> logoutTime set to current time
  └── Scenario B: User closes tab/disappears ──> lastActive freezes; logoutTime stays null

[ INACTIVITY SCHEDULER SCAN ]
  └── Runs every 60 seconds (scheduler.py)
  └── Scans only users with logoutTime != null
  └── Evaluates elapsed time against inactivityPeriod
  └── Sends emails, triggers Twilio voice calls, then grants nominees access links
```

---

## 🚨 CRITICAL FINDINGS & CODE VULNERABILITIES

### 1. Inactivity Protocol Scanner Logic Flaw (🔴 CRITICAL)
- **Files Affected**: 
  - [scheduler.py](file:///c:/Users/Shivraj/Downloads/SecureVault/backend/app/lib/scheduler.py#L309)
  - [auth.py](file:///c:/Users/Shivraj/Downloads/SecureVault/backend/app/api/auth.py#L610)
- **Analysis**:
  The background scheduler queries candidates using:
  ```python
  inactive_users = await users_col.find({"logoutTime": {"$ne": None}}).to_list(length=None)
  ```
  If a user passes away or goes offline passively (the target use-case for this application), they do not hit the `/logout` API route. Their `logoutTime` remains `None`. Consequently, the inactivity scanner **completely ignores them**, and the nominees are never notified.
- **Remediation**:
  Alter the scanner query in `scheduler.py` to evaluate the elapsed time since `lastActive`, rather than querying for `logoutTime`:
  ```python
  current_time = datetime.now(timezone.utc)
  # Find users where lastActive is older than the inactivity window
  # (Convert user.inactivityPeriod months to timedelta or minutes in test mode)
  ```

### 2. Unauthenticated File Download IDOR (🔴 CRITICAL)
- **Files Affected**:
  - [assets.py](file:///c:/Users/Shivraj/Downloads/SecureVault/backend/app/api/assets.py#L167-L186)
- **Analysis**:
  The file retrieval endpoint `/api/assets/file/{asset_id}` checks no authorization header, token, or cookie parameters:
  ```python
  @router.get("/file/{asset_id}")
  async def get_asset_file(asset_id: str):
      asset = await assets_col.find_one({"id": asset_id})
      # ... serves file bytes directly
  ```
  An attacker or unauthorized user who obtains or guesses the `asset_id` can fetch raw document bytes directly without entering a credentials/PIN screen.
- **Remediation**:
  Ensure the GET route requires cookies or token validation. Validate that:
  - The requester is the asset owner (`Depends(get_current_user)` matches `asset.userId`), **OR**
  - The requester is an authorized nominee presenting a validated nominee session token.

### 3. Plaintext/Unencrypted File Storage at Rest (🟡 HIGH)
- **Files Affected**:
  - [assets.py](file:///c:/Users/Shivraj/Downloads/SecureVault/backend/app/api/assets.py#L116)
- **Analysis**:
  The file contents are uploaded and stored directly as raw binary:
  ```python
  asset_data["fileData"] = Binary(file_content)
  ```
  While text notes and credentials utilize the AES-256 helper functions, files are kept completely unencrypted in MongoDB. In the event of a database compromise, all raw PDF documents, identification cards, and media files are exposed.
- **Remediation**:
  Implement file-encryption-at-rest. Before writing to the database, run the `file_content` through an encryptor, and decrypt the bytes when serving them via the download endpoint.

---

## 📅 DEVELOPMENT CYCLE & IMPLEMENTATION ROADMAP

Based on security impact and the platform's core legacy functionality, the development roadmap has been divided into six execution phases:

### Phase 1: Critical Security Fixes (Highest Priority)
1. **Fix Inactivity Workflow**:
   - Transition the scheduler logic from `logoutTime != None` to evaluating `inactive_duration = now - lastActive` against `user.inactivityPeriod`.
   - Ensures re-engagement trigger fires if user's browser closes, connection drops, or unexpected event occurs.
2. **Secure File Downloads**:
   - Protect GET `/assets/file/{id}` with `Depends(get_current_user)`.
   - Validate `asset.userId == current_user.id` or check for a valid inheritance nominee token.
   - Record an audit log: user ID, timestamp, IP address, and device metadata.
3. **Encrypt Files Before Storage**:
   - Encrypt files (PDFs, images, ZIPs, documents) on upload using AES-256.
   - Decrypt only during authorized downloads.

### Phase 2: Authentication Improvements
1. **JWT Rotation**:
   - Issue a new Access Token and Refresh Token on every login.
   - Invalidate old Refresh Tokens on refresh and issue new ones.
   - Store active refresh tokens in MongoDB to prevent reuse.
2. **Token Blacklisting**:
   - Add a `token_blacklist` collection in MongoDB to invalidate JWTs upon logout and prevent replay attacks.
3. **Device Sessions**:
   - Separate sessions per device (Laptop, Phone, Tablet) and enable users to view active sessions and click "Logout this device" or "Logout all devices".

### Phase 3: Stronger Security
1. **Rate Limiting**:
   - Limit `/login` (5 requests / min), `/send-otp` (3 requests / 5 mins), `/verify-pin` (5 attempts), and `/forgot-request` (3 requests / hour).
2. **Account Lockout**:
   - Lock accounts for 15 minutes after 5 failed password attempts or 10 failed PIN attempts.
3. **File Malware Scanning**:
   - Scan uploaded files for viruses before encryption and storage.
4. **Maximum Upload Size Limit**:
   - Prevent DOS attacks by restricting uploads: Images (20MB), Documents (50MB), Videos (500MB).

### Phase 4: Digital Inheritance Logic
1. **Multi-Step Confirmation**:
   - Trigger sequential alerts on user inactivity: Email -> SMS -> Voice Call -> Emergency Contact -> Final Grace Period -> Nominee Access.
2. **Emergency Override**:
   - Designate a trusted contact who can confirm the user is active, extend the timer, or report an emergency.
3. **Multiple Nominees / Asset Splits**:
   - Support assigning specific nominees to specific categories (e.g. Bank documents to Spouse, Crypto wallet to Brother).
4. **Timed Release**:
   - Implement incremental grace periods before nominee access is completely released.

### Phase 5: Audit & Compliance
- Maintain immutable audit logs tracking: Login, Logout, Asset Upload, Asset Delete, File Download, PIN Verification, Nominee Access, Encryption events, and Scheduler Executions.
- Log details: User ID, Action, Timestamp, IP, Device, Result, and location context.

### Phase 6: Production Hardening
- Enforce HTTPS across all pages.
- Store encryption secrets outside the database in secure environment variables or a Secret Manager.
- Configure automatic database backups and encrypt backup dump files.
- Enable monitoring and alerting for scheduler execution logs.
- Enforce strict security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options).

---

## 📈 SUGGESTED DEVELOPMENT ORDER

| Priority | Task | Impact |
| :--- | :--- | :--- |
| **1** | Fix scheduler to use lastActive | Critical – core inheritance workflow |
| **2** | Secure file download authorization | Critical – prevents unauthorized access (IDOR) |
| **3** | Encrypt uploaded files at rest | Critical – protects sensitive database assets |
| **4** | Rate limiting and brute-force protection | High |
| **5** | Refresh token rotation and revocation | High |
| **6** | Audit logging | High |
| **7** | Multi-device session management | Medium |
| **8** | Multi-step inheritance workflow | Medium |
| **9** | Malware scanning and upload validation | Medium |
| **10** | Monitoring, backups, and operational hardening | Medium |

---

**Generated**: July 06, 2026  
**By**: Antigravity AI Pair Programmer  
**Project**: SecureVault Digital Asset Inheritance Platform  
**Version**: 1.1.0  
