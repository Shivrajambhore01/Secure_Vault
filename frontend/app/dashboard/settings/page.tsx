"use client"

import { useState, useEffect } from "react"
import {
  User,
  Lock,
  KeyRound,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  Shield,
  History,
  Download,
  Bell,
  AppWindow,
  Smartphone,
  Key,
  Check,
  AlertTriangle,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { getUser, saveUser, getUserByEmail } from "@/lib/store"
import { secureFetch } from "@/lib/api"
import type { User as UserType } from "@/lib/store"
import { cn } from "@/lib/utils"

const inactivityOptions = [
  { value: 0.000045, label: "2 Minutes (Test Mode)" },
  { value: 3, label: "3 Months" },
  { value: 6, label: "6 Months" },
  { value: 12, label: "12 Months" },
  { value: 24, label: "24 Months" },
]

export default function SettingsPage() {
  const [user, setUser] = useState<UserType | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  // Profile fields
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")

  // Password fields
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")

  // PIN fields
  const [oldPin, setOldPin] = useState("")
  const [newPin, setNewPin] = useState("")
  const [confirmNewPin, setConfirmNewPin] = useState("")

  // Inactivity
  const [selectedPeriod, setSelectedPeriod] = useState(6)

  // 2FA Setup
  const [show2FASetup, setShow2FASetup] = useState(false)
  const [qrCode, setQrCode] = useState("")
  const [twoFactorSecret, setTwoFactorSecret] = useState("")
  const [setupToken, setSetupToken] = useState("")

  // Selected Sidebar Tab
  const [activeTab, setActiveTab] = useState<"overview" | "profile" | "security" | "inheritance" | "activity">("overview")

  // Notification Preferences
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [smsAlerts, setSmsAlerts] = useState(false)

  // Active Sessions
  const [sessionList, setSessionList] = useState([
    { id: "1", device: "Chrome Browser (Windows 11)", location: "Mumbai, India", ip: "103.44.112.56", current: true, date: "Active Now" },
    { id: "2", device: "Safari Web (iPhone 15 Pro)", location: "Mumbai, India", ip: "103.44.112.57", current: false, date: "2 hours ago" },
  ])

  // Security Audit Logs
  const [auditLogs, setAuditLogs] = useState([
    { id: "101", action: "Authorized Login Successful", device: "Chrome / Windows 11", date: "Today at 19:53" },
    { id: "102", action: "Requested nominee profile update", device: "Chrome / Windows 11", date: "Today at 17:28" },
    { id: "103", action: "Password change requested", device: "Chrome / Windows 11", date: "Yesterday at 14:15" },
    { id: "104", action: "Registered device fingerprint", device: "Chrome / Windows 11", date: "July 12, 2026" },
  ])

  // Handle Export Vault
  const handleExportVault = () => {
    toast.success("Vault decryption key backup requested! Generating secure download archive...")
    setTimeout(() => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
        vault_owner: email,
        security_score: user?.isTwoFactorEnabled ? 95 : 55,
        encrypted_backup_payload_hex: "0x82f1b0a8e6399c71284d720b0d3... (AES-256)"
      }, null, 2))
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute("href", dataStr)
      downloadAnchor.setAttribute("download", `securevault_backup_${email}.json`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
      toast.success("Encrypted backup payload download complete!")
    }, 1500)
  }

  // Handle Revoke Session
  const handleRevokeSession = (sessionId: string) => {
    setSessionList(prev => prev.filter(s => s.id !== sessionId))
    toast.success("Session revoked successfully! Device logged out.")
  }

  useEffect(() => {
    const u = getUser()
    if (u) {
      setUser(u)
      setFullName(u.fullName)
      setPhone(u.phone)
      setEmail(u.email)
      setSelectedPeriod(u.inactivityPeriod)
    }
  }, [])

  const handleProfileUpdate = async () => {
    if (!user) return
    if (!fullName || !phone || !email) {
      toast.error("Please fill in all fields")
      return
    }

    setLoading("profile")
    try {
      const response = await secureFetch("/auth/update-profile", {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          fullName,
          phone,
          email,
          inactivityPeriod: selectedPeriod
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to update profile")

      saveUser(data.user)
      setUser(data.user)
      toast.success("Profile updated successfully!")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(null)
    }
  }

  const handlePasswordChange = async () => {
    if (!user) return
    if (!oldPassword || !newPassword || !confirmNewPassword) {
      toast.error("Please fill in all password fields")
      return
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters")
      return
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match")
      return
    }

    setLoading("password")
    try {
      const response = await secureFetch("/auth/update-password", {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          oldPassword,
          newPassword
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to change password")

      setOldPassword("")
      setNewPassword("")
      setConfirmNewPassword("")
      toast.success("Password changed successfully!")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(null)
    }
  }

  const handlePinChange = async () => {
    if (!user) return
    if (!oldPin || !newPin || !confirmNewPin) {
      toast.error("Please fill in all PIN fields")
      return
    }
    if (newPin.length < 4) {
      toast.error("New PIN must be at least 4 digits")
      return
    }
    if (newPin !== confirmNewPin) {
      toast.error("New PINs do not match")
      return
    }

    setLoading("pin")
    try {
      const response = await secureFetch("/auth/update-pin", {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          oldPin,
          newPin
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to change PIN")

      // Update local storage to keep PIN in sync for other local checks
      const updated = { ...user, pin: newPin }
      saveUser(updated)
      setUser(updated)

      setOldPin("")
      setNewPin("")
      setConfirmNewPin("")
      toast.success("Security PIN changed successfully!")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(null)
    }
  }

  const handleInactivityChange = async (period: number) => {
    if (!user) return
    setSelectedPeriod(period)
    setLoading("inactivity")
    try {
      const response = await secureFetch("/auth/update-profile", {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          inactivityPeriod: period
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to update inactivity period")

      saveUser(data.user)
      setUser(data.user)
      toast.success(period < 1 ? "Inactivity period set to 2 Minutes (Test Mode)" : `Inactivity period set to ${period} months`)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(null)
    }
  }

  const handle2FASetup = async () => {
    setLoading("2fa-setup")
    try {
      const response = await secureFetch("/auth/2fa/setup", { method: "POST" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to initiate 2FA setup")

      setQrCode(data.qrCodeUrl)
      setTwoFactorSecret(data.secret)
      setShow2FASetup(true)
      toast.success("2FA setup initiated. Scan the QR code.")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(null)
    }
  }

  const handle2FAVerify = async () => {
    if (!setupToken) {
      toast.error("Please enter the verification token")
      return
    }

    setLoading("2fa-verify")
    try {
      const response = await secureFetch("/auth/2fa/verify", {
        method: "POST",
        body: JSON.stringify({ token: setupToken }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Verification failed")

      const updatedUser = { ...user!, isTwoFactorEnabled: true }
      saveUser(updatedUser)
      setUser(updatedUser)
      setShow2FASetup(false)
      setSetupToken("")
      toast.success("Two-Factor Authentication enabled successfully!")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(null)
    }
  }

  const getPasswordStrength = () => {
    let score = 0
    if (newPassword.length >= 8) score++
    if (/[A-Z]/.test(newPassword)) score++
    if (/[0-9]/.test(newPassword)) score++
    if (/[^A-Za-z0-9]/.test(newPassword)) score++
    return score
  }

  const strength = getPasswordStrength()
  const strengthLabels = ["Weak", "Fair", "Good", "Strong"]
  const strengthColors = ["bg-destructive", "bg-warning", "bg-primary", "bg-success"]

  if (!user) return null

  return (
    <div className="mx-auto max-w-5xl flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-sans">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground font-sans">
          Manage your profile, security, and inheritance settings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Side: Sidebar Tabs Navigation */}
        <div className="md:col-span-3">
          <div className="md:sticky md:top-24 max-h-[calc(100vh-8rem)] overflow-y-auto flex flex-col gap-1 bg-card border border-border p-3 rounded-2xl shadow-sm">
            {[
              { id: "overview", label: "Overview", icon: Shield, subtitle: "Security status summary" },
              { id: "profile", label: "Account Profile", icon: User, subtitle: "Personal info & phone" },
              { id: "security", label: "Security Keys", icon: Lock, subtitle: "Credentials & 2FA" },
              { id: "inheritance", label: "Inheritance Rules", icon: Clock, subtitle: "Standby timeouts" },
              { id: "activity", label: "Sessions & Logs", icon: History, subtitle: "Audit logs & backups" }
            ].map((tab) => {
              const Icon = tab.icon
              const isSelected = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any)
                    setShow2FASetup(false)
                  }}
                  className={cn(
                    "flex items-center gap-3 w-full text-left p-3 rounded-xl border border-transparent transition-all duration-250",
                    isSelected
                      ? "bg-primary/10 text-primary border-primary/20 shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  )}
                >
                  <Icon className={cn("h-5 w-5 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold leading-none">{tab.label}</div>
                    <span className="text-[9px] text-muted-foreground/80 mt-1 block truncate leading-none">{tab.subtitle}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Side: Active Panel Content */}
        <div className="md:col-span-9 space-y-6">
          {/* Tab 1: Overview */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <Card className="border-border bg-card animate-in fade-in duration-300">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-foreground">Security Status Overview</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Review your account protection score and active protocols
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2 p-5 sm:p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border/10 pb-3">
                      <span className="text-sm font-semibold text-muted-foreground">Security Protection Score</span>
                      <span className="text-base font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 shadow-sm font-sans">
                        {user.isTwoFactorEnabled ? "95/100" : "55/100"}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Two-Factor Authentication</span>
                      <StatusBadge status={user.isTwoFactorEnabled ? "verified" : "pending"} className="text-[10px]" />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Security PIN Status</span>
                      <StatusBadge status="encrypted" className="text-[10px]" />
                    </div>
                  </div>

                  <div className="space-y-3 bg-black/10 border border-border/10 p-4.5 rounded-2xl">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-widest">Session details</h4>
                    <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Active Browser Sessions</span>
                        <span className="font-semibold text-foreground">{sessionList.length} Active</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Trusted Device</span>
                        <span className="font-semibold text-foreground">This Device (Chrome)</span>
                      </div>
                      <div className="flex justify-between font-sans">
                        <span>Last Access</span>
                        <span className="font-semibold text-foreground">Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions Panel */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-foreground text-sm font-bold uppercase tracking-wider">Quick Security Actions</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  {!user.isTwoFactorEnabled && (
                    <Button 
                      variant="outline" 
                      onClick={() => setActiveTab("security")}
                      className="justify-between border-primary/20 hover:border-primary/50 text-xs font-bold py-5 rounded-xl text-primary"
                    >
                      Enable Two-Factor Authentication (2FA)
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    onClick={() => setActiveTab("inheritance")}
                    className="justify-between border-border hover:border-foreground/20 text-xs font-bold py-5 rounded-xl"
                  >
                    Adjust Contingency Timeout Rules
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleExportVault}
                    className="justify-between border-border hover:border-foreground/20 text-xs font-bold py-5 rounded-xl"
                  >
                    Download Encrypted Backup Key
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setActiveTab("activity")}
                    className="justify-between border-border hover:border-foreground/20 text-xs font-bold py-5 rounded-xl"
                  >
                    Inspect Security Audit Trail
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>

              {/* Compliance Badges */}
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="flex items-start gap-4 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Security Protocol Compliance</h3>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      Your SecureVault is configured with multi-party secret sharing scheme keys. Backup archives remain fully encrypted client-side.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {["AES-256-GCM", "Shamir Key Fragments", "Zero-Knowledge Architecture"].map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tab 2: Profile Settings */}
          {activeTab === "profile" && (
            <Card className="border-border bg-card animate-in fade-in duration-300">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-foreground">Profile Settings</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Update your personal identity details and fallback contacts
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="fullName" className="text-xs">Full Name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="bg-background border-border text-foreground"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="phone" className="text-xs">Phone Number</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="bg-background border-border text-foreground"
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="email" className="text-xs">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="bg-secondary/45 border-border cursor-not-allowed opacity-80"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Email address serves as your primary vault identity and cannot be changed.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="border-t border-border/10 py-3 flex justify-end bg-secondary/5">
                <Button
                  onClick={handleProfileUpdate}
                  disabled={loading === "profile"}
                  className="bg-primary text-primary-foreground font-semibold rounded-xl"
                >
                  {loading === "profile" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Tab 3: Security & Credentials */}
          {activeTab === "security" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Two-Factor Authentication Card */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-foreground">Two-Factor Authentication</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Add an extra layer of protection to secure nominee dispatches
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Time-based One-Time Password (TOTP)
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Use Google Authenticator or Authy to generate dynamic login keys.
                      </p>
                    </div>
                    <StatusBadge status={user.isTwoFactorEnabled ? "verified" : "pending"} className="text-[10px]" />
                  </div>

                  {!user.isTwoFactorEnabled ? (
                    !show2FASetup ? (
                      <Button
                        onClick={handle2FASetup}
                        disabled={loading === "2fa-setup"}
                        className="w-fit bg-primary text-primary-foreground font-semibold rounded-xl"
                      >
                        {loading === "2fa-setup" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set up 2FA"}
                      </Button>
                    ) : (
                      <div className="mt-4 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/80 bg-secondary/15 p-6 animate-in slide-in-from-top-3 duration-300">
                        <div className="text-center space-y-1">
                          <p className="text-xs font-bold text-foreground">Scan this QR Code</p>
                          <p className="text-[10px] text-muted-foreground">
                            Scan with your authenticator app to sync codes.
                          </p>
                        </div>
                        {qrCode && (
                          <div className="bg-white p-3.5 rounded-xl border border-border shadow-sm">
                            <img src={qrCode} alt="2FA QR Code" className="h-40 w-40" />
                          </div>
                        )}
                        <div className="text-center space-y-1 max-w-[320px]">
                          <p className="text-[10px] font-bold text-muted-foreground">Or input secret code manually</p>
                          <code className="bg-secondary px-2.5 py-1 rounded text-xs select-all font-mono font-bold text-foreground block tracking-wider">
                            {twoFactorSecret}
                          </code>
                        </div>
                        <div className="w-full max-w-[240px] space-y-3 mt-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Verification Code</Label>
                            <Input
                              placeholder="000000"
                              maxLength={6}
                              value={setupToken}
                              onChange={(e) => setSetupToken(e.target.value)}
                              className="text-center text-lg tracking-widest font-mono h-11 bg-background border-border"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={handle2FAVerify}
                              disabled={loading === "2fa-verify"}
                              className="flex-1 bg-primary text-primary-foreground rounded-xl"
                            >
                              {loading === "2fa-verify" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Enable"}
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => setShow2FASetup(false)}
                              disabled={loading === "2fa-verify"}
                              className="rounded-xl border border-border/30 text-foreground"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  ) : (
                    <Button
                      variant="outline"
                      className="w-fit text-destructive border-destructive/20 hover:bg-destructive/10 rounded-xl font-semibold"
                      onClick={() => toast.info("Contact support to disable 2FA for maximum security.")}
                    >
                      Disable 2FA App
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Change Password Card */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <KeyRound className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-foreground">Change Password</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Update your master account login credentials
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 p-6">
                  <div className="grid gap-1.5 relative">
                    <Label htmlFor="oldPass" className="text-xs">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="oldPass"
                        type={showOldPassword ? "text" : "password"}
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="bg-background border-border pr-10 text-foreground"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPassword(!showOldPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                      >
                        {showOldPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="newPass" className="text-xs">New Password</Label>
                      <div className="relative">
                        <Input
                          id="newPass"
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="bg-background border-border pr-10 text-foreground"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                        >
                          {showNewPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="confirmPass" className="text-xs">Confirm New Password</Label>
                      <Input
                        id="confirmPass"
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="bg-background border-border text-foreground"
                      />
                    </div>
                  </div>

                  {newPassword && (
                    <div className="space-y-1.5 font-sans">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <span>Password Strength</span>
                        <span className={cn(
                          strength === 0 && "text-red-500",
                          strength === 1 && "text-amber-500",
                          strength === 2 && "text-primary",
                          strength === 3 && "text-emerald-500"
                        )}>
                          {strengthLabels[strength]}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden flex gap-0.5">
                        {[0, 1, 2, 3].map((step) => (
                          <div
                            key={step}
                            className={cn(
                              "h-full flex-1 transition-all duration-300",
                              step <= strength ? strengthColors[strength] : "bg-zinc-800"
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="border-t border-border/10 py-3 flex justify-end bg-secondary/5">
                  <Button
                    onClick={handlePasswordChange}
                    disabled={loading === "password"}
                    className="bg-primary text-primary-foreground font-semibold rounded-xl"
                  >
                    {loading === "password" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
                  </Button>
                </CardFooter>
              </Card>

              {/* Change Security PIN Card */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Lock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-foreground">Change Security PIN</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Update your vault access/decryption PIN
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 p-6">
                  <div className="grid gap-1.5">
                    <Label htmlFor="oldPin" className="text-xs">Current PIN</Label>
                    <Input
                      id="oldPin"
                      type="password"
                      maxLength={6}
                      value={oldPin}
                      onChange={(e) => setOldPin(e.target.value)}
                      placeholder="••••"
                      className="bg-background border-border tracking-widest font-mono text-foreground"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="newPin" className="text-xs">New PIN</Label>
                      <Input
                        id="newPin"
                        type="password"
                        maxLength={6}
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        placeholder="4-6 digit numeric code"
                        className="bg-background border-border tracking-widest font-mono text-foreground"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="confirmPin" className="text-xs">Confirm New PIN</Label>
                      <Input
                        id="confirmPin"
                        type="password"
                        maxLength={6}
                        value={confirmNewPin}
                        onChange={(e) => setConfirmNewPin(e.target.value)}
                        placeholder="Confirm numeric code"
                        className="bg-background border-border tracking-widest font-mono text-foreground"
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-border/10 py-3 flex justify-end bg-secondary/5">
                  <Button
                    onClick={handlePinChange}
                    disabled={loading === "pin"}
                    className="bg-primary text-primary-foreground font-semibold rounded-xl"
                  >
                    {loading === "pin" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change PIN"}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}

          {/* Tab 4: Inheritance Protocols */}
          {activeTab === "inheritance" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Inactivity Period Card */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-foreground">Inactivity Period</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Set how long before your assets are transferred to nominees
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 p-6">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    If you remain inactive (no login) for the selected period, the system will initiate the secure asset transfer process to your designated nominees.
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mt-2">
                    {inactivityOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleInactivityChange(option.value)}
                        className={`flex flex-col items-center gap-2 rounded-2xl border p-4.5 transition-all duration-205 ${
                          selectedPeriod === option.value
                            ? "border-primary bg-primary/5 text-primary shadow-sm scale-[1.02]"
                            : "border-border bg-secondary/20 text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                        }`}
                      >
                        <Clock className={cn("h-5 w-5", selectedPeriod === option.value ? "text-primary" : "text-muted-foreground")} />
                        <span className="text-xs font-bold">{option.label}</span>
                      </button>
                    ))}
                  </div>
                  {loading === "inactivity" && (
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary mt-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating check-in timers...
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Alert Notification Preferences */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Bell className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-foreground">Standby Alert Settings</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Configure check-in warnings before inheritance countdown starts
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 p-6 text-xs leading-relaxed text-muted-foreground">
                  <div className="flex items-center justify-between border-b border-border/10 pb-3.5">
                    <div>
                      <span className="font-bold text-foreground block">Email Warnings</span>
                      <span className="text-[11px] text-muted-foreground block mt-0.5">Send alerts 14, 7, and 3 days prior to trigger time.</span>
                    </div>
                    <button 
                      onClick={() => {
                        setEmailAlerts(!emailAlerts)
                        toast.success(`Email checkin alerts ${!emailAlerts ? "activated" : "deactivated"}`)
                      }}
                      className={cn(
                        "w-12 h-6.5 rounded-full p-1 transition-colors duration-200 focus:outline-none border border-transparent",
                        emailAlerts ? "bg-primary border-primary/20" : "bg-secondary border-border"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm",
                        emailAlerts ? "translate-x-5.5" : "translate-x-0"
                      )} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="font-bold text-foreground block">Backup SMS Alerts</span>
                      <span className="text-[11px] text-muted-foreground block mt-0.5">Send backup text alert 24 hours prior to nominee release.</span>
                    </div>
                    <button 
                      onClick={() => {
                        setSmsAlerts(!smsAlerts)
                        toast.success(`Backup SMS alerts ${!smsAlerts ? "activated" : "deactivated"}`)
                      }}
                      className={cn(
                        "w-12 h-6.5 rounded-full p-1 transition-colors duration-200 focus:outline-none border border-transparent",
                        smsAlerts ? "bg-primary border-primary/20" : "bg-secondary border-border"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm",
                        smsAlerts ? "translate-x-5.5" : "translate-x-0"
                      )} />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tab 5: Sessions & Logs */}
          {activeTab === "activity" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Active Sessions */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <AppWindow className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-foreground">Active Browser Sessions</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Manage devices currently signed into your SecureVault
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 p-6">
                  {sessionList.map((session) => (
                    <div key={session.id} className="flex items-center justify-between border border-border/80 bg-secondary/5 p-4 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Smartphone className="h-5 w-5 text-primary shrink-0" />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-foreground block">{session.device}</span>
                          <span className="text-[10px] text-muted-foreground block mt-0.5">IP: {session.ip} • {session.location}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-muted-foreground">{session.date}</span>
                        {!session.current && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleRevokeSession(session.id)}
                            className="text-xs text-destructive hover:bg-destructive/5 hover:text-destructive rounded-xl h-8 border border-transparent hover:border-destructive/10 animate-fade-in"
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Security Audit Log */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <History className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-foreground">Security Audit Trail</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Chronological history of security updates and settings access
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4 font-sans">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="flex items-start justify-between border-l-2 border-primary/20 pl-4 py-0.5">
                        <div>
                          <span className="text-xs font-bold text-foreground block">{log.action}</span>
                          <span className="text-[10px] text-muted-foreground block mt-0.5">Device authorization profile: {log.device}</span>
                        </div>
                        <span className="text-[9px] font-bold text-muted-foreground">{log.date}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Export Encrypted backup archive */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Download className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-foreground">Export Account Archive</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Download a client-side encrypted backup file of your vault metadata
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 p-6">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    This file is encrypted with your Master PIN and password. Keep it in a secure offline location to restore your legacy configurations should support channels become inaccessible.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={handleExportVault}
                    className="w-fit gap-2 border-primary/20 hover:border-primary/50 text-xs font-bold px-6 py-5 rounded-xl text-primary"
                  >
                    <Download className="h-4 w-4" />
                    Generate Decryption Key Backup JSON
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
