"use client"

import { useState, useEffect } from "react"
import {
  Shield,
  UserPlus,
  Edit2,
  Trash2,
  Lock,
  Power,
  PowerOff,
  Search,
  User,
  ShieldCheck,
  Mail,
  MoreVertical,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { secureAdminFetch } from "@/lib/admin-api"
import { ROLE_COLORS, ROLE_LABELS, STATUS_COLORS, getAdminUser } from "@/lib/admin-store"

export default function AdminsManagementPage() {
  const [admins, setAdmins] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [currentAdminUser, setCurrentAdminUser] = useState<any | null>(null)

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Form states
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "SUPPORT_ADMIN",
  })
  
  const [selectedAdmin, setSelectedAdmin] = useState<any | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const fetchAdmins = async () => {
    setLoading(true)
    try {
      const response = await secureAdminFetch("/admins")
      if (response.ok) {
        const data = await response.json()
        setAdmins(data)
      } else {
        const err = await response.json()
        toast.error(err.error || "Failed to fetch admin accounts")
      }
    } catch (error) {
      console.error("Error fetching admins:", error)
      toast.error("Network error fetching admin list")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAdmins()
    setCurrentAdminUser(getAdminUser())
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.fullName || !formData.email || !formData.password) {
      toast.error("Please fill in all fields")
      return
    }
    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }

    setSubmitting(true)
    try {
      const response = await secureAdminFetch("/admins", {
        method: "POST",
        body: JSON.stringify(formData),
      })
      const res = await response.json()
      if (response.ok) {
        toast.success("Admin account created successfully")
        setCreateOpen(false)
        setFormData({ fullName: "", email: "", password: "", role: "SUPPORT_ADMIN" })
        fetchAdmins()
      } else {
        toast.error(res.error || "Failed to create admin")
      }
    } catch (error) {
      toast.error("Network error during admin creation")
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAdmin) return

    setSubmitting(true)
    try {
      const response = await secureAdminFetch(`/admins/${selectedAdmin.id}`, {
        method: "PUT",
        body: JSON.stringify({
          fullName: selectedAdmin.fullName,
          role: selectedAdmin.role,
          status: selectedAdmin.status,
        }),
      })
      const res = await response.json()
      if (response.ok) {
        toast.success("Admin details updated successfully")
        setEditOpen(false)
        fetchAdmins()
      } else {
        toast.error(res.error || "Failed to update admin")
      }
    } catch (error) {
      toast.error("Network error updating admin details")
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAdmin || !newPassword) return
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }

    setSubmitting(true)
    try {
      const response = await secureAdminFetch(`/admins/${selectedAdmin.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ newPassword }),
      })
      const res = await response.json()
      if (response.ok) {
        toast.success("Password reset completed successfully")
        setPasswordOpen(false)
        setNewPassword("")
      } else {
        toast.error(res.error || "Password reset failed")
      }
    } catch (error) {
      toast.error("Network error during password reset")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedAdmin) return

    setSubmitting(true)
    try {
      const response = await secureAdminFetch(`/admins/${selectedAdmin.id}`, {
        method: "DELETE",
      })
      const res = await response.json()
      if (response.ok) {
        toast.success("Admin account deleted permanently")
        setDeleteOpen(false)
        fetchAdmins()
      } else {
        toast.error(res.error || "Failed to delete admin account")
      }
    } catch (error) {
      toast.error("Network error deleting admin")
    } finally {
      setSubmitting(false)
    }
  }

  const toggleAdminStatus = async (admin: any) => {
    const isDisable = admin.status === "ACTIVE"
    const url = `/admins/${admin.id}/${isDisable ? "disable" : "enable"}`
    
    try {
      const response = await secureAdminFetch(url, { method: "POST" })
      if (response.ok) {
        toast.success(`Admin account ${isDisable ? "disabled" : "enabled"} successfully`)
        fetchAdmins()
      } else {
        const res = await response.json()
        toast.error(res.error || "Operation failed")
      }
    } catch (error) {
      toast.error("Network error toggling admin status")
    }
  }

  // Filter admins by search input
  const filteredAdmins = admins.filter((a) =>
    a.fullName.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase()) ||
    a.role.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading administrative accounts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top action section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Admin Accounts & RBAC</h2>
          <p className="text-muted-foreground text-sm">
            Configure system operators and roles with granular Role-Based Access Control permissions.
          </p>
        </div>

        {/* Create admin Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium shadow-lg shadow-violet-600/10 rounded-xl px-5">
              <UserPlus className="w-4 h-4 mr-2" />
              Register New Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border bg-card max-w-md">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Register System Controller</DialogTitle>
                <DialogDescription>
                  Provision a new administrative account with restricted role access.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="create-name">Full Name</Label>
                  <Input
                    id="create-name"
                    placeholder="E.g. Shivraj Ambhore"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-email">Corporate Email</Label>
                  <Input
                    id="create-email"
                    type="email"
                    placeholder="name@securevault.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-password">Initial Password</Label>
                  <Input
                    id="create-password"
                    type="password"
                    placeholder="•••••••• (Min 8 characters)"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-role">Access Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(val) => setFormData({ ...formData, role: val })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Choose authority level" />
                    </SelectTrigger>
                    <SelectContent className="border-border">
                      <SelectItem value="SUPER_ADMIN">Super Administrator</SelectItem>
                      <SelectItem value="VERIFICATION_ADMIN">Verification Auditor</SelectItem>
                      <SelectItem value="SECURITY_ADMIN">Security Officer</SelectItem>
                      <SelectItem value="SUPPORT_ADMIN">Support Representative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  className="border-border"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-medium"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Provision Account
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main card table list */}
      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold">Operator Registry</CardTitle>
              <CardDescription>View, modify authority, and toggle administrative status.</CardDescription>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search operators..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background/50 border-border"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredAdmins.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No administrator records found matching your search.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="w-[220px]">Operator Name</TableHead>
                  <TableHead>Email Address</TableHead>
                  <TableHead>Access Role</TableHead>
                  <TableHead>Account Status</TableHead>
                  <TableHead>Last Authentication</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmins.map((admin) => {
                  const isSelf = currentAdminUser?.id === admin.id
                  return (
                    <TableRow key={admin.id} className="border-b border-border hover:bg-muted/5 transition-colors">
                      <TableCell className="font-semibold py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold text-xs">
                            {admin.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-foreground">{admin.fullName}</span>
                            {isSelf && (
                              <span className="ml-2 text-[9px] font-semibold text-violet-400 bg-violet-500/10 border border-violet-500/25 px-1.5 py-0.5 rounded">
                                You
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {admin.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold capitalize border ${
                            ROLE_COLORS[admin.role] || "border-border"
                          }`}
                        >
                          {ROLE_LABELS[admin.role] || admin.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold border ${
                            STATUS_COLORS[admin.status] || "border-border"
                          }`}
                        >
                          {admin.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {admin.lastLogin ? new Date(admin.lastLogin).toLocaleString() : "Never logged in"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                              <MoreVertical className="w-4.5 h-4.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-border w-48">
                            <DropdownMenuLabel>Operator Controls</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-border" />
                            
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedAdmin({ ...admin })
                                setEditOpen(true)
                              }}
                              className="cursor-pointer focus:bg-violet-500/5 focus:text-violet-400"
                            >
                              <Edit2 className="w-4 h-4 mr-2" />
                              Modify Access
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedAdmin(admin)
                                setPasswordOpen(true)
                              }}
                              className="cursor-pointer focus:bg-violet-500/5 focus:text-violet-400"
                            >
                              <Lock className="w-4 h-4 mr-2" />
                              Reset Password
                            </DropdownMenuItem>

                            {/* Don't allow toggling status of self */}
                            {!isSelf && (
                              <DropdownMenuItem
                                onClick={() => toggleAdminStatus(admin)}
                                className="cursor-pointer focus:bg-violet-500/5 focus:text-violet-400"
                              >
                                {admin.status === "ACTIVE" ? (
                                  <>
                                    <PowerOff className="w-4 h-4 mr-2 text-amber-500" />
                                    Disable Operator
                                  </>
                                ) : (
                                  <>
                                    <Power className="w-4 h-4 mr-2 text-emerald-500" />
                                    Enable Operator
                                  </>
                                )}
                              </DropdownMenuItem>
                            )}

                            {!isSelf && (
                              <>
                                <DropdownMenuSeparator className="bg-border" />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedAdmin(admin)
                                    setDeleteOpen(true)
                                  }}
                                  className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Permanently
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Access Role / Name Modal */}
      {selectedAdmin && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="border-border bg-card max-w-sm">
            <form onSubmit={handleUpdate}>
              <DialogHeader>
                <DialogTitle>Modify Authority Level</DialogTitle>
                <DialogDescription>
                  Modify authority configurations for {selectedAdmin.fullName}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Display Name</Label>
                  <Input
                    id="edit-name"
                    value={selectedAdmin.fullName}
                    onChange={(e) => setSelectedAdmin({ ...selectedAdmin, fullName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Authority Role</Label>
                  {/* Prevent demoting self */}
                  <Select
                    value={selectedAdmin.role}
                    disabled={currentAdminUser?.id === selectedAdmin.id}
                    onValueChange={(val) => setSelectedAdmin({ ...selectedAdmin, role: val })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border">
                      <SelectItem value="SUPER_ADMIN">Super Administrator</SelectItem>
                      <SelectItem value="VERIFICATION_ADMIN">Verification Auditor</SelectItem>
                      <SelectItem value="SECURITY_ADMIN">Security Officer</SelectItem>
                      <SelectItem value="SUPPORT_ADMIN">Support Representative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOpen(false)}
                  className="border-border"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-medium"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Commit Update
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Reset password Modal */}
      {selectedAdmin && (
        <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
          <DialogContent className="border-border bg-card max-w-sm">
            <form onSubmit={handleResetPassword}>
              <DialogHeader>
                <DialogTitle>Reset Operator Password</DialogTitle>
                <DialogDescription>
                  Enter a new administrative password for {selectedAdmin.fullName}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Security Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="•••••••• (Min 8 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPasswordOpen(false)}
                  className="border-border"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-medium"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Reset Password
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirmation Modal */}
      {selectedAdmin && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="border-border bg-card max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Confirm Destruction
              </DialogTitle>
              <DialogDescription>
                Are you absolutely sure you want to permanently delete the admin account for{" "}
                <span className="font-semibold text-foreground">{selectedAdmin.fullName}</span>? This action
                is irreversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteOpen(false)}
                className="border-border"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={submitting}
                onClick={handleDelete}
                className="bg-destructive hover:bg-destructive/90 text-white font-medium"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Delete Permanently
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
