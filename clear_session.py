"""
Clear all authentication cookies via backend logout
This simulates what the HTML cleaner would do
"""

import requests

BASE_URL = "http://localhost:8000/api"

def clear_session():
    """Call logout to clear all server-side cookies"""
    print("="*60)
    print("CLEARING SECUREVAULT SESSION")
    print("="*60)
    
    session = requests.Session()
    
    # Try to logout (clears cookies on backend)
    try:
        print("\n➤ Calling logout endpoint to clear cookies...")
        response = session.post(
            f"{BASE_URL}/auth/logout",
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            print("✓ Server-side logout successful")
        else:
            print(f"⚠ Logout returned {response.status_code} (might not have active session)")
        
        print("\n" + "="*60)
        print("✓ SESSION CLEARED ON SERVER")
        print("="*60)
        print("\nNow do this in your browser:")
        print("1. Open http://localhost:3000/login")
        print("2. Press F12 (Developer Tools)")
        print("3. Go to Application tab")
        print("4. Under Cookies → localhost:3000 → Right-click → Clear")
        print("5. Close Dev Tools and try login again")
        print()
        
    except Exception as e:
        print(f"✗ Error: {str(e)}")
        print("\nThis is OK if backend is not running.")

if __name__ == "__main__":
    clear_session()
