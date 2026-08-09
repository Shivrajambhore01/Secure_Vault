"use client"

import { Card, CardContent } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"

interface SecurityStatCardProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
  color?: string
}

export function SecurityStatCard({
  title,
  value,
  description,
  icon: Icon,
  color = "text-rose-500 bg-rose-500/10 border-rose-500/20"
}: SecurityStatCardProps) {
  return (
    <Card className="overflow-hidden border border-border bg-card hover:border-rose-500/30 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(244,63,94,0.05)] group">
      <CardContent className="p-6 relative">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground group-hover:text-rose-400 transition-colors">
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
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-rose-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </CardContent>
    </Card>
  )
}
