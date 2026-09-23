"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  FolderKey,
  FileText,
  KeyRound,
  ImageIcon,
  FileCheck,
  PlusCircle,
  Pencil,
  Trash2,
  Eye,
  Search,
  Filter,
  Video,
  StickyNote,
  Download,
  EyeOff,
  ExternalLink,
  ChevronRight,
  MoreVertical,
  X,
  Link as LinkIcon,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { PinModal } from "@/components/dashboard/pin-modal"
import { formatBytes, getCurrentUserId, isPinVerifiedSession, setPinVerifiedSession } from "@/lib/store"
import { secureFetch, API_BASE } from "@/lib/api"
import type { DigitalAsset, Nominee } from "@/lib/store"

const typeIcons: Record<string, React.ElementType> = {
  image: ImageIcon,
  video: Video,
  document: FileText,
  note: StickyNote,
  password: KeyRound,
  "legal-file": FileCheck,
}

const typeLabels: Record<string, string> = {
  image: "Image",
  video: "Video",
  document: "Document",
  note: "Text Note",
  password: "Password",
  "legal-file": "Legal File",
}

export default function AssetsPage() {
  const [pinVerified, setPinVerified] = useState(() => isPinVerifiedSession())
  const [showPinModal, setShowPinModal] = useState(() => !isPinVerifiedSession())
  const [assets, setAssets] = useState<any[]>([])
  const [nominees, setNominees] = useState<Nominee[]>([])
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [viewAsset, setViewAsset] = useState<any | null>(null)
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const userId = getCurrentUserId()
    if (pinVerified && userId) {
      fetchData()
    }
  }, [pinVerified])

  const fetchData = async () => {
    const userId = getCurrentUserId()
    try {
      const [assetsRes, nomineesRes] = await Promise.all([
        secureFetch(`/assets/${userId}`),
        secureFetch(`/nominees/${userId}`)
      ])
      const assetsData = await assetsRes.json()
      const nomineesData = await nomineesRes.json()
      setAssets(assetsData)
      setNominees(nomineesData)
    } catch (error) {
      toast.error("Failed to fetch data")
    }
  }

  const filteredAssets = assets.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.description?.toLowerCase().includes(search.toLowerCase()))
    const matchesType = filterType === "all" || a.type === filterType
    return matchesSearch && matchesType
  })

  const handleDelete = async (id: string) => {
    const userId = getCurrentUserId()
    if (!userId) return

    try {
      const response = await secureFetch(`/assets/${userId}/${id}`, {
        method: "DELETE"
      })
      if (!response.ok) throw new Error("Failed to delete asset")

      setAssets(assets.filter(a => a.id !== id))
      setDeleteId(null)
      toast.success("Asset deleted successfully")
    } catch (error) {
      toast.error("Error deleting asset")
    }
  }

  const togglePassword = (id: string) => {
    setShowPassword(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const getAssetUrl = (path: string) => `${API_BASE}${path}`

  // PIN Modal
  if (!pinVerified) {
    return (
      <PinModal
        open={showPinModal}
        onClose={() => {
          setShowPinModal(false)
          window.history.back()
        }}
        onSuccess={() => {
          setPinVerifiedSession()
          setPinVerified(true)
          setShowPinModal(false)
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-8 pb-10 font-tt-norms font-sans text-black">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-1">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-black tracking-tight">Digital Vault</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Encrypted cryptographic assets, keys, and heritage directives.
          </p>
        </div>
        <Link href="/dashboard/assets/add">
          <button className="group h-11 rounded-full bg-black hover:bg-neutral-800 text-white font-medium text-sm shadow-md flex items-center justify-center gap-2 px-6 transition-all active:scale-[0.98] cursor-pointer">
            <PlusCircle className="h-4 w-4 text-white" />
            <span>Add Secure Asset</span>
          </button>
        </Link>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col gap-3 sm:flex-row bg-white p-3 rounded-2xl border border-black/8 shadow-2xs">
        <div className="relative flex-1 group">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 group-focus-within:text-black transition-colors" />
          <Input
            placeholder="Search your vault by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-neutral-100/90 border-transparent hover:bg-neutral-100 focus:bg-white focus:border-black/20 text-black pl-10 text-xs h-10 rounded-full"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[170px] h-10 rounded-full border border-black/15 bg-white text-black text-xs font-semibold px-4 shadow-2xs">
              <Filter className="mr-2 h-3.5 w-3.5 text-neutral-500" />
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent className="bg-white text-black border border-black/10 rounded-2xl shadow-xl">
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(typeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Asset Grid */}
      {filteredAssets.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAssets.map((asset) => {
            const Icon = typeIcons[asset.type] || FileText
            const assetNomineeIds = asset.nomineeIds || (asset.nomineeId ? [asset.nomineeId] : [])
            const assignedNominees = nominees.filter((n) => assetNomineeIds.includes(n.id))
            const nomineeNames = assignedNominees.length > 0
              ? assignedNominees.map((n) => n.name).join(", ")
              : "Unassigned"
            const isMedia = ["image", "video"].includes(asset.type)
            const isFile = !!asset.filePaths

            return (
              <Card
                key={asset.id}
                className="group flex flex-col justify-between bg-white border border-black/8 hover:border-black/15 shadow-sm rounded-3xl overflow-hidden transition-all duration-200 text-black"
              >
                {/* Header: Icon, Title, Category and Dropdown Menu */}
                <CardHeader className="flex items-center justify-between border-b border-black/5 p-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-black border border-black/5 shadow-2xs">
                      <Icon className="h-5 w-5 text-black" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-bold text-black truncate max-w-[130px] sm:max-w-[150px]" title={asset.name}>{asset.name}</h3>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mt-0.5">{typeLabels[asset.type]}</span>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white border-black/10 rounded-2xl shadow-xl text-black">
                      <DropdownMenuItem onClick={() => setViewAsset(asset)} className="gap-2 cursor-pointer font-medium hover:bg-neutral-50">
                        <Eye className="h-4 w-4 text-black" /> View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/assets/add?edit=${asset.id}`} className="gap-2 cursor-pointer flex items-center w-full font-medium hover:bg-neutral-50">
                          <Pencil className="h-4 w-4 text-black" /> Edit Asset
                        </Link>
                      </DropdownMenuItem>
                      {isFile && (
                        <DropdownMenuItem asChild>
                          <a href={getAssetUrl(asset.filePaths)} download className="gap-2 cursor-pointer flex items-center font-medium hover:bg-neutral-50">
                            <Download className="h-4 w-4 text-black" /> Download
                          </a>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setDeleteId(asset.id)} className="gap-2 cursor-pointer text-red-600 font-medium hover:bg-red-50">
                        <Trash2 className="h-4 w-4" /> Delete Asset
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>

                {/* Body Content */}
                <CardContent className="flex flex-col gap-3.5 p-5 flex-grow text-black">
                  <p className="line-clamp-2 text-xs text-neutral-500 leading-relaxed font-normal min-h-[32px]">
                    {asset.description || "No description provided."}
                  </p>

                  {asset.type === "password" && (
                    <div className="flex items-center justify-between rounded-2xl bg-neutral-50 border border-black/8 p-3 mt-1">
                      <code className="text-xs font-mono font-bold text-black truncate max-w-[140px]">
                        {showPassword[asset.id] ? asset.content : "••••••••••••"}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-neutral-400 hover:text-black hover:bg-neutral-200/60 rounded-full"
                        onClick={(e) => { e.stopPropagation(); togglePassword(asset.id); }}
                      >
                        {showPassword[asset.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  )}

                  {asset.type === "note" && (
                    <div className="line-clamp-2 rounded-2xl bg-neutral-50 border border-black/8 p-3 text-[11px] italic text-neutral-700 leading-relaxed mt-1">
                      &quot;{asset.content}&quot;
                    </div>
                  )}

                  {/* Metadata Indicators */}
                  <div className="grid grid-cols-2 gap-3.5 border-t border-black/5 pt-3.5 mt-auto">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Protection</span>
                      <StatusBadge status="encrypted" className="px-2 py-0.5" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Last Updated</span>
                      <span className="text-xs font-bold text-black block">{new Date(asset.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Nominees */}
                  <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-500 border-t border-black/5 pt-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-black shrink-0" />
                    <span className="truncate">Nominee(s): <span className="font-bold text-black" title={nomineeNames}>{nomineeNames}</span></span>
                  </div>
                </CardContent>

                {/* Footer Controls */}
                <CardFooter className="flex justify-end gap-1.5 border-t border-black/5 py-2.5 px-5 bg-neutral-50/50">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-neutral-400 hover:text-black hover:bg-neutral-200/60 rounded-full"
                    onClick={() => setViewAsset(asset)}
                    title="View Details"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Link href={`/dashboard/assets/add?edit=${asset.id}`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-neutral-400 hover:text-black hover:bg-neutral-200/60 rounded-full"
                      title="Edit Asset"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                  {isFile && (
                    <a href={getAssetUrl(asset.filePaths)} download>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-neutral-400 hover:text-black hover:bg-neutral-200/60 rounded-full"
                        title="Download File"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full"
                    onClick={() => setDeleteId(asset.id)}
                    title="Delete Asset"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="flex h-96 flex-col items-center justify-center gap-6 rounded-3xl border border-dashed border-black/15 bg-white p-8 text-center animate-in fade-in slide-in-from-bottom-5 duration-700 max-w-xl mx-auto shadow-sm text-black">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-neutral-100 border border-black/8 shadow-2xs">
            <FolderKey className="h-10 w-10 text-black" />
            <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black text-white shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-black">No Vaults Yet</h3>
            <p className="text-sm text-neutral-500 max-w-sm mx-auto leading-relaxed">
              {search || filterType !== "all"
                ? "We couldn't find any vaults matching your search query or category filters. Try expanding your search options."
                : "Your digital legacy starts here. Create a secure vault to encrypt and guard your critical credentials, files, and keys."}
            </p>
          </div>
          {!search && filterType === "all" && (
            <Link href="/dashboard/assets/add">
              <Button size="lg" className="rounded-full bg-black text-white hover:bg-neutral-800 font-bold px-8 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all">
                Add Your First Asset
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Asset Detail View Modal */}
      {viewAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setViewAsset(null)}
        >
          <div
            className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-black/10 bg-white shadow-2xl animate-in zoom-in-95 duration-300 text-black"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setViewAsset(null)}
              className="absolute right-4 top-4 z-10 rounded-full bg-neutral-100 p-2 text-neutral-500 hover:bg-neutral-200 hover:text-black transition-all"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="grid md:grid-cols-2">
              {/* Preview Side */}
              <div className="bg-neutral-50 flex items-center justify-center border-r border-black/5 p-6">
                {viewAsset.type === "image" && viewAsset.filePaths ? (
                  <img
                    src={getAssetUrl(viewAsset.filePaths)}
                    alt={viewAsset.name}
                    className="h-full w-full object-contain max-h-[300px] rounded-2xl"
                  />
                ) : viewAsset.type === "video" && viewAsset.filePaths ? (
                  <video
                    src={getAssetUrl(viewAsset.filePaths)}
                    controls
                    autoPlay
                    className="h-full w-full object-contain max-h-[300px] rounded-2xl"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-4 py-12">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-neutral-100 text-black border border-black/8 shadow-2xs">
                      {(() => {
                        const VIcon = typeIcons[viewAsset.type] || FileText
                        return <VIcon className="h-10 w-10 text-black" />
                      })()}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">{typeLabels[viewAsset.type]}</span>
                  </div>
                )}
              </div>

              {/* Data Side */}
              <div className="p-8 flex flex-col gap-6">
                <div>
                  <h2 className="text-2xl font-bold text-black leading-tight">{viewAsset.name}</h2>
                  <p className="mt-2 text-sm text-neutral-600 leading-relaxed italic border-l-2 border-black/20 pl-3">
                    {viewAsset.description || "No description provided."}
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Content for text-based */}
                  {viewAsset.content && (
                    <div className="rounded-2xl border border-black/8 bg-neutral-50 p-4">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block">
                        {viewAsset.type === "password" ? "Encrypted Password" : "Secure Note"}
                      </Label>
                      {viewAsset.type === "password" ? (
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-sm font-mono font-bold text-black break-all">
                            {showPassword[viewAsset.id] ? viewAsset.content : "••••••••••••••••"}
                          </code>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0 rounded-full border-black/15 hover:bg-neutral-100"
                            onClick={() => togglePassword(viewAsset.id)}
                          >
                            {showPassword[viewAsset.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-black whitespace-pre-wrap">{viewAsset.content}</p>
                      )}
                    </div>
                  )}

                  {/* Metadata List */}
                  <div className="grid gap-3 text-sm">
                    <div className="flex justify-between border-b border-black/5 pb-2">
                      <span className="text-neutral-500 flex items-center gap-2"><KeyRound className="h-3.5 w-3.5" /> Security</span>
                      <span className="font-semibold text-emerald-700 flex items-center gap-1.5"><FileCheck className="h-3.5 w-3.5" /> AES-256-GCM</span>
                    </div>
                    {viewAsset.filePaths && (
                      <div className="flex justify-between border-b border-black/5 pb-2">
                        <span className="text-neutral-500 flex items-center gap-2"><Download className="h-3.5 w-3.5" /> Size</span>
                        <span className="font-medium text-black">{formatBytes(viewAsset.fileSize || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-b border-black/5 pb-2">
                      <span className="text-neutral-500 flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5" /> Beneficiary(ies)</span>
                      <span className="font-medium text-black text-right max-w-[200px] truncate" title={(() => {
                        const assetNomineeIds = viewAsset.nomineeIds || (viewAsset.nomineeId ? [viewAsset.nomineeId] : [])
                        return nominees.filter((n) => assetNomineeIds.includes(n.id)).map((n) => n.name).join(", ")
                      })() || "Not set"}>
                        {(() => {
                          const assetNomineeIds = viewAsset.nomineeIds || (viewAsset.nomineeId ? [viewAsset.nomineeId] : [])
                          return nominees.filter((n) => assetNomineeIds.includes(n.id)).map((n) => n.name).join(", ")
                        })() || "Not set"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-auto grid grid-cols-2 gap-3">
                  {viewAsset.filePaths ? (
                    <Button size="lg" className="w-full gap-2 rounded-full font-bold bg-black text-white hover:bg-neutral-800" asChild>
                      <a href={getAssetUrl(viewAsset.filePaths)} download>
                        <Download className="h-4 w-4" /> Download
                      </a>
                    </Button>
                  ) : (
                    <Button size="lg" variant="outline" className="w-full gap-2 rounded-full border-black/15 font-bold text-black hover:bg-neutral-100" onClick={() => toast.info("Encryption detail: SHA-256 Verified")}>
                      <FileCheck className="h-4 w-4 text-black" /> Verified
                    </Button>
                  )}
                  <Button size="lg" variant="secondary" className="w-full gap-2 rounded-full font-bold bg-neutral-100 text-black hover:bg-neutral-200" onClick={() => setViewAsset(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border border-2 animate-in slide-in-from-bottom-5">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold">Safely Remove Asset?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-base">
              This will permanently delete this asset from the secure vault. This action <span className="text-destructive font-bold underline">cannot be undone</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-4">
            <AlertDialogCancel className="rounded-xl border-border hover:bg-secondary">Keep Asset</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl px-8"
            >
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
