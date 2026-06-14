# Tech Stack Documentation - SecureVault

SecureVault is built with a modern, high-performance stack focused on security, reliability, and excellent user experience. 

## 🎨 Frontend (Client-Side)

The frontend is a state-of-the-art web application built for speed and accessibility.

- **Framework**: [Next.js 16+](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Component Library**: [Shadcn UI](https://ui.shadcn.com/) (built on [Radix UI](https://www.radix-ui.com/))
- **Icons**: [Lucide React](https://lucide.dev/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Notifications**: [Sonner](https://sonner.emilkowal.ski/)
- **Form Handling**: [React Hook Form](https://react-hook-form.com/) with [Zod](https://zod.dev/) validation

## ⚙️ Backend (Server-Side)

The backend provides a secure API and handles core business logic and encryption.

- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js](https://expressjs.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database Driver**: [MongoDB Native Driver](https://www.mongodb.com/docs/drivers/node/current/)
- **Security & Cryptography**:
    - **AES-256-CBC**: For asset content encryption (via `crypto` module).
    - **Bcrypt.js**: For secure password hashing.
    - **Speakeasy**: For TOTP-based Two-Factor Authentication.
    - **JSON Web Tokens (JWT)**: For session management via HTTP-only cookies.
- **Automation**: [node-cron](https://www.npmjs.com/package/node-cron) for the inactivity scheduler.
- **Authentication**: [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2) via `google-auth-library`.

## 🗄️ Storage & Database

- **Database**: [MongoDB Atlas](https://www.mongodb.com/atlas) (Cloud NoSQL)
- **Asset Storage**: Local filesystem storage for uploaded files.

## 📂 Project Structure

```text
SecureVault/
├── frontend/             # Next.js Application
│   ├── app/              # Routing and Pages
│   ├── components/       # UI Components
│   └── lib/              # Frontend Utilities
├── backend/              # Node.js Express Server
│   ├── routes/           # API Endpoints
│   ├── lib/              # Security & Server Logic
│   └── uploads/          # Physical Asset Storage
└── docs/                 # Documentation
```
