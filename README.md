# SecureVault

SecureVault is a comprehensive web application designed for secure digital asset storage and legacy planning. It allows users to safely store sensitive information, documents, and assets, with a robust "Nominee" system to ensure that your digital legacy is passed on to your loved ones in case of prolonged inactivity.

## 🚀 Key Features

- **Secure Storage**: Store and encrypt sensitive data using AES-256-CBC encryption.
- **Blockchain Verification**: Assets are verified on the Polygon network using SHA-256 metadata hashes.
- **Automated Inheritance**: Decentralized inheritance logic via the `SecureVaultInheritance` smart contract.
- **Nominee System**: Appoint nominees who will receive access to specific assets if you are inactive for a predefined period.
- **Inactivity Monitoring**: A background scheduler monitors user activity and triggers the legacy transfer process if necessary.
- **Multi-Factor Authentication**: Support for PIN-based secondary authentication and Google OAuth.
- **Unified Dashboard**: Manage all your assets, nominees, and security settings from a sleek, modern interface.

## 🛠️ Tech Stack

### Frontend
- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Components**: [Radix UI](https://www.radix-ui.com/) & [Shadcn UI](https://ui.shadcn.com/)
- **Icons**: [Lucide React](https://lucide.dev/)

### Backend
- **Server**: [Node.js](https://nodejs.org/) with [Express](https://expressjs.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database**: [MongoDB Atlas](https://www.mongodb.com/atlas)
- **Authentication**: JWT & Google OAuth 2.0
- **Encryption**: Node.js `crypto` module (AES-256-CBC)

## 📁 Project Structure

```text
SecureVault/
├── app/                # Next.js App Router (Frontend Pages)
├── backend/            # Express Server (API & Logic)
│   ├── routes/         # API Endpoints (Auth, Assets, Nominees)
│   ├── lib/            # Utilities (Encryption, DB, Scheduler)
│   └── uploads/        # Local storage for asset files
├── components/         # Reusable UI Components
├── hooks/              # Custom React Hooks
├── lib/                # Shared utilities & configurations
└── public/             # Static assets
```

## 📖 Documentation

For more detailed information, please refer to the following guides in the `docs/` directory:

- [**Architecture Overview**](docs/Architecture.md): Deep dive into the system design and security model.
- [**API Reference**](docs/API.md): Detailed documentation of all backend API endpoints.
- [**Setup Guide**](docs/Setup.md): Instructions for local development and deployment.

## ⚖️ License

This project is private and intended for personal use or internal evaluation.