"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Upload,
  FileText,
  KeyRound,
  FileKey,
  ImageIcon,
  FileCheck,
  Loader2,
  CheckCircle,
  Video,
  StickyNote,
  X,
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
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import {
  getCurrentUserId,
  getUser,
  saveUser,
} from "@/lib/store"
import { secureFetch } from "@/lib/api"
import type { Nominee } from "@/lib/store"

const assetTypes = [
  { value: "image", label: "Image", icon: ImageIcon },
  { value: "video", label: "Video", icon: Video },
  { value: "document", label: "Document", icon: FileText },
  { value: "note", label: "Text Note", icon: StickyNote },
  { value: "password", label: "Password", icon: KeyRound },
  { value: "legal-file", label: "Legal File", icon: FileCheck },
] as const

export default function AddAssetPage() {
  const router = useRouter()
  const [nominees, setNominees] = useState<Nominee[]>([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const [type, setType] = useState<string>("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [nomineeId, setNomineeId] = useState<string>("")
  const [content, setContent] = useState("") // For passwords/notes

  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const userId = getCurrentUserId()
    if (userId) {
      secureFetch(`/nominees/${userId}`)
        .then(res => res.json())
        .then(data => setNominees(data))
        .catch(() => toast.error("Failed to fetch nominees"))
    }
  }, [])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      validateAndSetFile(droppedFile)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0])
    }
  }

  const validateAndSetFile = (file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File size exceeds 50MB limit")
      return
    }
    setFile(file)
    if (!name) setName(file.name.split('.')[0])

    // Auto-detect type if not set
    if (!type) {
      if (file.type.startsWith("image/")) setType("image")
      else if (file.type.startsWith("video/")) setType("video")
      else if (file.type.includes("pdf")) setType("document")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!type || !name) {
      toast.error("Please fill in asset type and name")
      return
    }

    if (!nomineeId) {
      toast.error("Please assign a nominee")
      return
    }

    const needsFile = ["image", "video", "document", "legal-file"].includes(type)
    if (needsFile && !file) {
      toast.error(`Please upload a file for ${type} asset`)
      return
    }

    const needsContent = ["password", "note"].includes(type)
    if (needsContent && !content) {
      toast.error(`Please provide ${type} content`)
      return
    }

    setLoading(true)
    const userId = getCurrentUserId()
    const user = getUser()

    if (user && user.storageUsed >= user.storageLimit) {
      toast.error("Storage limit reached! Please upgrade your plan.")
      return
    }

    try {
      const formData = new FormData()
      formData.append("userId", userId!)
      formData.append("name", name)
      formData.append("type", type)
      formData.append("description", description)
      formData.append("nomineeId", nomineeId)

      if (file) formData.append("file", file)
      if (content) formData.append("content", content)

      // Using XMLHTTPRequest for progress monitoring
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.withCredentials = true // Send HttpOnly cookies
        xhr.open("POST", "http://localhost:8000/api/assets", true)

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = (event.loaded / event.total) * 100
            setUploadProgress(percent)
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText))
          } else {
            reject(new Error("Upload failed"))
          }
        }

        xhr.onerror = () => reject(new Error("Network error"))
        xhr.send(formData)
      })

      // Refresh user storage info
      const userRes = await secureFetch(`/auth/me/${userId}`)
      if (userRes.ok) {
        const userData = await userRes.json()
        saveUser(userData)
      }

      setLoading(false)
      setSuccess(true)
      toast.success("Asset encrypted and stored securely!")

      setTimeout(() => {
        router.push("/dashboard/assets")
      }, 1500)
    } catch (error) {
      toast.error("Error saving asset")
      setLoading(false)
      setUploadProgress(0)
    }
  }

  if (success) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20">
          <CheckCircle className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Asset Secured!</h2>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Your asset has been encrypted and stored in your secure vault.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Add Digital Asset</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Securely encrypt and store documents, media, or credentials.
        </p>
      </div>

      <Card className="border-border bg-card/50 backdrop-blur-sm shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Asset Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">

            {/* Asset Type Select */}
            <div className="grid gap-2">
              <Label className="text-sm font-medium">Asset Category</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {assetTypes.map((t) => {
                  const Icon = t.icon
                  const isActive = type === t.value
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all hover:scale-105 ${isActive
                        ? "border-primary bg-primary/10 text-primary shadow-lg ring-1 ring-primary"
                        : "border-border bg-background/50 text-muted-foreground hover:border-primary/50"
                        }`}
                    >
                      <Icon className={`h-6 w-6 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-xs font-medium">{t.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Asset Name</Label>
              <Input
                id="name"
                placeholder="Give your asset a clear name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background/50 border-border"
              />
            </div>

            {/* Content for text-based assets */}
            {["password", "note"].includes(type) && (
              <div className="grid gap-2 animate-in slide-in-from-top-2 duration-300">
                <Label htmlFor="content">{type === "password" ? "Secure Password" : "Note Content"}</Label>
                {type === "password" ? (
                  <Input
                    id="content"
                    type="password"
                    placeholder="Enter your sensitive password"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="bg-background/50 border-border"
                  />
                ) : (
                  <Textarea
                    id="content"
                    placeholder="Type your notes here..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="bg-background/50 border-border min-h-[150px]"
                  />
                )}
              </div>
            )}

            {/* File Upload for media-based assets */}
            {["image", "video", "document", "legal-file"].includes(type) && (
              <div className="grid gap-2 animate-in slide-in-from-top-2 duration-300">
                <Label>File Upload</Label>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-10 transition-all ${dragActive
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : "border-border bg-background/30 hover:border-primary/40 hover:bg-background/50"
                    }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept={
                      type === "image" ? "image/*" :
                        type === "video" ? "video/*" :
                          type === "document" ? ".pdf,.doc,.docx" : "*"
                    }
                  />

                  {file ? (
                    <div className="flex w-full flex-col items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                        <CheckCircle className="h-6 w-6 text-primary" />
                      </div>
                      <p className="text-sm font-semibold truncate max-w-[200px]">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                        className="mt-2 text-xs text-destructive hover:underline"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary">
                        <Upload className="h-8 w-8" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium">Drop your {type} here</p>
                        <p className="text-xs text-muted-foreground mt-1">or click to browse from files</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Add some context or tags..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-background/50 border-border h-20"
              />
            </div>

            <div className="grid gap-2">
              <Label>Assign Beneficiary (Nominee)</Label>
              {nominees.length > 0 ? (
                <Select value={nomineeId} onValueChange={setNomineeId}>
                  <SelectTrigger className="bg-background/50 border-border">
                    <SelectValue placeholder="Who should inherit this?" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {nominees.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex flex-col gap-2">
                  <p className="text-sm font-medium text-warning">No Nominees Found</p>
                  <Button variant="link" size="sm" className="h-auto p-0 justify-start" onClick={() => router.push("/dashboard/nominees")}>
                    Add a nominee first →
                  </Button>
                </div>
              )}
            </div>

            {loading && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span>Securing & Uploading...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="h-1.5" />
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || nominees.length === 0}
              className="w-full h-14 text-base font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Store in Secure Vault"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
