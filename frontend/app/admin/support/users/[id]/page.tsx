"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  RefreshCw,
  Lock,
  Unlock,
  Key,
  ShieldAlert,
  Send,
  EyeOff,
  UserX,
  UserCheck,
  FileText,
  Users,
  Settings,
  HelpCircle
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  fetchSupportUserProfile,
  supportLockUser,
  supportUnlockUser,
  supportResetPassword,
  supportResetPin,
  supportDisable2FA,
  supportResendVerification,
  SupportUserProfile
} from "@/lib/support-api"
import { formatAdminBytes } from "@/lib/admin-store"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"

export default function UserSupportProfilePage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string

  const [profile, setProfile] = useState<SupportUserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)

  // Dialog states
  const [lockReason, setLockReason] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newPin, setNewPin] = useState("")
  
  const [showLockDialog, setShowLockDialog] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [showPinDialog, setShowPinDialog] = useState(false)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchSupportUserProfile(userId)
      setProfile(data)
    } catch (error: any) {
      toast.error("Failed to load user profile")
      router.push("/admin/support")
    } finally {
      setLoading(false)
    }
  }, [userId, router])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-"
    try {
      return format(parseISO(dateString.replace("Z", "+00:00")), "MMM d, yyyy HH:mm")
    } catch (e) {
      return dateString
    }
  }

  const isLocked = () => {
    if (!profile) return false
    if (profile.accountLocked) return true
    if (profile.lockedUntil) {
      const lockedDate = parseISO(profile.lockedUntil)
      return lockedDate > new Date()
    }
    return false
  }

  // Action handlers
  const handleUnlock = async () => {
    setActionInProgress("unlock")
    try {
      await supportUnlockUser(userId)
      toast.success("Account unlocked successfully")
      loadProfile()
    } catch (error: any) {
      toast.error(error.message || "Failed to unlock account")
    } finally {
      setActionInProgress(null)
    }
  }

  const handleLockSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lockReason.trim()) return
    setActionInProgress("lock")
    try {
      await supportLockUser(userId, lockReason)
      toast.success("Account locked successfully")
      setShowLockDialog(false)
      setLockReason("")
      loadProfile()
    } catch (error: any) {
      toast.error(error.message || "Failed to lock account")
    } finally {
      setActionInProgress(null)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.")
      return
    }
    setActionInProgress("password")
    try {
      await supportResetPassword(userId, newPassword)
      toast.success("Password reset successfully")
      setShowPasswordDialog(false)
      setNewPassword("")
      loadProfile()
    } catch (error: any) {
      toast.error(error.message || "Failed to reset password")
    } finally {
      setActionInProgress(null)
    }
  }

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPin.length < 4) {
      toast.error("PIN must be at least 4 digits.")
      return
    }
    setActionInProgress("pin")
    try {
      await supportResetPin(userId, newPin)
      toast.success("PIN reset successfully")
      setShowPinDialog(false)
      setNewPin("")
      loadProfile()
    } catch (error: any) {
      toast.error(error.message || "Failed to reset PIN")
    } finally {
      setActionInProgress(null)
    }
  }

  const handleDisable2FA = async () => {
    if (!confirm("Are you sure you want to disable 2FA for this user? This will downgrade their authentication requirements.")) return
    setActionInProgress("disable2fa")
    try {
      await supportDisable2FA(userId)
      toast.success("Two-Factor Authentication disabled successfully")
      loadProfile()
    } catch (error: any) {
      toast.error(error.message || "Failed to disable 2FA")
    } finally {
      setActionInProgress(null)
    }
  }

  const handleResendEmail = async () => {
    setActionInProgress("resend")
    try {
      await supportResendVerification(userId)
      toast.success("Verification email resent successfully")
    } catch (error: any) {
      toast.error(error.message || "Failed to resend verification email")
    } finally {
      setActionInProgress(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!profile) return null

  const locked = isLocked()

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/support")} className="border border-border">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Client Support Desk</h2>
          <p className="text-sm text-muted-foreground">Assist with user account updates, lockouts, and recovery options.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card & Action Console */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Account Overview</CardTitle>
              <CardDescription>Safe metadata profile summary.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">Full Name</span>
                  <span className="font-semibold text-foreground">{profile.fullName}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Email Address</span>
                  <span className="font-semibold text-foreground">{profile.email}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Phone</span>
                  <span className="font-medium text-foreground">{profile.phone || "Not specified"}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Date of Birth</span>
                  <span className="font-medium text-foreground">{profile.dob || "Not specified"}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Created At</span>
                  <span className="font-medium text-foreground">{formatDate(profile.createdAt)}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Last Active</span>
                  <span className="font-mono text-xs text-emerald-400">{formatDate(profile.lastActive)}</span>
                </div>
              </div>

              {/* Status Badges */}
              <div className="flex gap-2 flex-wrap pt-4 border-t border-border/40">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                  profile.isVerified
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                }`}>
                  {profile.isVerified ? "Email Verified" : "Email Unverified"}
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                  locked
                    ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                    : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                }`}>
                  {locked ? "Locked" : "Active"}
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                  profile.isTwoFactorEnabled
                    ? "bg-violet-500/10 text-violet-500 border-violet-500/20"
                    : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                }`}>
                  {profile.isTwoFactorEnabled ? "2FA Enabled" : "2FA Disabled"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Nominees Metadata Card */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                Nominees Registry ({profile.nomineeCount})
              </CardTitle>
              <CardDescription>Assigned heirs and nominees metadata details.</CardDescription>
            </CardHeader>
            <CardContent>
              {profile.nominees.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No nominees registered for this account.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground font-semibold">
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-3">Email</th>
                        <th className="py-2 px-3">Relationship</th>
                        <th className="py-2 px-3">Nominated Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.nominees.map((n) => (
                        <tr key={n._id} className="border-b border-border/40 last:border-b-0 hover:bg-muted/10">
                          <td className="py-2.5 px-3 font-semibold text-foreground">{n.nomineeName}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{n.nomineeEmail}</td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold">
                              {n.relationship}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-muted-foreground">{formatDate(n.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vault Assets Metadata Card */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                Vault Items Metadata ({profile.assetCount})
              </CardTitle>
              <CardDescription className="text-rose-400 flex items-center gap-1 font-semibold">
                <EyeOff className="w-4 h-4" />
                Decrypted vault asset content is fully hidden from support logs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {profile.assets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No files uploaded to this vault.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground font-semibold">
                        <th className="py-2 px-3">File Name</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3">File Type</th>
                        <th className="py-2 px-3">Storage Size</th>
                        <th className="py-2 px-3">Uploaded At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.assets.map((a) => (
                        <tr key={a._id} className="border-b border-border/40 last:border-b-0 hover:bg-muted/10">
                          <td className="py-2.5 px-3 font-semibold text-foreground truncate max-w-xs">{a.fileName}</td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-400">
                              {a.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{a.fileType}</td>
                          <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{formatAdminBytes(a.fileSize)}</td>
                          <td className="py-2.5 px-3 text-xs text-muted-foreground">{formatDate(a.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Action Panel */}
        <div className="space-y-6">
          <Card className="border-border bg-card border-emerald-500/10">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-500" />
                Support Operations Panel
              </CardTitle>
              <CardDescription>Direct modifications to user credentials and locking states.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Lock/Unlock Toggle */}
              {locked ? (
                <Button
                  onClick={handleUnlock}
                  disabled={actionInProgress !== null}
                  className="w-full justify-start gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl"
                >
                  <Unlock className="w-4 h-4" />
                  Unlock Account
                </Button>
              ) : (
                <Button
                  onClick={() => setShowLockDialog(true)}
                  disabled={actionInProgress !== null}
                  className="w-full justify-start gap-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl"
                >
                  <Lock className="w-4 h-4" />
                  Lock User Account
                </Button>
              )}

              {/* Reset Password */}
              <Button
                onClick={() => setShowPasswordDialog(true)}
                disabled={actionInProgress !== null}
                variant="outline"
                className="w-full justify-start gap-2 border-border text-foreground hover:bg-muted/10"
              >
                <Key className="w-4 h-4 text-emerald-500" />
                Force-Reset Password
              </Button>

              {/* Reset PIN */}
              <Button
                onClick={() => setShowPinDialog(true)}
                disabled={actionInProgress !== null}
                variant="outline"
                className="w-full justify-start gap-2 border-border text-foreground hover:bg-muted/10"
              >
                <ShieldAlert className="w-4 h-4 text-emerald-500" />
                Force-Reset security PIN
              </Button>

              {/* Account Recovery Options */}
              {profile.isTwoFactorEnabled && (
                <Button
                  onClick={handleDisable2FA}
                  disabled={actionInProgress !== null}
                  variant="outline"
                  className="w-full justify-start gap-2 border-border text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/20"
                >
                  <EyeOff className="w-4 h-4" />
                  Disable User 2FA (Recovery)
                </Button>
              )}

              {/* Verification email */}
              {!profile.isVerified && (
                <Button
                  onClick={handleResendEmail}
                  disabled={actionInProgress !== null}
                  variant="outline"
                  className="w-full justify-start gap-2 border-border text-foreground hover:bg-muted/10"
                >
                  <Send className="w-4 h-4 text-emerald-500" />
                  Resend Activation Email
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lock Dialog */}
      {showLockDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-250">
          <Card className="w-full max-w-md border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-rose-500">
                <UserX className="w-5 h-5" />
                Support Lockdown
              </CardTitle>
              <CardDescription>
                Emergency lock for {profile.fullName}. Instantly revokes all active device sessions.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleLockSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="lockReason" className="text-xs font-semibold text-muted-foreground">Reason for Lockout</label>
                  <Input
                    id="lockReason"
                    required
                    placeholder="e.g. Identity theft warning or user request"
                    value={lockReason}
                    onChange={(e) => setLockReason(e.target.value)}
                    className="bg-background border-border text-sm"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowLockDialog(false)
                      setLockReason("")
                    }}
                    className="border-border"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={actionInProgress === "lock"}
                    className="bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl"
                  >
                    {actionInProgress === "lock" ? "Locking..." : "Confirm Lockout"}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}

      {/* Password Dialog */}
      {showPasswordDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-250">
          <Card className="w-full max-w-md border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-emerald-500">
                <Key className="w-5 h-5" />
                Support Password Reset
              </CardTitle>
              <CardDescription>
                Force reset password for {profile.fullName}.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handlePasswordSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="newPassword" className="text-xs font-semibold text-muted-foreground">New Secure Password</label>
                  <Input
                    id="newPassword"
                    type="password"
                    required
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-background border-border text-sm"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowPasswordDialog(false)
                      setNewPassword("")
                    }}
                    className="border-border"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={actionInProgress === "password"}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl"
                  >
                    {actionInProgress === "password" ? "Resetting..." : "Confirm Reset"}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}

      {/* PIN Dialog */}
      {showPinDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-250">
          <Card className="w-full max-w-md border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-emerald-500">
                <ShieldAlert className="w-5 h-5" />
                Support Security PIN Reset
              </CardTitle>
              <CardDescription>
                Force reset the 4-digit security PIN for {profile.fullName}.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handlePinSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="newPin" className="text-xs font-semibold text-muted-foreground">New 4-digit security PIN</label>
                  <Input
                    id="newPin"
                    type="password"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    placeholder="e.g. 1234"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    className="bg-background border-border text-sm"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowPinDialog(false)
                      setNewPin("")
                    }}
                    className="border-border"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={actionInProgress === "pin"}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl"
                  >
                    {actionInProgress === "pin" ? "Resetting..." : "Confirm Reset"}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
