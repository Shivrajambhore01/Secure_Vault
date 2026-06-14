"""
Automated Authentication Flow Test
Retrieves OTP from MongoDB directly
"""

import requests
import json
import time
from datetime import datetime
from pymongo import MongoClient
import urllib.parse

BASE_URL = "http://localhost:8000/api"

# MongoDB connection
MONGODB_URI = "mongodb+srv://shivrajambhore01_db_user:MF1Jh5NjiMHSonuT@cluster0.1xzzedg.mongodb.net/?appName=Cluster0"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    END = '\033[0m'

def print_success(msg):
    print(f"{Colors.GREEN}✓ {msg}{Colors.END}")

def print_error(msg):
    print(f"{Colors.RED}✗ {msg}{Colors.END}")

def print_info(msg):
    print(f"{Colors.BLUE}ℹ {msg}{Colors.END}")

def print_step(msg):
    print(f"{Colors.CYAN}➤ {msg}{Colors.END}")

class AutomatedAuthTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_user = {
            "fullName": "Automated Test User",
            "email": f"autotest_{int(time.time())}@example.com",
            "password": "SecurePass123!@",
            "pin": "4567",
            "phone": "+19876543210",
            "dob": "1995-05-15"
        }
        self.client = None
        self.db = None
        
        print("\n" + "="*80)
        print("AUTOMATED AUTHENTICATION FLOW TEST - WITH MONGODB INTEGRATION")
        print("="*80)
        print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    def connect_to_db(self):
        """Connect to MongoDB"""
        print_step("Connecting to MongoDB...")
        try:
            self.client = MongoClient(MONGODB_URI)
            self.db = self.client["securevault"]
            # Test connection
            self.client.server_info()
            print_success("Connected to MongoDB Atlas")
            return True
        except Exception as e:
            print_error(f"MongoDB connection failed: {str(e)}")
            return False
    
    def get_otp_from_db(self, email):
        """Retrieve OTP from MongoDB"""
        try:
            otps_col = self.db["otps"]
            otp_doc = otps_col.find_one({"email": email.lower()})
            if otp_doc:
                return otp_doc.get("otp")
            return None
        except Exception as e:
            print_error(f"Error retrieving OTP: {str(e)}")
            return None
    
    def test_complete_flow(self):
        """Test complete authentication flow"""
        
        # Connect to MongoDB
        if not self.connect_to_db():
            print_error("Cannot proceed without MongoDB connection")
            return
        
        results = {}
        
        # TEST 1: Check Backend Health
        print("\n" + "-"*80)
        print("TEST 1: Backend Health Check")
        print("-"*80)
        try:
            response = requests.get(f"{BASE_URL.replace('/api', '')}/docs", timeout=5)
            if response.status_code == 200:
                print_success("Backend is ONLINE")
                results["Backend Health"] = True
            else:
                print_error(f"Backend returned status {response.status_code}")
                results["Backend Health"] = False
                return
        except Exception as e:
            print_error(f"Backend is OFFLINE: {str(e)}")
            results["Backend Health"] = False
            return
        
        # TEST 2: Send OTP
        print("\n" + "-"*80)
        print("TEST 2: Send OTP")
        print("-"*80)
        print_info(f"Email: {self.test_user['email']}")
        
        try:
            response = self.session.post(
                f"{BASE_URL}/auth/send-otp",
                json={"email": self.test_user['email']},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                print_success("OTP sent successfully")
                results["Send OTP"] = True
                
                # Wait a moment for DB to update
                time.sleep(1)
                
                # Get OTP from database
                otp = self.get_otp_from_db(self.test_user['email'])
                if otp:
                    print_success(f"Retrieved OTP from database: {otp}")
                    self.test_user['otp'] = otp
                else:
                    print_error("Could not retrieve OTP from database")
                    results["Send OTP"] = False
                    return
            else:
                data = response.json()
                print_error(f"Failed to send OTP: {data.get('detail', 'Unknown error')}")
                results["Send OTP"] = False
                return
        except Exception as e:
            print_error(f"Error: {str(e)}")
            results["Send OTP"] = False
            return
        
        # TEST 3: Verify OTP
        print("\n" + "-"*80)
        print("TEST 3: Verify OTP")
        print("-"*80)
        print_info(f"Verifying OTP: {self.test_user['otp']}")
        
        try:
            response = self.session.post(
                f"{BASE_URL}/auth/verify-otp",
                json={
                    "email": self.test_user['email'],
                    "otp": self.test_user['otp']
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                print_success("OTP verified successfully")
                results["Verify OTP"] = True
            else:
                data = response.json()
                print_error(f"OTP verification failed: {data.get('detail', 'Unknown error')}")
                results["Verify OTP"] = False
                return
        except Exception as e:
            print_error(f"Error: {str(e)}")
            results["Verify OTP"] = False
            return
        
        # TEST 4: Complete Signup
        print("\n" + "-"*80)
        print("TEST 4: Complete Signup")
        print("-"*80)
        print_info(f"Creating account...")
        
        try:
            response = self.session.post(
                f"{BASE_URL}/auth/signup",
                json=self.test_user,
                headers={"Content-Type": "application/json"}
            )
            
            data = response.json()
            
            if response.status_code == 200:
                print_success("Signup completed successfully!")
                
                if "user" in data:
                    user = data["user"]
                    print_info(f"User ID: {user.get('id')}")
                    print_info(f"Full Name: {user.get('fullName')}")
                    print_info(f"Email: {user.get('email')}")
                    print_info(f"Verified: {user.get('isVerified')}")
                    self.test_user['id'] = user.get('id')
                
                # Check cookies
                cookies = self.session.cookies.get_dict()
                if "accessToken" in cookies:
                    print_success("✓ Access token cookie received")
                if "refreshToken" in cookies:
                    print_success("✓ Refresh token cookie received")
                
                results["Signup"] = True
            else:
                print_error(f"Signup failed: {data.get('detail', 'Unknown error')}")
                print_info(f"Status code: {response.status_code}")
                print_info(f"Response: {json.dumps(data, indent=2)}")
                results["Signup"] = False
                return
        except Exception as e:
            print_error(f"Error: {str(e)}")
            results["Signup"] = False
            return
        
        # TEST 5: Logout
        print("\n" + "-"*80)
        print("TEST 5: Logout")
        print("-"*80)
        
        try:
            response = self.session.post(
                f"{BASE_URL}/auth/logout",
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                print_success("Logout successful")
                results["Logout"] = True
            else:
                print_error(f"Logout failed: {response.status_code}")
                results["Logout"] = False
        except Exception as e:
            print_error(f"Error: {str(e)}")
            results["Logout"] = False
        
        # TEST 6: Login
        print("\n" + "-"*80)
        print("TEST 6: Login with Created Account")
        print("-"*80)
        print_info(f"Email: {self.test_user['email']}")
        print_info(f"Password: {self.test_user['password']}")
        
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
                    print_success("✓ Access token received")
                if "refreshToken" in cookies:
                    print_success("✓ Refresh token received")
                
                results["Login"] = True
            else:
                print_error(f"Login failed: {data.get('detail', 'Unknown error')}")
                print_info(f"Response: {json.dumps(data, indent=2)}")
                results["Login"] = False
                return
        except Exception as e:
            print_error(f"Error: {str(e)}")
            results["Login"] = False
            return
        
        # TEST 7: Authenticated Request
        print("\n" + "-"*80)
        print("TEST 7: Authenticated Request (Heartbeat)")
        print("-"*80)
        
        try:
            response = self.session.post(
                f"{BASE_URL}/auth/heartbeat",
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                print_success("Authenticated request successful")
                print_success("Session is active and working!")
                results["Authenticated Request"] = True
            elif response.status_code == 401:
                print_error("Authentication failed - Token invalid")
                results["Authenticated Request"] = False
            else:
                print_error(f"Unexpected status: {response.status_code}")
                results["Authenticated Request"] = False
        except Exception as e:
            print_error(f"Error: {str(e)}")
            results["Authenticated Request"] = False
        
        # SUMMARY
        self.print_summary(results)
    
    def print_summary(self, results):
        """Print test summary"""
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80 + "\n")
        
        for test_name, result in results.items():
            if result:
                print_success(f"{test_name}")
            else:
                print_error(f"{test_name}")
        
        total_tests = len(results)
        passed_tests = sum(1 for r in results.values() if r)
        
        print("\n" + "="*80)
        if passed_tests == total_tests:
            print(f"{Colors.GREEN}✓ ALL TESTS PASSED! ({passed_tests}/{total_tests}){Colors.END}")
        else:
            print(f"{Colors.RED}✗ {total_tests - passed_tests} TESTS FAILED ({passed_tests}/{total_tests} passed){Colors.END}")
        print("="*80)
        
        print(f"\n{Colors.CYAN}Test Account Created:{Colors.END}")
        print(f"  Email:    {self.test_user['email']}")
        print(f"  Password: {self.test_user['password']}")
        print(f"  PIN:      {self.test_user['pin']}")
        if 'id' in self.test_user:
            print(f"  User ID:  {self.test_user['id']}")
        
        print(f"\n{Colors.CYAN}You can use these credentials to test:"){Colors.END}")
        print(f"  1. Login at: http://localhost:3000/login")
        print(f"  2. Or use the credentials above")
        print()
    
    def cleanup(self):
        """Cleanup"""
        if self.client:
            self.client.close()

if __name__ == "__main__":
    tester = AutomatedAuthTester()
    try:
        tester.test_complete_flow()
    finally:
        tester.cleanup()
