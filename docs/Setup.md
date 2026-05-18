# Setup Guide - SecureVault

Follow these instructions to set up SecureVault locally for development.

## 📋 Prerequisites

- **Node.js**: v18.x or higher.
- **npm** or **pnpm**: (pnpm is recommended).
- **MongoDB**: A running MongoDB instance or a MongoDB Atlas cluster.
- **Google Cloud Console Account**: For Google OAuth credentials.

## 🛠️ Step 1: Clone and Install Dependencies

```bash
git clone <repository-url>
cd SecureVault

# Install frontend dependencies
cd frontend
pnpm install

# Install backend dependencies
cd ../backend
pnpm install
```

## 🔐 Step 2: Configure Environment Variables

You need to create/update two `.env` files.

### Backend (`backend/.env`)
Create a file at `backend/.env` with the following:
```env
MONGODB_URI="your_mongodb_connection_string" # Atlas or local MongoDB URL
ENCRYPTION_KEY="a_32_character_hex_key"       # Must be exactly 32 hex chars
PORT=5000                                     # Backend port
JWT_SECRET="your_random_jwt_secret"           # Secure string for signing tokens

# Email Configuration (for OTPs)
EMAIL_USER="your_email@gmail.com"             # SMTP sender email
EMAIL_PASS="your_app_password"               # App-specific password (not login pass)

# Google OAuth
GOOGLE_CLIENT_ID="your_google_id"             # From Google Cloud Console
GOOGLE_CLIENT_SECRET="your_google_secret"     

```

### Frontend (`frontend/.env.local`)
Create a file at `frontend/.env.local`:
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your_google_id"
NEXT_PUBLIC_API_URL="http://localhost:5000"
```

## 🚀 Step 3: Run the Application

### Start Backend
```bash
cd backend
pnpm run dev
```

### Start Frontend
```bash
cd frontend
pnpm run dev
```

The application should now be accessible at `http://localhost:3000`.

## 🧪 Step 4: Testing & Troubleshooting

### **Common Issues**
1. **MongoDB Connection Failed**: 
   - Ensure your IP address is whitelisted in MongoDB Atlas.
   - Check if `MONGODB_URI` is correctly formatted.
2. **Encryption Key Error**: 
   - Ensure `ENCRYPTION_KEY` is a valid 32-character hexadecimal string.
3. **Google Login Fails**:
   - Verify that your Authorized Redirect URIs in Google Console include `http://localhost:3000`.

### **Test Scripts**
The backend includes several utility scripts:
- `backend/check_db.js`: Verifies database connection.
- `backend/full_test_pin.js`: Tests the secondary PIN logic.

Run with: `node backend/check_db.js`
