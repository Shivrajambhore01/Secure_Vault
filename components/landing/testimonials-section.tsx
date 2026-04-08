"use client"

import { useEffect, useRef, useState } from "react"
import { Star } from "lucide-react"

const testimonials = [
  {
    name: "Arjun Mehta",
    role: "Crypto Investor",
    quote:
      "SecureVault gives me peace of mind knowing my crypto keys and wallet passwords will reach my family if anything happens to me. The encryption is top-notch.",
    rating: 5,
  },
  {
    name: "Priya Sharma",
    role: "Estate Planner",
    quote:
      "As a professional estate planner, I recommend SecureVault to all my clients. The smart contract automation and nominee system are exactly what digital inheritance needs.",
    rating: 5,
  },
  {
    name: "Rahul Gupta",
    role: "Business Owner",
    quote:
      "I store all my business-critical passwords and legal documents here. The PIN-protected access and inactivity detection make it incredibly secure.",
    rating: 5,
  },
  {
    name: "Sneha Patil",
    role: "Software Engineer",
    quote:
      "The blockchain verification for every asset gives me confidence that nothing can be tampered with. The multi-step authentication is exactly what I need.",
    rating: 4,
  },
  {
    name: "Vikram Singh",
    role: "Financial Advisor",
    quote:
      "I have been looking for a reliable digital inheritance platform for years. SecureVault is exactly what the industry needed. Simple, secure, and trustworthy.",
    rating: 5,
  },
  {
    name: "Anita Roy",
    role: "Retired Professor",
    quote:
      "Even as someone who is not very tech-savvy, I found SecureVault easy to use. Setting up nominees and uploading documents was straightforward.",
    rating: 5,
  },
]

function TestimonialCard({
  testimonial,
  index,
}: {
  testimonial: (typeof testimonials)[0]
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

  return (
    <div
      ref={ref}
      className={`flex flex-col gap-4 rounded-xl border border-border bg-card p-6 transition-all duration-500 hover:border-primary/30 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < testimonial.rating
                ? "fill-warning text-warning"
                : "text-muted-foreground/30"
            }`}
          />
        ))}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {`"${testimonial.quote}"`}
      </p>
      <div className="mt-auto flex items-center gap-3 border-t border-border pt-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {testimonial.name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{testimonial.name}</p>
          <p className="text-xs text-muted-foreground">{testimonial.role}</p>
        </div>
      </div>
    </div>
  )
}

export function TestimonialsSection() {
  return (
    <section className="relative px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-primary">
            Testimonials
          </p>
          <h2 className="text-balance text-3xl font-bold text-foreground sm:text-4xl">
            Trusted by Thousands
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-muted-foreground">
            See what our users have to say about securing their digital legacy
            with SecureVault.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <TestimonialCard key={t.name} testimonial={t} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
