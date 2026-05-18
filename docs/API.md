# API Reference - SecureVault

This document provides a reference for the SecureVault backend API endpoints. All routes are prefixed with `/api`.

## 🔐 Authentication (`/api/auth`)

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/signup` | POST | Register a new user | No |
| `/login` | POST | Login with email/password | No |
| `/me/:userId` | GET | Fetch user profile | Yes (JWT) |
| `/heartbeat` | POST | Update `lastActive` timestamp | Yes (JWT) |

### **POST `/api/auth/login` Example:**
**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```
**Response (200 OK):**
```json
{
  "message": "Login successful",
  "user": { "id": "user123", "name": "John Doe", "email": "user@example.com" }
}
```

## 📦 Asset Management (`/api/assets`)

All asset routes require JWT authentication.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/:userId` | GET | Fetch all assets belonging to a user |
| `/` | POST | Create or update an asset (supports file upload) |
| `/:userId/:id` | DELETE | Delete an asset |

### **POST `/api/assets` Details:**
- Uses `multipart/form-data`.
- Fields: `userId`, `name`, `type` (Note, Password, File), `description`, `content` (encrypted), `file` (optional).

**Response (201 Created):**
```json
{
  "message": "Asset created successfully",
  "asset": {
    "id": "asset789",
    "name": "My Bitcoin Seed",
    "type": "Password",
    "onChainHash": "0xabc123..."
  }
}
```

## 👥 Nominee System (`/api/nominees`)

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/:userId` | GET | Fetch all nominees for a user | Yes (JWT) |
| `/` | POST | Create or update a nominee | Yes (JWT) |
| `/verify/:token` | GET | Verify a nominee access token | No |
| `/assets/:sessionToken` | GET | Fetch assets for a nominee | No |

### **GET `/api/nominees/assets/:token` Example:**
**Response (200 OK):**
```json
{
  "assets": [
    {
      "name": "Emergency Contact Info",
      "content": "iv:encrypted_data...",
      "isDecrypted": false
    }
  ]
}
```

## 🛠️ Global Middlewares

- **`authenticateJWT`**: Verifies the `accessToken` cookie.
- **`authorizeRoles`**: Restricts access based on user roles (`user`, `admin`).
