import requests
import json
import sys

BASE = 'http://localhost:8000/api'
MOCK_EMAIL = 'mocktest@securevault.com'
MOCK_PASS  = 'MockTest@123'

headers = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'Origin': 'http://localhost:3000'
}

all_pass = True

def check(label, condition):
    global all_pass
    status = 'PASS' if condition else 'FAIL'
    if not condition:
        all_pass = False
    print(f"  [{status}] {label}")

print("\n" + "="*55)
print("  SecureVault Auth - Full Test Suite")
print("="*55)

# ── Test 1: Login with correct credentials ────────────────
print("\n[1] LOGIN - Correct credentials")
session = requests.Session()
r = session.post(f'{BASE}/auth/login',
    json={'email': MOCK_EMAIL, 'password': MOCK_PASS},
    headers=headers)
data = r.json()
print(f"  Status: {r.status_code}")
print(f"  Cookies: {list(session.cookies.keys())}")
user_email = data.get('user', {}).get('email', '')
user_id    = data.get('user', {}).get('id', '')
print(f"  Logged in as: {user_email}")
check("Status 200", r.status_code == 200)
check("accessToken cookie set", 'accessToken' in session.cookies)
check("refreshToken cookie set", 'refreshToken' in session.cookies)
check("User email returned", user_email == MOCK_EMAIL)

# ── Test 2: Protected route /me ───────────────────────────
print("\n[2] PROTECTED ROUTE - /auth/me")
r2 = session.get(f'{BASE}/auth/me/{user_id}', headers=headers)
print(f"  Status: {r2.status_code}")
check("Status 200", r2.status_code == 200)
check("Email matches", r2.json().get('email') == MOCK_EMAIL)

# ── Test 3: Heartbeat (auth guard) ───────────────────────
print("\n[3] HEARTBEAT - Auth guard")
r3 = session.post(f'{BASE}/auth/heartbeat', headers=headers)
print(f"  Status: {r3.status_code}")
print(f"  Response: {r3.json()}")
check("Status 200", r3.status_code == 200)

# ── Test 4: Wrong password error format ──────────────────
print("\n[4] ERROR FORMAT - Wrong password (detail -> error mapping)")
r4 = requests.post(f'{BASE}/auth/login',
    json={'email': MOCK_EMAIL, 'password': 'WRONGPASS'},
    headers=headers)
raw4 = r4.json()
print(f"  Status: {r4.status_code}")
print(f"  Raw response: {raw4}")
err_msg = raw4.get('detail') or raw4.get('error') or ''
print(f"  Error message: {err_msg}")
check("Status 401", r4.status_code == 401)
check("Has 'detail' key (FastAPI)", 'detail' in raw4)
check("Error message is not empty", bool(err_msg))

# ── Test 5: Non-existent user error ──────────────────────
print("\n[5] ERROR FORMAT - Nonexistent user")
r5 = requests.post(f'{BASE}/auth/login',
    json={'email': 'nobody@nowhere.com', 'password': 'anything'},
    headers=headers)
raw5 = r5.json()
print(f"  Status: {r5.status_code}")
print(f"  Raw: {raw5}")
check("Status 401", r5.status_code == 401)
check("Has 'detail' key", 'detail' in raw5)

# ── Test 6: Google auth endpoint (reachability) ──────────
print("\n[6] GOOGLE AUTH - Endpoint reachability")
r6 = requests.post(f'{BASE}/auth/google-auth',
    json={'credential': 'fake_invalid_token'},
    headers=headers)
raw6 = r6.json()
print(f"  Status: {r6.status_code}")
print(f"  Response: {raw6}")
check("Endpoint exists (not 404)", r6.status_code != 404)
check("Rejects fake token (401)", r6.status_code == 401)
check("Has 'detail' key", 'detail' in raw6)
google_err = raw6.get('detail', '')
check("Says 'Invalid Google token'", 'Google' in google_err or 'Invalid' in google_err)

# ── Test 7: Logout ────────────────────────────────────────
print("\n[7] LOGOUT")
r7 = session.post(f'{BASE}/auth/logout', headers=headers)
print(f"  Status: {r7.status_code}")
print(f"  Message: {r7.json()}")
check("Status 200", r7.status_code == 200)

# ── Test 8: After logout, protected route should fail ─────
print("\n[8] POST-LOGOUT - Protected route should fail")
r8 = session.get(f'{BASE}/auth/me/{user_id}', headers=headers)
print(f"  Status: {r8.status_code}")
check("Status 401 (no valid token)", r8.status_code == 401)

# ── Summary ───────────────────────────────────────────────
print("\n" + "="*55)
if all_pass:
    print("  ALL TESTS PASSED - Auth flow working correctly!")
    print(f"\n  Mock Account:")
    print(f"  Email   : {MOCK_EMAIL}")
    print(f"  Password: {MOCK_PASS}")
    print(f"  PIN     : 1234")
else:
    print("  SOME TESTS FAILED - See above for details")
print("="*55 + "\n")
sys.exit(0 if all_pass else 1)
