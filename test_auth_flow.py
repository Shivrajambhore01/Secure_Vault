"""
SecureVault Authentication Flow Tester
Tests signup, login, and session management
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:8000/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_success(msg):
    print(f"{Colors.GREEN}✓ {msg}{Colors.END}")

def print_error(msg):
    print(f"{Colors.RED}✗ {msg}{Colors.END}")

def print_info(msg):
    print(f"{Colors.BLUE}ℹ {msg}{Colors.END}")

def print_warning(msg):
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.END}")

class AuthTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_user = {
            "fullName": "Test User",
            "email": f"test_{int(time.time())}@example.com",
            "password": "TestPass123!",
            "pin": "1234",
            "phone": "+1234567890",
            "dob": "1990-01-01"
        }
        self.otp = None
        self.user_id = None
        
    def test_backend_health(self):
        """Test if backend is running"""
        print("\n" + "="*60)
        print("TEST 1: Backend Health Check")
        print("="*60)
        
        try:
            response = requests.get(f"{BASE_URL.replace('/api', '')}/docs", timeout=5)
            if response.status_code == 200:
                print_success("Backend is ONLINE")
                return True
            else:
                print_error(f"Backend returned status {response.status_code}")
                return False
        except requests.exceptions.ConnectionError:
            print_error("Backend is OFFLINE - Cannot connect to http://localhost:8000")
            print_info("Start backend with: cd backend && uvicorn app.main:app --reload --port 8000")
            return False
        except Exception as e:
            print_error(f"Error: {str(e)}")
            return False
    
    def test_send_otp(self):
        """Test OTP sending"""
        print("\n" + "="*60)
        print("TEST 2: Send OTP for Signup")
        print("="*60)
        
        print_info(f"Requesting OTP for: {self.test_user['email']}")
        
        try:
            response = self.session.post(
                f"{BASE_URL}/auth/send-otp",
                json={"email": self.test_user['email']},
                headers={"Content-Type": "application/json"}
            )
            
            data = response.json()
            
            if response.status_code == 200:
                print_success(f"OTP sent successfully")
                
                # In dev mode, OTP is in response
                if "otp" in data:
                    self.otp = data["otp"]
                    print_info(f"DEV MODE - OTP: {self.otp}")
                else:
                    print_warning("Check backend console logs for OTP")
                    print_info("Enter OTP manually when prompted")
                
                return True
            else:
                print_error(f"Failed to send OTP: {data.get('detail', 'Unknown error')}")
                return False
                
        except Exception as e:
            print_error(f"Error: {str(e)}")
            return False
    
    def test_verify_otp(self):
        """Test OTP verification"""
        print("\n" + "="*60)
        print("TEST 3: Verify OTP")
        print("="*60)
        
        if not self.otp:
            self.otp = input("Enter OTP from email or backend logs: ").strip()
        
        print_info(f"Verifying OTP: {self.otp}")
        
        try:
            response = self.session.post(
                f"{BASE_URL}/auth/verify-otp",
                json={
                    "email": self.test_user['email'],
                    "otp": self.otp
                },
                headers={"Content-Type": "application/json"}
            )
            
            data = response.json()
            
            if response.status_code == 200:
                print_success("OTP verified successfully")
                return True
            else:
                print_error(f"OTP verification failed: {data.get('detail', 'Unknown error')}")
                return False
                
        except Exception as e:
            print_error(f"Error: {str(e)}")
            return False
    
    def test_signup(self):
        """Test user signup"""
        print("\n" + "="*60)
        print("TEST 4: Complete Signup")
        print("="*60)
        
        print_info(f"Creating account for: {self.test_user['email']}")
        
        try:
            response = self.session.post(
                f"{BASE_URL}/auth/signup",
                json=self.test_user,
                headers={"Content-Type": "application/json"}
            )
            
            data = response.json()
            
            if response.status_code == 200:
                print_success("Signup successful!")
                
                if "user" in data:
                    self.user_id = data["user"].get("id")
                    print_info(f"User ID: {self.user_id}")
                    print_info(f"Email: {data['user'].get('email')}")
                    print_info(f"Name: {data['user'].get('fullName')}")
                
                # Check cookies
                cookies = self.session.cookies.get_dict()
                if "accessToken" in cookies:
                    print_success("Access token cookie set")
                if "refreshToken" in cookies:
                    print_success("Refresh token cookie set")
                
                return True
            else:
                print_error(f"Signup failed: {data.get('detail', 'Unknown error')}")
                print_info(f"Status code: {response.status_code}")
                return False
                
        except Exception as e:
            print_error(f"Error: {str(e)}")
            return False
    
    def test_logout(self):
        """Test logout"""
        print("\n" + "="*60)
        print("TEST 5: Logout")
        print("="*60)
        
        try:
            response = self.session.post(
                f"{BASE_URL}/auth/logout",
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                print_success("Logout successful")
                
                # Check if cookies are cleared
                cookies = self.session.cookies.get_dict()
                if not cookies.get("accessToken") and not cookies.get("refreshToken"):
                    print_success("Cookies cleared")
                
                return True
            else:
                print_error(f"Logout failed: {response.status_code}")
                return False
                
        except Exception as e:
            print_error(f"Error: {str(e)}")
            return False
    
    def test_login(self):
        """Test user login"""
        print("\n" + "="*60)
        print("TEST 6: Login with Created Account")
        print("="*60)
        
        print_info(f"Logging in as: {self.test_user['email']}")
        
        try:
            response = self.session.post(
                f"{BASE_URL}/auth/login",
                json={
                    "email": self.test_user['email'],
                    "password": self.test_user['password']
                },
                headers={"Content-Type": "application/json"}
            )
            
            data = response.json()
            
            if response.status_code == 200:
                print_success("Login successful!")
                
                if "user" in data:
                    print_info(f"Logged in as: {data['user'].get('fullName')}")
                
                # Check cookies
                cookies = self.session.cookies.get_dict()
                if "accessToken" in cookies:
                    print_success("Access token received")
                if "refreshToken" in cookies:
                    print_success("Refresh token received")
                
                return True
            else:
                print_error(f"Login failed: {data.get('detail', 'Unknown error')}")
                return False
                
        except Exception as e:
            print_error(f"Error: {str(e)}")
            return False
    
    def test_authenticated_request(self):
        """Test making an authenticated request"""
        print("\n" + "="*60)
        print("TEST 7: Authenticated Request (Heartbeat)")
        print("="*60)
        
        try:
            response = self.session.post(
                f"{BASE_URL}/auth/heartbeat",
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                print_success("Authenticated request successful")
                print_info("Session is active")
                return True
            elif response.status_code == 401:
                print_error("Authentication failed - Token invalid")
                return False
            else:
                print_warning(f"Unexpected status: {response.status_code}")
                return False
                
        except Exception as e:
            print_error(f"Error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run complete authentication flow test"""
        print("\n" + "="*80)
        print("SECUREVAULT AUTHENTICATION FLOW TEST")
        print("="*80)
        print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        results = {
            "Backend Health": self.test_backend_health(),
        }
        
        if not results["Backend Health"]:
            print("\n" + "="*80)
            print_error("TESTS STOPPED - Backend is not running")
            print("="*80)
            return
        
        # Signup flow
        results["Send OTP"] = self.test_send_otp()
        if results["Send OTP"]:
            results["Verify OTP"] = self.test_verify_otp()
            if results["Verify OTP"]:
                results["Signup"] = self.test_signup()
                
                if results["Signup"]:
                    # Test logout
                    results["Logout"] = self.test_logout()
                    
                    # Test login
                    results["Login"] = self.test_login()
                    
                    if results["Login"]:
                        # Test authenticated request
                        results["Authenticated Request"] = self.test_authenticated_request()
        
        # Print summary
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        
        for test_name, result in results.items():
            if result:
                print_success(f"{test_name}")
            else:
                print_error(f"{test_name}")
        
        total_tests = len(results)
        passed_tests = sum(1 for r in results.values() if r)
        
        print("\n" + "="*80)
        print(f"Results: {passed_tests}/{total_tests} tests passed")
        print("="*80)
        
        if passed_tests == total_tests:
            print_success("ALL TESTS PASSED! ✓")
        else:
            print_error(f"SOME TESTS FAILED - {total_tests - passed_tests} failures")
        
        print(f"\nTest User Credentials:")
        print(f"  Email: {self.test_user['email']}")
        print(f"  Password: {self.test_user['password']}")
        print(f"  PIN: {self.test_user['pin']}")

if __name__ == "__main__":
    tester = AuthTester()
    tester.run_all_tests()
