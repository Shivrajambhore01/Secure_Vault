"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Users,
  UserPlus,
  Pencil,
  Trash2,
  Mail,
  Phone,
  Heart,
  X,
  Loader2,
  CheckCircle,
  MoreVertical,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import {
  generateId,
  getCurrentUserId,
  getUser,
} from "@/lib/store"
import { secureFetch } from "@/lib/api"
import type { Nominee, DigitalAsset, User } from "@/lib/store"

const relationships = [
  "Spouse",
  "Parent",
  "Child",
  "Sibling",
  "Friend",
  "Lawyer",
  "Business Partner",
  "Other",
]

export default function NomineesPage() {
  const router = useRouter()
  const [nominees, setNominees] = useState<Nominee[]>([])
  const [assets, setAssets] = useState<DigitalAsset[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Form fields
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [relationship, setRelationship] = useState("")

  useEffect(() => {
    const userId = getCurrentUserId()
    if (userId) {
      const fetchData = async () => {
        try {
          const [nomineesRes, assetsRes] = await Promise.all([
            secureFetch(`/nominees/${userId}`),
            secureFetch(`/assets/${userId}`)
          ])
          setNominees(await nomineesRes.json())
          setAssets(await assetsRes.json())
        } catch (error) {
          toast.error("Failed to fetch data")
        }
      }
      fetchData()

      const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null
      if (searchParams?.get("returnTo")) {
        setShowForm(true)
      }
    }
  }, [])

  const resetForm = () => {
    setName("")
    setEmail("")
    setPhone("")
    setRelationship("")
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (nominee: Nominee) => {
    setName(nominee.name)
    setEmail(nominee.email)
    setPhone(nominee.phone)
    setRelationship(nominee.relationship)
    setEditingId(nominee.id)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !phone || !relationship) {
      toast.error("Please fill in all fields")
      return
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      toast.error("Please enter a valid email")
      return
    }

    // Check if nominee email matches the logged-in user's email
    const currentUser = getUser()
    if (currentUser && email.toLowerCase().trim() === currentUser.email.toLowerCase().trim()) {
      toast.error("Nominee email cannot be the same as your own email")
      return
    }

    // Check if nominee email already exists (exclude current editing nominee)
    const existingNominee = nominees.find(
      (n) => n.email.toLowerCase().trim() === email.toLowerCase().trim() && n.id !== editingId
    )
    if (existingNominee) {
      toast.error(`This email is already assigned to nominee "${existingNominee.name}"`)
      return
    }

    setLoading(true)
    const userId = getCurrentUserId()

    try {
      const nominee: Nominee = {
        id: editingId || generateId(),
        name,
        email,
        phone,
        relationship,
        createdAt: editingId
          ? nominees.find((n) => n.id === editingId)?.createdAt || new Date().toISOString()
          : new Date().toISOString(),
      }

      const response = await secureFetch("/nominees", {
        method: "POST",
        body: JSON.stringify({ ...nominee, userId }),
      })

      if (!response.ok) throw new Error("Failed to save nominee")

      // Save latest added nominee ID for auto-selection in asset creation
      if (!editingId && typeof window !== "undefined") {
        sessionStorage.setItem("sv_latest_added_nominee_id", nominee.id)
      }

      // Refresh list
      const nomineesRes = await secureFetch(`/nominees/${userId}`)
      setNominees(await nomineesRes.json())

      const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null
      const returnTo = searchParams?.get("returnTo")

      toast.success(editingId ? "Nominee updated!" : "Nominee added!")
      resetForm()

      if (returnTo) {
        toast.info("Returning to asset creation flow...")
        setTimeout(() => {
          router.push(returnTo)
        }, 600)
      }
    } catch (error) {
      toast.error("Error saving nominee")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    const userId = getCurrentUserId()
    try {
      const response = await secureFetch(`/nominees/${userId}/${id}`, {
        method: "DELETE"
      })
      if (!response.ok) throw new Error("Failed to delete nominee")

      setNominees(nominees.filter(n => n.id !== id))
      setDeleteId(null)
      toast.success("Nominee removed")
    } catch (error) {
      toast.error("Error removing nominee")
    }
  }

  const getAssignedAssets = (nomineeId: string) =>
    assets.filter((a) => {
      const ids = a.nomineeIds || (a.nomineeId ? [a.nomineeId] : [])
      return ids.includes(nomineeId)
    })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nominees</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your trusted nominees who will receive your digital assets.
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className="gap-2 bg-primary text-primary-foreground"
        >
          <UserPlus className="h-4 w-4" />
          Add Nominee
        </Button>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">
                {editingId ? "Edit Nominee" : "Add Nominee"}
              </h2>
              <button
                onClick={resetForm}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label className="text-foreground">Full Name</Label>
                <Input
                  placeholder="Nominee's full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-input border-border text-foreground"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-foreground">Email</Label>
                <Input
                  type="email"
                  placeholder="nominee@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-input border-border text-foreground"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-foreground">Phone</Label>
                <Input
                  placeholder="+91 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-input border-border text-foreground"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-foreground">Relationship</Label>
                <Select value={relationship} onValueChange={setRelationship}>
                  <SelectTrigger className="bg-input border-border text-foreground">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {relationships.map((r) => (
                      <SelectItem key={r} value={r} className="text-foreground">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-border text-foreground"
                  onClick={resetForm}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 gap-2 bg-primary text-primary-foreground"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingId ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Update
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Add
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Nominee List */}
      {nominees.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {nominees.map((nominee) => {
            const assigned = getAssignedAssets(nominee.id)
            return (
              <Card
                key={nominee.id}
                className="group flex flex-col justify-between"
              >
                {/* Header: Profile Avatar, Nominee Name, Relationship badge, actions menu */}
                <CardHeader className="flex items-center justify-between border-b border-border/10">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-[13px] font-black text-primary border border-primary/20 group-hover:bg-primary/20 transition-colors">
                      {nominee.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base font-bold truncate max-w-[140px] group-hover:text-primary transition-colors">{nominee.name}</CardTitle>
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mt-0.5">{nominee.relationship}</span>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full border border-transparent hover:border-border/50 text-muted-foreground hover:text-foreground">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-border">
                      <DropdownMenuItem onClick={() => handleEdit(nominee)} className="gap-2 cursor-pointer">
                        <Pencil className="h-4 w-4 text-primary" /> Edit Nominee
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteId(nominee.id)} className="gap-2 cursor-pointer text-destructive">
                        <Trash2 className="h-4 w-4" /> Remove Nominee
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>

                {/* Body Content */}
                <CardContent className="flex flex-col gap-4 py-5 flex-grow text-xs leading-relaxed text-muted-foreground">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Email Address</span>
                      <span className="font-bold text-foreground truncate max-w-[170px]" title={nominee.email}>{nominee.email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Phone Number</span>
                      <span className="font-bold text-foreground">{nominee.phone || "—"}</span>
                    </div>
                    <div className="flex flex-col gap-2 border-t border-border/10 pt-3 mt-2">
                      <div className="flex items-center justify-between">
                        <span>Verification Status</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          nominee.verificationStatus === "APPROVED" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                          nominee.verificationStatus === "REJECTED" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                          nominee.verificationStatus === "NONE" ? "bg-slate-500/10 text-slate-400 border-slate-500/20" :
                          "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        }`}>
                          {nominee.verificationStatus === "NONE" ? "No Claim Submitted" : nominee.verificationStatus?.replace("_", " ")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Transfer Status</span>
                        <span className={`text-[10px] font-bold ${
                          nominee.verificationStatus === "APPROVED" ? "text-emerald-500" :
                          nominee.verificationStatus === "REJECTED" ? "text-red-500" :
                          nominee.verificationStatus === "NONE" ? "text-slate-400" :
                          "text-amber-500"
                        }`}>
                          {nominee.verificationStatus === "APPROVED" ? "Transferred" :
                           nominee.verificationStatus === "REJECTED" ? "Rejected" :
                           nominee.verificationStatus === "NONE" ? "Standby Active" :
                           "Transfer Initiated"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Access Status</span>
                        <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                          nominee.verificationStatus === "APPROVED" ? "text-emerald-500" : "text-slate-500"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            nominee.verificationStatus === "APPROVED" ? "bg-emerald-500 animate-pulse" : "bg-slate-600"
                          }`} />
                          {nominee.verificationStatus === "APPROVED" ? "Granted (View-Only)" : "Locked / Restricted"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Verification Date</span>
                        <span className="font-semibold text-foreground">
                          {nominee.verificationDate ? new Date(nominee.verificationDate).toLocaleDateString() : "Not Started"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Assets assigned */}
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground border-t border-border/10 pt-3.5 mt-auto">
                    <Heart className="h-3.5 w-3.5 text-primary fill-primary/10 animate-pulse" />
                    <span>{assigned.length} asset{assigned.length !== 1 ? "s" : ""} assigned</span>
                  </div>
                </CardContent>

                {/* Footer Controls */}
                <CardFooter className="flex gap-2 border-t border-border/10 py-3 bg-secondary/5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-border/30 rounded-xl"
                    onClick={() => handleEdit(nominee)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 gap-1.5 text-xs text-muted-foreground hover:text-destructive border border-transparent hover:border-border/30 rounded-xl"
                    onClick={() => setDeleteId(nominee.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Revoke
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="flex h-96 flex-col items-center justify-center gap-6 rounded-[20px] border border-dashed border-border/60 bg-glass backdrop-blur-md p-8 text-center animate-in fade-in slide-in-from-bottom-5 duration-700 max-w-xl mx-auto shadow-sm">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/5 border border-primary/10">
            <Users className="h-10 w-10 text-primary animate-pulse" />
            <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-white shadow-md shadow-indigo-500/20">
              <UserPlus className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-foreground">No Nominees Yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Define the heirs to your digital legacy. Add trusted nominees who can securely request contingency check decryptions.
            </p>
          </div>
          <Button
            size="lg"
            className="rounded-xl bg-primary text-primary-foreground font-semibold px-8 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            onClick={() => setShowForm(true)}
          >
            Add Your First Nominee
          </Button>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Revoke Nominee Access</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to revoke access and remove this nominee? All digital assets assigned to them will be unassigned and any pending inheritance claims will be cancelled immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
