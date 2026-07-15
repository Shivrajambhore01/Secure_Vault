"use client"

import { useState, useEffect } from "react"
import { User, Shield, Mail, Calendar, ShieldCheck, Clock, Key } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getAdminUser, ROLE_LABELS, ROLE_COLORS, STATUS_COLORS } from "@/lib/admin-store"

export default function AdminProfilePage() {
  const [admin, setAdmin] = useState<any | null>(null)

  useEffect(() => {
    setAdmin(getAdminUser())
  }, [])

  if (!admin) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          <p className="text-sm text-muted-foreground animate-pulse">Retrieving administrative profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Operator Profile</h2>
        <p className="text-muted-foreground text-sm">
          Detailed overview of your platform credentials and console access tokens.
        </p>
      </div>

      <Card className="border-border bg-card overflow-hidden relative">
        {/* Visual glassmorphic profile head banner */}
        <div className="h-28 bg-gradient-to-r from-violet-600/30 via-purple-600/20 to-indigo-600/10 border-b border-border relative">
          <div className="absolute -bottom-8 left-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600 text-white font-bold text-2xl shadow-xl shadow-violet-600/20 ring-4 ring-card">
            {admin.fullName.charAt(0).toUpperCase()}
          </div>
        </div>

        <CardContent className="pt-12 pb-6 px-6 space-y-6">
          {/* Main Info */}
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-foreground">{admin.fullName}</h3>
              <Badge variant="outline" className={`text-[10px] font-semibold capitalize border ${ROLE_COLORS[admin.role] || "border-border"}`}>
                {ROLE_LABELS[admin.role] || admin.role}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Platform Console Administrator</p>
          </div>

          <div className="border-t border-border pt-6 grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 text-sm">
              <div className="p-2 rounded-lg bg-muted border border-border text-muted-foreground">
                <Mail className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Corporate Email</p>
                <p className="font-mono text-foreground">{admin.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <div className="p-2 rounded-lg bg-muted border border-border text-muted-foreground">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Console Status</p>
                <Badge variant="outline" className={`text-[10px] font-bold border ${STATUS_COLORS[admin.status] || "border-border"}`}>
                  {admin.status}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <div className="p-2 rounded-lg bg-muted border border-border text-muted-foreground">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Provision Date</p>
                <p className="text-foreground">{admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : "N/A"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <div className="p-2 rounded-lg bg-muted border border-border text-muted-foreground">
                <Clock className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Last Login</p>
                <p className="text-foreground">{admin.lastLogin ? new Date(admin.lastLogin).toLocaleString() : "First Session"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
