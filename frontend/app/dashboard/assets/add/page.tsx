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
  Trash2,
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
import { secureFetch, BASE_URL } from "@/lib/api"
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

  const [editId, setEditId] = useState<string | null>(null)
  const [type, setType] = useState<string>("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedNomineeIds, setSelectedNomineeIds] = useState<string[]>([])
  const [content, setContent] = useState("") // For passwords/notes

  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [file])

  const handleRedirectToAddNominee = () => {
    if (typeof window !== "undefined") {
      const draft = { type, name, description, content, editId }
      sessionStorage.setItem("sv_asset_draft", JSON.stringify(draft))
    }
    const currentPath = editId ? `/dashboard/assets/add?edit=${editId}` : "/dashboard/assets/add"
    router.push(`/dashboard/nominees?returnTo=${encodeURIComponent(currentPath)}`)
  }

  useEffect(() => {
    const userId = getCurrentUserId()
    if (userId) {
      // Check for saved draft form state
      if (typeof window !== "undefined") {
        const draftStr = sessionStorage.getItem("sv_asset_draft")
        if (draftStr) {
          try {
            const draft = JSON.parse(draftStr)
            if (draft.type) setType(draft.type)
            if (draft.name) setName(draft.name)
            if (draft.description) setDescription(draft.description)
            if (draft.content) setContent(draft.content)
            if (draft.editId) setEditId(draft.editId)
          } catch (e) {
            // ignore JSON parse error
          }
          sessionStorage.removeItem("sv_asset_draft")
        }
      }

      secureFetch(`/nominees/${userId}`)
        .then(res => res.json())
        .then((data: Nominee[]) => {
          setNominees(data)
          // Auto-select newly added nominee if returned from Nominees page
          if (typeof window !== "undefined") {
            const latestId = sessionStorage.getItem("sv_latest_added_nominee_id")
            if (latestId) {
              sessionStorage.removeItem("sv_latest_added_nominee_id")
              if (data.some(n => n.id === latestId)) {
                setSelectedNomineeIds(prev => Array.from(new Set([...prev, latestId])))
              }
            }
          }
        })
        .catch(() => toast.error("Failed to fetch nominees"))

      const queryParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null
      const edit = queryParams?.get("edit")
      if (edit) {
        setEditId(edit)
        secureFetch(`/assets/${userId}`)
          .then(res => res.json())
          .then((assets: any[]) => {
            const asset = assets.find(a => a.id === edit)
            if (asset) {
              setName(asset.name)
              setType(asset.type)
              setDescription(asset.description || "")
              setSelectedNomineeIds(asset.nomineeIds || (asset.nomineeId ? [asset.nomineeId] : []))
              setContent(asset.content || "")
            } else {
              toast.error("Asset not found")
            }
          })
          .catch(() => toast.error("Failed to fetch asset details"))
      }
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

    if (selectedNomineeIds.length === 0) {
      toast.error("Please assign at least one nominee")
      return
    }

    const needsFile = ["image", "video", "document", "legal-file"].includes(type)
    const isEdit = !!editId
    if (needsFile && !file && !isEdit) {
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

    if (!isEdit && user && user.storageUsed >= user.storageLimit) {
      toast.error("Storage limit reached! Please upgrade your plan.")
      setLoading(false)
      return
    }

    try {
      const formData = new FormData()
      formData.append("userId", userId!)
      formData.append("name", name)
      formData.append("type", type)
      formData.append("description", description)
      formData.append("nomineeIds", selectedNomineeIds.join(","))

      if (editId) formData.append("id", editId)
      if (file) formData.append("file", file)
      if (content) formData.append("content", content)

      // Using XMLHTTPRequest for progress monitoring
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.withCredentials = true // Send HttpOnly cookies
        xhr.open("POST", `${BASE_URL}/assets`, true)

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
      toast.success(editId ? "Asset updated successfully!" : "Asset encrypted and stored securely!")

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
      <div className="flex h-96 flex-col items-center justify-center gap-4 animate-in fade-in zoom-in-95 duration-500 font-tt-norms font-sans text-black">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
          <CheckCircle className="h-10 w-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-black">
          {editId ? "Asset Updated!" : "Asset Secured!"}
        </h2>
        <p className="text-sm text-neutral-500 text-center max-w-xs">
          {editId 
            ? "Your changes have been encrypted and updated in your secure vault."
            : "Your asset has been encrypted and stored in your secure vault."}
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 font-tt-norms font-sans text-black">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black tracking-tight">
          {editId ? "Edit Digital Asset" : "Add Digital Asset"}
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          {editId 
            ? "Modify your secured documents, credentials, or nominees."
            : "Securely encrypt and store documents, media, or credentials."}
        </p>
      </div>

      <div className="bg-white border border-black/8 rounded-3xl p-7 sm:p-8 shadow-sm space-y-6 text-black">
        <div className="border-b border-black/5 pb-4">
          <h2 className="text-xl font-bold text-black">
            {editId ? "Update Asset Details" : "Asset Configuration"}
          </h2>
          <p className="text-xs text-neutral-500 mt-1">Configure encryption parameters and beneficiary access control</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">

          {/* Asset Type Select */}
          <div className="grid gap-2">
            <Label className="text-sm font-semibold text-black">Asset Category</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {assetTypes.map((t) => {
                const Icon = t.icon
                const isActive = type === t.value
                const isDisabled = editId && !isActive
                if (isDisabled) return null // Hide non-active categories on edit for cleaner UX
                return (
                  <button
                    key={t.value}
                    type="button"
                    disabled={editId ? true : false}
                    onClick={() => setType(t.value)}
                    className={`flex flex-col items-center gap-2.5 rounded-2xl border p-4 transition-all cursor-pointer ${
                      editId ? "" : "hover:scale-[1.02]"
                    } ${
                      isActive
                        ? "border-black bg-black text-white shadow-md ring-2 ring-black/10"
                        : "border-black/8 bg-neutral-50 text-neutral-700 hover:bg-neutral-100 hover:text-black hover:border-black/20"
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${isActive ? "text-white" : "text-neutral-600"}`} />
                    <span className="text-xs font-semibold">{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name" className="text-sm font-semibold text-black">Asset Name</Label>
            <Input
              id="name"
              placeholder="Give your asset a clear name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-neutral-50 border-black/10 text-black placeholder:text-neutral-400 focus:bg-white focus:border-black rounded-xl h-11"
            />
          </div>

          {/* Content for text-based assets */}
          {["password", "note"].includes(type) && (
            <div className="grid gap-2 animate-in slide-in-from-top-2 duration-300">
              <Label htmlFor="content" className="text-sm font-semibold text-black">{type === "password" ? "Secure Password" : "Note Content"}</Label>
              {type === "password" ? (
                <Input
                  id="content"
                  type="password"
                  placeholder="Enter your sensitive password"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="bg-neutral-50 border-black/10 text-black placeholder:text-neutral-400 focus:bg-white focus:border-black rounded-xl h-11"
                />
              ) : (
                <Textarea
                  id="content"
                  placeholder="Type your notes here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="bg-neutral-50 border-black/10 text-black placeholder:text-neutral-400 focus:bg-white focus:border-black rounded-xl min-h-[150px]"
                />
              )}
            </div>
          )}

          {/* File Upload for media-based assets */}
          {["image", "video", "document", "legal-file"].includes(type) && (
            <div className="grid gap-2 animate-in slide-in-from-top-2 duration-300">
              <Label className="text-sm font-semibold text-black">File Upload</Label>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed p-10 transition-all duration-250 ${
                  dragActive
                    ? "border-black bg-neutral-100 scale-[1.01]"
                    : "border-black/15 bg-neutral-50/80 hover:border-black/30 hover:bg-neutral-100/60"
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
                  <div className="flex w-full flex-col items-center gap-3">
                    {previewUrl ? (
                      <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-black/10 shadow-sm">
                        <img
                          src={previewUrl}
                          alt="preview"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
                        <CheckCircle className="h-6 w-6 text-white" />
                      </div>
                    )}
                    <div className="text-center min-w-0 max-w-full">
                      <p className="text-xs font-bold text-black truncate max-w-[240px]">{file.name}</p>
                      <p className="text-[10px] text-neutral-500 mt-0.5 font-bold">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full gap-1.5 h-8 px-4 border border-transparent"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove File
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-black/8 text-black shadow-2xs group-hover:scale-105 transition-transform duration-300">
                      <Upload className="h-6 w-6 text-black" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-black">Drop your {type} here</p>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        {editId ? "or click to browse to replace current file" : "or click to browse from local storage"}
                      </p>
                      {editId && (
                        <p className="text-[10px] text-neutral-700 mt-1.5 font-bold uppercase tracking-wider bg-neutral-100 border border-black/10 px-2.5 py-0.5 rounded-full inline-block">
                          Current file is secured
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="description" className="text-sm font-semibold text-black">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Add some context or tags..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-neutral-50 border-black/10 text-black placeholder:text-neutral-400 focus:bg-white focus:border-black rounded-xl h-20"
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-sm font-semibold text-black">Assign Beneficiaries (Nominees)</Label>
            {nominees.length > 0 ? (
              <div className="grid gap-2 border border-black/8 bg-neutral-50 rounded-2xl p-4 max-h-[160px] overflow-y-auto">
                {nominees.map((n) => {
                  const isChecked = selectedNomineeIds.includes(n.id)
                  return (
                    <label
                      key={n.id}
                      className="flex items-center gap-3 cursor-pointer p-2 rounded-xl hover:bg-white transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedNomineeIds([...selectedNomineeIds, n.id])
                          } else {
                            setSelectedNomineeIds(selectedNomineeIds.filter(id => id !== n.id))
                          }
                        }}
                        className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-black"
                      />
                      <span className="text-sm font-medium text-black">{n.name} <span className="text-neutral-500 font-normal">({n.email})</span></span>
                    </label>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-col gap-2">
                <p className="text-sm font-semibold text-amber-900">No Beneficiaries Found</p>
                <Button variant="link" size="sm" className="h-auto p-0 justify-start text-black font-bold underline" onClick={handleRedirectToAddNominee}>
                  Add a beneficiary first →
                </Button>
              </div>
            )}
          </div>

          {loading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-black">
                <span>Securing & Uploading...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className="h-1.5" />
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || nominees.length === 0}
            className="w-full h-12 rounded-full font-bold bg-black text-white hover:bg-neutral-800 transition-all shadow-sm active:scale-[0.98] cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : editId ? (
              "Update in Secure Vault"
            ) : (
              "Store in Secure Vault"
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
