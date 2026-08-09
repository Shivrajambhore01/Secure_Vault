# 🐳 SecureVault Docker Collaborator Guide

Welcome to **SecureVault**! This guide provides complete step-by-step instructions for new collaborators to clone, configure, build, run, and manage the containerized environment.

---

## 📋 Step 1: Prerequisites Check

Ensure you have installed:
- **Git**
- **Docker Desktop** (with Docker Engine & Docker Compose v2+)

Verify installation in your terminal:
```bash
docker --version
docker compose version
```

---

## 🚀 Step 2: Clone & Navigate

```bash
git clone <repository-url>
cd SecureVault
```

---

## ⚙️ Step 3: Environment Setup

The repository contains a pre-configured [.env.docker](file:///c:/Users/Shivraj/Downloads/SecureVault/.env.docker) file used by Docker Compose.

If you need custom keys or a local database, verify or update [.env.docker](file:///c:/Users/Shivraj/Downloads/SecureVault/.env.docker):
- `MONGODB_URI`: Connection string to your MongoDB Atlas cluster or local database.
- `ENCRYPTION_KEY`: Secret string (32 characters).
- `JWT_SECRET`: Signing secret for user sessions.
- `ADMIN_JWT_SECRET`: Separate signing secret for admin sessions.

---

## 🏗️ Step 4: Build & Launch Containers

Run the following single command to build both images and start all container services in detached mode:

```bash
docker compose up -d --build
```

### Access Applications & Endpoints:
- **🌐 Frontend Web App**: [http://localhost:3001](http://localhost:3001)
- **⚙️ Backend API**: [http://localhost:8000](http://localhost:8000)
- **📖 Swagger API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **🏥 System Health Probe**: [http://localhost:8000/health](http://localhost:8000/health)

---

## 🔑 Step 5: Initial Admin Account Setup

Create the initial Super Admin account inside the backend container:

```bash
docker compose exec backend python create_super_admin.py
```
Follow the interactive prompt to set up your Super Admin credentials.

---

## 🛠️ Step 6: Daily Development Workflow & Commands

### 1. View Running Services
```bash
docker compose ps
```

### 2. Monitor Container Logs
- **All logs (live streaming)**:
  ```bash
  docker compose logs -f
  ```
- **Backend logs only**:
  ```bash
  docker compose logs -f backend
  ```
- **Frontend logs only**:
  ```bash
  docker compose logs -f frontend
  ```

### 3. Stop Containers
```bash
docker compose down
```

### 4. Restart Services
```bash
docker compose restart
```

### 5. Run Utility & Diagnostic Scripts inside Container
```bash
# Clear session caches / reset test states
docker compose exec backend python clear_session.py

# Run OTP / 2FA diagnostics
docker compose exec backend python otp_diagnostic.py
```

---

## ⚙️ Architecture Overview

```
                        ┌───────────────────────────────┐
                        │   Browser Client (:3001)      │
                        └───────────────┬───────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Docker Host Network                                                     │
│                                                                         │
│   ┌──────────────────────────────┐     ┌──────────────────────────────┐ │
│   │ securevault-frontend         │     │ securevault-backend          │ │
│   │ (Next.js Standalone Node)    │────►│ (FastAPI + Uvicorn)          │ │
│   │ Port: 3001                   │     │ Port: 8000                   │ │
│   └──────────────────────────────┘     └──────────────┬───────────────┘ │
│                                                       │                 │
└───────────────────────────────────────────────────────┼─────────────────┘
                                                        │
                                                        ▼
                                        ┌───────────────────────────────┐
                                        │ External / Atlas MongoDB      │
                                        └───────────────────────────────┘
```
