"use client"

import { Card, CardContent } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"

interface VerificationStatCardProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
  color?: string
}

export function VerificationStatCard({ title, value, description, icon: Icon, color = "text-blue-500 bg-blue-500/10 border-blue-500/20" }: VerificationStatCardProps) {
  return (
    <Card className="overflow-hidden border border-border bg-card hover:border-blue-500/30 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(59,130,246,0.05)] group">
      <CardContent className="p-6 relative">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground group-hover:text-blue-400 transition-colors">
              {title}
            </p>
            <h3 className="text-3xl font-bold tracking-tight text-foreground font-mono">
              {value}
            </h3>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>
          <div className={`p-3 rounded-xl border ${color} transition-transform duration-300 group-hover:scale-110`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        
        {/* Sleek bottom gradient strip */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </CardContent>
    </Card>
  )
}
