"use client"

import Link from "next/link"
import { ArrowRight, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CTASection() {
  return (
    <section className="relative px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-8 sm:p-14">
          {/* Background glow */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-20 -top-20 h-[300px] w-[300px] rounded-full bg-primary/5 blur-[80px]" />
            <div className="absolute -bottom-20 -left-20 h-[300px] w-[300px] rounded-full bg-primary/5 blur-[80px]" />
          </div>

          <div className="relative flex flex-col items-center gap-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>

            <h2 className="text-balance text-3xl font-bold text-foreground sm:text-4xl">
              Start Protecting Your Digital Legacy Today
            </h2>

            <p className="max-w-xl text-pretty text-muted-foreground">
              Join thousands of users who trust SecureVault to safeguard their
              digital assets and ensure seamless inheritance for their loved
              ones. Free to start, no credit card required.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-6 text-base"
                >
                  Create Your Vault
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 border-border text-foreground hover:bg-secondary px-8 py-6 text-base"
                >
                  Login to Existing Vault
                </Button>
              </Link>
            </div>

            <p className="text-xs text-muted-foreground">
              AES-256 encrypted. Blockchain verified. Your data stays yours.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
