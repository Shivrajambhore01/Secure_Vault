"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { 
  ArrowRight, 
  Lock, 
  ShieldCheck, 
  Database, 
  Users, 
  Terminal, 
  ChevronRight 
} from "lucide-react"
import { Button } from "@/components/ui/button"

export function HeroSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [activeStep, setActiveStep] = useState(0)
  const [exitingCard, setExitingCard] = useState<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationId: number
    const particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number }[] = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    // Create particles
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.4 + 0.1,
      })
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(56, 189, 189, ${p.opacity})`
        ctx.fill()
      })

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 150) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(56, 189, 189, ${0.08 * (1 - dist / 150)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      animationId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener("resize", resize)
    }
  }, [])

  const handleCardClick = () => {
    if (exitingCard !== null) return
    setExitingCard(activeStep)

    setTimeout(() => {
      setActiveStep((prev) => (prev + 1) % 3)
      setExitingCard(null)
    }, 300)
  }

  const getStackStyles = (idx: number) => {
    if (exitingCard === idx) {
      return "z-40 scale-95 opacity-0 pointer-events-none transition-all duration-300 ease-in"
    }

    let pos = (idx - activeStep + 3) % 3

    if (exitingCard !== null) {
      if (idx === (activeStep + 1) % 3) {
        pos = 0
      } else if (idx === (activeStep + 2) % 3) {
        pos = 1
      }
    }

    if (pos === 0) {
      return "z-30 scale-100 opacity-100 transition-all duration-300 ease-out"
    } else {
      return "z-10 scale-95 opacity-0 pointer-events-none transition-all duration-300 ease-out"
    }
  }

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-28 pb-16 bg-dot-grid">
      {/* Background Video */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover opacity-45 scale-105"
        >
          <source src="/hero-bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/50 to-background" />
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
      </div>

      <canvas ref={canvasRef} className="absolute inset-0 z-0 opacity-40 pointer-events-none" />

      {/* Radial glow */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute left-1/4 top-1/4 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[130px]" />
        <div className="absolute right-10 top-10 h-[300px] w-[300px] rounded-full bg-indigo-500/5 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center px-2 sm:px-6 lg:px-8">
        {/* Left Side: Content */}
        <div className="lg:col-span-7 text-left space-y-6 flex flex-col items-start animate-in fade-in slide-in-from-left-4 duration-700">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-white/5 bg-secondary/50 px-4.5 py-2 text-xs font-bold text-muted-foreground backdrop-blur-md">
            <ShieldCheck className="h-4.5 w-4.5 text-primary animate-pulse" />
            <span className="tracking-wide">Decentralized Cryptographic Legacy Vault</span>
          </div>

          <h1 className="text-balance text-4xl font-black leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-6xl xl:text-7xl">
            Secure Your Digital
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-indigo-400 to-[#a855f7] drop-shadow-sm">
              Legacy Forever
            </span>
          </h1>

          <p className="max-w-xl text-sm sm:text-base md:text-lg leading-relaxed text-muted-foreground font-medium">
            Archive critical credentials, sensitive files, and cryptocurrency custody keys. 
            Establish smart-contract contingency rules to automatically assign them to trusted nominees.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto pt-2">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto gap-2.5 bg-primary text-primary-foreground hover:bg-primary/95 shadow-lg shadow-primary/20 px-8 h-14 rounded-2xl text-sm font-bold hover:scale-[1.03] active:scale-[0.98] transition-all duration-200">
                Get Started Free
                <ArrowRight className="h-4.5 w-4.5" />
              </Button>
            </Link>
            <Link href="/login" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2.5 px-8 h-14 rounded-2xl text-sm font-bold border-white/10 bg-secondary/30 text-foreground hover:bg-secondary/60 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200">
                <Lock className="h-4.5 w-4.5" />
                Access Secure Vault
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-6 w-full border-t border-white/5 pt-8 mt-6">
            {[
              { value: "AES-256", label: "Symmetric Encryption" },
              { value: "100%", label: "Zero-Knowledge Custody" },
              { value: "24/7", label: "Standby Monitor" },
            ].map((stat) => (
              <div key={stat.label} className="space-y-1">
                <div className="text-xl sm:text-2xl font-black text-primary tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-primary to-indigo-500">
                  {stat.value}
                </div>
                <div className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground leading-tight">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Frameless Interactive Feature Highlights */}
        <div className="lg:col-span-5 flex justify-center items-center relative min-h-[440px] w-full pt-6">
          {/* Radial visual glow */}
          <div className="absolute inset-0 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative w-full max-w-[360px] h-[360px]">
            
            {/* Feature 1: Vault Inventory */}
            <div 
              onClick={handleCardClick}
              className={`absolute inset-0 bg-transparent flex flex-col justify-between cursor-pointer select-none p-6 text-center ${
                getStackStyles(0)
              }`}
            >
              <div className="relative z-10 flex flex-col items-center flex-grow justify-center">
                {/* 3D Circular Avatar Icon */}
                <div className="h-28 w-28 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shadow-lg shadow-primary/10 mb-6 transition-transform duration-300 hover:scale-105">
                  <Database className="h-12 w-12 text-primary drop-shadow-[0_4px_12px_rgba(56,189,189,0.5)] animate-pulse" />
                </div>
                <h3 className="text-2xl font-black tracking-tight text-foreground drop-shadow-md">Vault Inventory</h3>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed font-medium max-w-xs drop-shadow-sm">
                  Symmetric AES-256 local encryption. Secure zero-knowledge custody for credentials, files, and crypto keys.
                </p>
              </div>
              <div className="relative z-10 pt-4 flex items-center justify-center gap-2 text-xs font-bold text-primary animate-pulse hover:underline">
                <span>Next: Nominee Setup</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>

            {/* Feature 2: Nominee Setup */}
            <div 
              onClick={handleCardClick}
              className={`absolute inset-0 bg-transparent flex flex-col justify-between cursor-pointer select-none p-6 text-center ${
                getStackStyles(1)
              }`}
            >
              <div className="relative z-10 flex flex-col items-center flex-grow justify-center">
                {/* 3D Circular Avatar Icon */}
                <div className="h-28 w-28 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shadow-lg shadow-indigo-500/10 mb-6 transition-transform duration-300 hover:scale-105">
                  <Users className="h-12 w-12 text-indigo-400 drop-shadow-[0_4px_12px_rgba(129,140,248,0.5)]" />
                </div>
                <h3 className="text-2xl font-black tracking-tight text-foreground drop-shadow-md">Nominee Setup</h3>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed font-medium max-w-xs drop-shadow-sm">
                  Designate trusted heirs and key fragment holders. Set customized inactivity standby thresholds.
                </p>
              </div>
              <div className="relative z-10 pt-4 flex items-center justify-center gap-2 text-xs font-bold text-indigo-400 animate-pulse hover:underline">
                <span>Next: Heritage Dispatch</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>

            {/* Feature 3: Heritage Dispatch */}
            <div 
              onClick={handleCardClick}
              className={`absolute inset-0 bg-transparent flex flex-col justify-between cursor-pointer select-none p-6 text-center ${
                getStackStyles(2)
              }`}
            >
              <div className="relative z-10 flex flex-col items-center flex-grow justify-center">
                {/* 3D Circular Avatar Icon */}
                <div className="h-28 w-28 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/10 mb-6 transition-transform duration-300 hover:scale-105">
                  <Terminal className="h-12 w-12 text-amber-500 drop-shadow-[0_4px_12px_rgba(245,158,11,0.5)]" />
                </div>
                <h3 className="text-2xl font-black tracking-tight text-foreground drop-shadow-md">Heritage Dispatch</h3>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed font-medium max-w-xs drop-shadow-sm">
                  Automatic multi-party reassembly. Decentralized credentials transfer upon standby monitor breach.
                </p>
              </div>
              <div className="relative z-10 pt-4 flex items-center justify-center gap-2 text-xs font-bold text-amber-500 animate-pulse hover:underline">
                <span>Next: Vault Inventory</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}
