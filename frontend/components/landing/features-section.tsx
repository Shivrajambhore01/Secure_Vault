"use client"

import { useEffect, useRef, useState } from "react"
import {
  Shield,
  Lock,
  Users,
  Clock,
  FileKey,
  Blocks,
} from "lucide-react"

const features = [
  {
    icon: Lock,
    title: "AES-256 Encryption",
    description:
      "Every digital asset is encrypted with military-grade AES-256 encryption before being stored securely in the cloud.",
  },
  {
    icon: Blocks,
    title: "Blockchain Verification",
    description:
      "Cryptographic hashes are stored on blockchain, ensuring tamper-proof ownership verification and transparency.",
  },
  {
    icon: Users,
    title: "Nominee Assignment",
    description:
      "Designate trusted nominees who will securely receive your digital assets based on your predefined conditions.",
  },
  {
    icon: Clock,
    title: "Inactivity Detection",
    description:
      "Smart monitoring detects prolonged inactivity and initiates secure verification and automated asset transfer.",
  },
  {
    icon: FileKey,
    title: "PIN-Protected Access",
    description:
      "Multi-layer security with PIN protection ensures only you can view, edit, or manage your sensitive assets.",
  },
  {
    icon: Shield,
    title: "Smart Contracts",
    description:
      "Automated smart contracts handle secure asset release upon verified conditions with no manual intervention.",
  },
]

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof features)[0]
  index: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true)
      },
      { threshold: 0.15 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const Icon = feature.icon

  return (
    <div
      ref={ref}
      className={`group relative rounded-xl border border-border bg-card p-6 transition-all duration-500 hover:border-primary/40 hover:bg-secondary/50 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-foreground">{feature.title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
    </div>
  )
}

export function FeaturesSection() {
  return (
    <section id="features" className="relative px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-primary">
            Features
          </p>
          <h2 className="text-balance text-3xl font-bold text-foreground sm:text-4xl">
            Everything You Need to Secure Your Legacy
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-muted-foreground">
            Built with cutting-edge blockchain technology, cryptographic security, and
            smart contract automation to protect what matters most.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
