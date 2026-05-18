# Deployment Guide - SecureVault

This guide explains how to deploy SecureVault to production environments.

## 📦 Frontend: Vercel

The frontend is a standard Next.js application and is best deployed on **Vercel**.

1. **Connect Repository**: Connect your GitHub repository to Vercel.
2. **Environment Variables**: Add all variables from `.env.local` to the Vercel project settings.
3. **Build Command**: `npm run build`.
4. **Deploy**: Vercel will automatically deploy on every push to `main`.

## ⚙️ Backend: Render or DigitalOcean

The backend is a Node.js/Express server that requires a persistent environment.

### Deployment on Render.com:
1. **New Web Service**: Connect your GitHub repository.
2. **Root Directory**: `backend`.
3. **Build Command**: `pnpm install`.
4. **Start Command**: `pnpm run start` (or `node dist/server.js` if pre-built).
5. **Environment Variables**: Add all variables from `backend/.env`.
6. **Health Check**: Set to `/api/health` if implemented, otherwise `/api/auth/me`.

## 🗄️ Database: MongoDB Atlas

1. **Cluster Setup**: Create a free or paid cluster on MongoDB Atlas.
2. **Network Access**: Allow your backend server's IP address (or `0.0.0.0/0` if using dynamic IPs).
3. **Database User**: Create a user with `readWrite` access.
4. **Connection String**: Copy the connection string and use it for `MONGODB_URI`.

## ⛓️ Blockchain: Polygon Amoy

1. **Faucet**: Get test MATIC from the [Polygon Amoy Faucet](https://faucet.polygon.technology/).
2. **Deployment**:
    ```bash
    cd blockchain
    npx hardhat run scripts/deploy.ts --network amoy
    ```
3. **Update Contract Address**: Copy the deployed contract address and update it in your backend's `CONTRACT_ADDRESS` env var.
