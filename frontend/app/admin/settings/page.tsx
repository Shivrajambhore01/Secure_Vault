"use client"

import { useState } from "react"
import { Shield, Key, Eye, EyeOff, Loader2, Save, Server, Globe, BellRing } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { secureAdminFetch } from "@/lib/admin-api"

export default function AdminSettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  // System Settings State placeholders
  const [testMode, setTestMode] = useState(true)
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters")
      return
    }

    setChangingPassword(true)
    try {
      const response = await secureAdminFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const res = await response.json()
      if (response.ok) {
        toast.success("Administrative password updated successfully")
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        toast.error(res.error || "Password change failed")
      }
    } catch (error) {
      toast.error("Network error modifying password")
    } finally {
      setChangingPassword(false)
    }
  }

  const handleSaveSystemSettings = (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSettings(true)
    setTimeout(() => {
      setSavingSettings(false)
      toast.success("System configuration preferences saved successfully")
    }, 800)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Console Settings</h2>
        <p className="text-muted-foreground text-sm">
          Modify your security credentials and system preferences.
        </p>
      </div>

      <Tabs defaultValue="security" className="space-y-4">
        <TabsList className="border border-border bg-card">
          <TabsTrigger value="security" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
            <Key className="w-4 h-4 mr-2" />
            Admin Security
          </TabsTrigger>
          <TabsTrigger value="system" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
            <Server className="w-4 h-4 mr-2" />
            System Controls
          </TabsTrigger>
        </TabsList>

        <TabsContent value="security" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-lg font-bold">Update Administrative Password</CardTitle>
              <CardDescription>
                Regular password changes are recommended to preserve operator authority status.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="curr-password">Current Console Password</Label>
                  <Input
                    id="curr-password"
                    type="password"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-pwd">New Security Password</Label>
                  <div className="relative">
                    <Input
                      id="new-pwd"
                      type={showPassword ? "text" : "password"}
                      placeholder="•••••••• (Min 8 chars)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-pwd">Confirm New Password</Label>
                  <Input
                    id="confirm-pwd"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={changingPassword}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-medium px-6"
                >
                  {changingPassword ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Update Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-lg font-bold">Platform Configuration Preferences</CardTitle>
              <CardDescription>
                System-wide flags for background workflows (Simulated values for phase 1 validation)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSaveSystemSettings} className="space-y-6">
                <div className="space-y-4 max-w-xl">
                  {/* Test mode switcher */}
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-background/30">
                    <div className="space-y-0.5">
                      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                        Inactivity Test Mode
                        <Switch checked={testMode} onCheckedChange={setTestMode} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        When enabled, user inactivity countdown warnings occur in minutes instead of months.
                      </p>
                    </div>
                  </div>

                  {/* Maintenance mode switcher */}
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-background/30">
                    <div className="space-y-0.5">
                      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                        System Maintenance Mode
                        <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Lock public user login screens while applying backend schema updates.
                      </p>
                    </div>
                  </div>

                  {/* Email Notifications switcher */}
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-background/30">
                    <div className="space-y-0.5">
                      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                        Auditing Notifications Stream
                        <Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Send automated summary reports to all system operators when alerts trigger.
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={savingSettings}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-medium px-6"
                >
                  {savingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save System Configurations
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
