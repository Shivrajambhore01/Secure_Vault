"use client"

import { ShieldCheck, Eye, KeyRound, Server, FileCheck, Fingerprint } from "lucide-react"

const items = [
  { icon: ShieldCheck, label: "AES-256 Encryption" },
  { icon: KeyRound, label: "JWT Authentication" },
  { icon: Fingerprint, label: "Multi-Factor Auth" },
  { icon: Server, label: "Secure Cloud Storage" },
  { icon: FileCheck, label: "Blockchain Hashing" },
  { icon: Eye, label: "Zero-Trust Access" },
]

export function SecuritySection() {
  return (
    <section id="security" className="relative px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-border bg-card p-8 sm:p-12">
          <div className="mb-10 text-center">
            <p className="mb-3 text-sm font-medium uppercase tracking-widest text-primary">
              Security First
            </p>
            <h2 className="text-balance text-3xl font-bold text-foreground sm:text-4xl">
              Enterprise-Grade Protection
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground">
              Your digital assets are protected by multiple layers of
              industry-leading security technologies.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {items.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-background p-5 transition-all hover:border-primary/40 hover:bg-secondary/30"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-center text-sm font-medium text-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
