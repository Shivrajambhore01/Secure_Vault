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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { getUser, saveUser, getUserByEmail } from "@/lib/store"
import { secureFetch } from "@/lib/api"
import type { User as UserType } from "@/lib/store"

const inactivityOptions = [
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
      toast.success(`Inactivity period set to ${period} months`)
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
    <div className="mx-auto max-w-3xl flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile, security, and inheritance settings.
        </p>
      </div>

      {/* Profile Settings */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-foreground">Profile Settings</CardTitle>
              <CardDescription className="text-muted-foreground">
                Update your personal information
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-foreground">Full Name</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="bg-input border-border text-foreground"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="text-foreground">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-input border-border text-foreground"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-foreground">Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-input border-border text-foreground"
              />
            </div>
          </div>
          <Button
            onClick={handleProfileUpdate}
            disabled={loading === "profile"}
            className="w-fit gap-2 bg-primary text-primary-foreground"
          >
            {loading === "profile" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-foreground">Change Password</CardTitle>
              <CardDescription className="text-muted-foreground">
                Update your account password
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-foreground">Current Password</Label>
            <div className="relative">
              <Input
                type={showOldPassword ? "text" : "password"}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter current password"
                className="bg-input border-border text-foreground pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowOldPassword(!showOldPassword)}
                aria-label="Toggle password visibility"
              >
                {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-foreground">New Password</Label>
            <div className="relative">
              <Input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="bg-input border-border text-foreground pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowNewPassword(!showNewPassword)}
                aria-label="Toggle password visibility"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {newPassword && (
              <div className="mt-1 flex flex-col gap-1.5">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-all ${i < strength ? strengthColors[strength - 1] : "bg-border"
                        }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {strength > 0 ? strengthLabels[strength - 1] : "Too short"}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-foreground">Confirm New Password</Label>
            <Input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="Confirm new password"
              className="bg-input border-border text-foreground"
            />
          </div>
          <Button
            onClick={handlePasswordChange}
            disabled={loading === "password"}
            className="w-fit gap-2 bg-primary text-primary-foreground"
          >
            {loading === "password" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            Change Password
          </Button>
        </CardContent>
      </Card>

      {/* Change PIN */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-foreground">Change Security PIN</CardTitle>
              <CardDescription className="text-muted-foreground">
                Update your vault access PIN
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-foreground">Current PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={oldPin}
              onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter current PIN"
              className="bg-input border-border text-foreground"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="text-foreground">New PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                placeholder="New 4-6 digit PIN"
                className="bg-input border-border text-foreground"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-foreground">Confirm New PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={confirmNewPin}
                onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ""))}
                placeholder="Confirm new PIN"
                className="bg-input border-border text-foreground"
              />
            </div>
          </div>
          <Button
            onClick={handlePinChange}
            disabled={loading === "pin"}
            className="w-fit gap-2 bg-primary text-primary-foreground"
          >
            {loading === "pin" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Change PIN
          </Button>
        </CardContent>
      </Card>

      {/* Inactivity Timer */}
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
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            If you remain inactive (no login) for the selected period, the system will initiate
            the secure asset transfer process to your designated nominees.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {inactivityOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleInactivityChange(option.value)}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${selectedPeriod === option.value
                  ? "border-primary bg-primary/10"
                  : "border-border bg-input hover:border-primary/40 hover:bg-secondary/30"
                  }`}
              >
                <Clock
                  className={`h-6 w-6 ${selectedPeriod === option.value ? "text-primary" : "text-muted-foreground"
                    }`}
                />
                <span
                  className={`text-sm font-medium ${selectedPeriod === option.value ? "text-primary" : "text-foreground"
                    }`}
                >
                  {option.label}
                </span>
              </button>
            ))}
          </div>
          {loading === "inactivity" && (
            <div className="mt-3 flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-foreground">Two-Factor Authentication</CardTitle>
              <CardDescription className="text-muted-foreground">
                Add an extra layer of security to your account
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Authenticator App
              </p>
              <p className="text-xs text-muted-foreground">
                Use an app like Google Authenticator or Authy to generate secure codes.
              </p>
            </div>
            <div className={`rounded-full px-3 py-1 text-xs font-medium ${user.isTwoFactorEnabled ? "bg-success/10 text-success border border-success/20" : "bg-muted text-muted-foreground"}`}>
              {user.isTwoFactorEnabled ? "Enabled" : "Disabled"}
            </div>
          </div>

          {!user.isTwoFactorEnabled ? (
            !show2FASetup ? (
              <Button
                onClick={handle2FASetup}
                disabled={loading === "2fa-setup"}
                className="w-fit bg-primary text-primary-foreground"
              >
                {loading === "2fa-setup" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                Enable 2FA
              </Button>
            ) : (
              <div className="mt-4 flex flex-col items-center gap-6 rounded-xl border border-border bg-secondary/20 p-6">
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">Scan QR Code</p>
                  <p className="text-xs text-muted-foreground">Scan this code with your authenticator app</p>
                </div>

                {qrCode && (
                  <div className="rounded-lg bg-white p-2">
                    <img src={qrCode} alt="2FA QR Code" className="h-40 w-40" />
                  </div>
                )}

                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Or enter secret key manually:</p>
                  <code className="mt-1 block rounded bg-muted px-2 py-1 text-sm font-mono text-primary select-all">
                    {twoFactorSecret}
                  </code>
                </div>

                <div className="w-full max-w-[240px] space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Verification Code</Label>
                    <Input
                      placeholder="000000"
                      maxLength={6}
                      value={setupToken}
                      onChange={(e) => setSetupToken(e.target.value)}
                      className="text-center text-lg tracking-widest font-mono h-11"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handle2FAVerify}
                      disabled={loading === "2fa-verify"}
                      className="flex-1 bg-primary"
                    >
                      {loading === "2fa-verify" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Enable"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShow2FASetup(false)}
                      disabled={loading === "2fa-verify"}
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
              className="w-fit text-destructive border-destructive/20 hover:bg-destructive/10"
              onClick={() => toast.info("Contact support to disable 2FA for maximum security.")}
            >
              Disable 2FA
            </Button>
          )}
        </CardContent>
      </Card>

      <Separator className="bg-border" />

      {/* Security Info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-4 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Security Overview</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your vault is protected with AES-256 encryption and automated inheritance logic.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["AES-256", "JWT Auth", "Secure Storage"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
