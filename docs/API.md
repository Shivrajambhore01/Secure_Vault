# API Reference - SecureVault

This document provides a reference for the SecureVault backend API endpoints. All routes are prefixed with `/api`.

## 🔐 Authentication (`/api/auth`)

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/signup` | POST | Register a new user | No |
| `/login` | POST | Login with email/password | No |
| `/google-auth` | POST | Login or signup with Google OAuth | No |
| `/2fa/setup` | POST | Generate 2FA secret and QR code | Yes (JWT) |
| `/2fa/verify` | POST | Verify and enable 2FA | Yes (JWT) |
| `/2fa/login-verify` | POST | Verify 2FA token during login | No |
| `/send-otp` | POST | Send an OTP to the user's email | No |
| `/verify-otp` | POST | Verify an OTP | No |
| `/verify-pin` | POST | Verify the user's secondary PIN | No |
| `/update-pin` | POST | Update the user's secondary PIN | Yes (JWT) |
| `/me/:userId` | GET | Fetch the current user's profile | Yes (JWT) |
| `/update-profile`| POST | Update user profile information | Yes (JWT) |
| `/update-password`| POST | Update user password | Yes (JWT) |
| `/update-plan` | POST | Upgrade user storage plan | Yes (JWT) |
| `/heartbeat` | POST | Update user's `lastActive` timestamp | Yes (JWT) |

## 📦 Asset Management (`/api/assets`)

All asset routes require JWT authentication.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/:userId` | GET | Fetch all assets belonging to a user |
| `/` | POST | Create or update an asset (supports file upload) |
| `/:userId/:id` | DELETE | Delete an asset and free up storage |

**POST `/api/assets` Details:**
- Uses `multipart/form-data`.
- Fields: `id` (optional), `userId`, `name`, `type`, `description`, `nomineeId`, `content`, `file`.

## 👥 Nominee System (`/api/nominees`)

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/:userId` | GET | Fetch all nominees for a user | Yes (JWT) |
| `/` | POST | Create or update a nominee | Yes (JWT) |
| `/:userId/:id` | DELETE | Delete a nominee | Yes (JWT) |
| `/verify/:token` | GET | Verify a nominee access token | No |
| `/send-otp` | POST | Send OTP to a nominee's email | No |
| `/verify-otp` | POST | Verify nominee OTP and get session | No |
| `/assets/:sessionToken` | GET | Fetch assets assigned to a nominee | No |

## 🛠️ Global Middlewares

- **`authenticateJWT`**: Verifies the `accessToken` cookie.
- **`authorizeRoles`**: Restricts access based on user roles (`user`, `admin`).
