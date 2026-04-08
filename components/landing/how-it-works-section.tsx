"use client"

import { useEffect, useRef, useState } from "react"
import { UserPlus, Upload, Users, Clock } from "lucide-react"

const steps = [
  {
    icon: UserPlus,
    step: "01",
    title: "Create Your Vault",
    description:
      "Sign up with multi-factor authentication, create a security PIN, and set up your secure vault in minutes.",
  },
  {
    icon: Upload,
    step: "02",
    title: "Upload & Encrypt",
    description:
      "Upload your digital assets — documents, passwords, crypto keys. Each file is encrypted with AES-256 and hash-verified on blockchain.",
  },
  {
    icon: Users,
    step: "03",
    title: "Assign Nominees",
    description:
      "Designate trusted individuals as nominees. Choose which specific assets each nominee should receive.",
  },
  {
    icon: Clock,
    step: "04",
    title: "Automated Transfer",
    description:
      "Set your inactivity period. If triggered, the system verifies and securely transfers assets to your nominees via smart contracts.",
  },
]

export function HowItWorksSection() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true)
      },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="how-it-works" className="relative px-6 py-24" ref={ref}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-primary">
            How It Works
          </p>
          <h2 className="text-balance text-3xl font-bold text-foreground sm:text-4xl">
            Simple Steps to Protect Your Digital Legacy
          </h2>
        </div>

        <div className="relative grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Connecting line */}
          <div className="absolute left-0 right-0 top-16 hidden h-px bg-border lg:block" />

          {steps.map((item, i) => {
            const Icon = item.icon
            return (
              <div
                key={item.step}
                className={`relative text-center transition-all duration-700 ${
                  visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
                }`}
                style={{ transitionDelay: `${i * 200}ms` }}
              >
                <div className="relative z-10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary bg-background">
                  <Icon className="h-7 w-7 text-primary" />
                </div>
                <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-primary">
                  Step {item.step}
                </span>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
