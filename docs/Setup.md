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
npm install

# Install backend dependencies
cd backend
npm install
```

## 🔐 Step 2: Configure Environment Variables

You need to create/update two `.env` files.

### Backend (`backend/.env`)
Create a file at `backend/.env` with the following:
```env
MONGODB_URI="your_mongodb_connection_string"
ENCRYPTION_KEY="a_32_character_hex_key"
PORT=5000
JWT_SECRET="your_random_jwt_secret"

# Email Configuration (for OTPs and Notifications)
EMAIL_USER="your_email@gmail.com"
EMAIL_PASS="your_app_password"

# Google OAuth
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"

# Twilio (Optional, for SMS notifications)
TWILIO_ACCOUNT_SID="your_sid"
TWILIO_AUTH_TOKEN="your_token"
TWILIO_PHONE_NUMBER="your_twilio_number"

# Blockchain Configuration (Polygon Amoy Testnet)
POLYGON_AMOY_RPC_URL="https://rpc-amoy.polygon.technology"
PRIVATE_KEY="your_server_wallet_private_key"
CONTRACT_ADDRESS="deployed_contract_address"
```

### Frontend (`.env.local`)
Create a file at the root `.env.local`:
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your_google_client_id"
# Backend API URL (default: http://localhost:5000)
NEXT_PUBLIC_API_URL="http://localhost:5000"
```

## 🚀 Step 3: Run the Application

You need to start both the frontend and the backend.

### Start Backend
```bash
cd backend
npm run dev # or: ts-node server.ts
```

### Start Frontend
```bash
# In the root directory
npm run dev
```

The application should now be accessible at `http://localhost:3000`.

## 🧪 Step 4: Testing

The backend includes several utility scripts for testing flows:
- `backend/test_flow.js`: Tests the end-to-end user flow.
- `backend/check_db.js`: Verifies database connection and data.
- `backend/full_test_pin.js`: Tests the secondary PIN authentication.

To run a test script:
```bash
cd backend
node test_flow.js
```
