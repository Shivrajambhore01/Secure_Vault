"use client"

import { useState, useEffect } from "react"
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
import { Card, CardContent } from "@/components/ui/card"
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

      // Refresh list
      const nomineesRes = await secureFetch(`/nominees/${userId}`)
      setNominees(await nomineesRes.json())

      toast.success(editingId ? "Nominee updated!" : "Nominee added!")
      resetForm()
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
                className="group border-border bg-card transition-all hover:border-primary/40 animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <CardContent className="flex flex-col gap-4 p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary transition-colors group-hover:bg-primary/20">
                      {nominee.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">
                      {nominee.relationship}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground">{nominee.name}</h3>
                  </div>

                  <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{nominee.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{nominee.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Heart className="h-3.5 w-3.5" />
                      <span>
                        {assigned.length} asset{assigned.length !== 1 ? "s" : ""} assigned
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 border-t border-border pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 gap-1.5 text-muted-foreground hover:text-foreground"
                      onClick={() => handleEdit(nominee)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 gap-1.5 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteId(nominee.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border">
          <Users className="h-12 w-12 text-muted-foreground/30" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">No nominees yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add trusted individuals who will receive your digital assets
            </p>
          </div>
          <Button
            size="sm"
            className="gap-2 bg-primary text-primary-foreground"
            onClick={() => setShowForm(true)}
          >
            <UserPlus className="h-4 w-4" />
            Add First Nominee
          </Button>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Remove Nominee</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to remove this nominee? Assets assigned to them will become unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
