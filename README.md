# 🛡️ SecureVault

SecureVault is a premium, enterprise-grade digital inheritance and secure asset storage platform. It combines robust AES-256 encryption with a secure nominee system to ensure your digital legacy is protected, verified, and seamlessly transferred to your loved ones through an automated "Dead Man's Switch" mechanism.

## ✨ Core Features

### 🔐 Multi-Layered Security
- **AES-256-CBC Encryption**: Your sensitive data (passwords, documents, notes) is encrypted on the server before being stored in the database. Only you (and eventually your nominees) can decrypt it.
- **Secondary PIN Protection**: An extra layer of security for the most sensitive assets, requiring a separate 6-digit PIN.
- **Google OAuth 2.0 Integration**: Secure login using your Google account.
- **JWT-Based Sessions**: Secure session management using HTTP-only cookies.


### 📜 Automated Inheritance (The Nominee System)
- **Nominee Appointment**: Designate trusted individuals (nominees) for specific assets.
- **Inactivity Monitoring**: The system tracks your "last active" timestamp. If you are inactive beyond your chosen threshold (e.g., 3 months), the legacy process begins.
- **Transparent Transfer**: Nominees are notified and granted access through a secure, OTP-verified portal.

## 🚀 Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [MongoDB Atlas](https://www.mongodb.com/atlas) account

### 2. Installation
```bash
# Install dependencies
cd frontend && pnpm install
cd ../backend && pnpm install
```

### 3. Environment Setup
Fill in the `.env` files in the root and `backend/` directories. Refer to the [Setup Guide](docs/Setup.md) for details.

### 4. Running Locally
```bash
# Terminal 1: Frontend
cd frontend && npm run dev

# Terminal 2: Backend
cd backend && npm run dev
```

## 📂 Project Structure

- **`frontend/`**: Next.js App Router project containing all UI components, pages, and client-side logic.
- **`backend/`**: Express server handling the API, encryption, and the inactivity scheduler.
- **`docs/`**: Comprehensive project documentation.

## 📖 Detailed Guides

- 🏗️ [**Architecture Overview**](docs/Architecture.md): Deep dive into system design and the security model.
- 🔌 [**API Reference**](docs/API.md): Documentation of all backend endpoints.
- 🛠️ [**Setup & Installation**](docs/Setup.md): Instructions for local development.
- 🚀 [**Deployment Guide**](docs/Deployment.md): Steps to take SecureVault to production.

## ⚖️ License

This project is intended for private use and evaluation. All rights reserved.
