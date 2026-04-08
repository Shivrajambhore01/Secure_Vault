"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Wallet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    checkConnection();
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(accounts[0]);
        } else {
          setAddress(null);
        }
      });
    }
  }, []);

  async function checkConnection() {
    if (typeof window !== "undefined" && window.ethereum) {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts.length > 0) {
        setAddress(accounts[0]);
      }
    }
  }

  async function connectWallet() {
    if (!window.ethereum) {
      toast.error("MetaMask not found", {
        description: "Please install the MetaMask extension to use blockchain features.",
      });
      return;
    }

    try {
      setIsConnecting(true);
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      setAddress(accounts[0]);
      toast.success("Wallet Connected", {
        description: `Connected to ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`,
      });
    } catch (error) {
      console.error("Wallet connection error:", error);
      toast.error("Connection Failed", {
        description: "Could not connect to MetaMask. Please try again.",
      });
    } finally {
      setIsConnecting(false);
    }
  }

  if (address) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm font-medium transition-all hover:bg-emerald-500/15">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="hidden sm:inline">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <CheckCircle2 className="w-4 h-4 ml-1" />
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={connectWallet}
      disabled={isConnecting}
      className="gap-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5 group transition-all duration-300"
    >
      {isConnecting ? (
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
      ) : (
        <Wallet className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
      )}
      <span className="hidden sm:inline">
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </span>
    </Button>
  );
}
