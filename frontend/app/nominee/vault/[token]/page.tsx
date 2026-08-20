"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import {
    FileText,
    KeyRound,
    ImageIcon,
    Video,
    StickyNote,
    Download,
    Eye,
    EyeOff,
    Shield,
    Loader2,
    Lock,
    ArrowLeft,
    Search,
    Filter,
    X,
    FileCheck
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

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

import { API_BASE, BASE_URL } from "@/lib/api"

export default function NomineeVaultPage() {
    const params = useParams()
    const router = useRouter()
    const token = params.token as string

    const [loading, setLoading] = useState(true)
    const [assets, setAssets] = useState<any[]>([])
    const [ownerName, setOwnerName] = useState("")
    const [search, setSearch] = useState("")
    const [filterType, setFilterType] = useState<string>("all")
    const [viewAsset, setViewAsset] = useState<any | null>(null)
    const [showPassword, setShowPassword] = useState<Record<string, boolean>>({})

    useEffect(() => {
        const fetchAssets = async () => {
            const sessionToken = sessionStorage.getItem(`sv_nominee_token_${token}`)
            if (!sessionToken) {
                toast.error("Session expired. Please verify again.")
                router.push(`/nominee/verify/${token}`)
                return
            }

            try {
                const response = await fetch(`${BASE_URL}/nominees/assets/${sessionToken}`)
                const data = await response.json()

                if (response.ok) {
                    setAssets(data.assets)
                    setOwnerName(data.ownerName)
                } else {
                    toast.error(data.error || "Access denied")
                    router.push(`/nominee/verify/${token}`)
                }
            } catch (error) {
                toast.error("Failed to fetch vault assets")
            } finally {
                setLoading(false)
            }
        }
        fetchAssets()
    }, [token, router])

    const filteredAssets = assets.filter((a) => {
        const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
            (a.description?.toLowerCase().includes(search.toLowerCase()))
        const matchesType = filterType === "all" || a.type === filterType
        return matchesSearch && matchesType
    })

    const getAssetUrl = (path: string) => {
        const sessionToken = sessionStorage.getItem(`sv_nominee_token_${token}`)
        return `${API_BASE}${path}${sessionToken ? `?token=${sessionToken}` : ""}`
    }
    const togglePassword = (id: string) => setShowPassword(prev => ({ ...prev, [id]: !prev[id] }))

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm font-medium text-muted-foreground">Decrypting assigned assets...</p>
                </div>
            </div>
        )
    }

    return (
        <main className="min-h-screen bg-background">
            {/* Header / Navigation */}
            <div className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
                <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                                <Shield className="h-6 w-6 text-primary-foreground" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-foreground">SecureVault Inheritance</h1>
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Verified Nominee Access</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="hidden sm:block text-right">
                                <p className="text-xs text-muted-foreground font-medium">Account Owner</p>
                                <p className="text-sm font-bold text-foreground">{ownerName}</p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    sessionStorage.removeItem(`sv_nominee_token_${token}`)
                                    router.push("/")
                                }}
                                className="gap-2 border-border/50"
                            >
                                <Lock className="h-4 w-4" /> Sign Out
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {/* Hero / Info */}
                <div className="mb-10 text-center sm:text-left">
                    <h2 className="text-3xl font-extrabold text-foreground tracking-tight sm:text-4xl">Your Inherited Vault</h2>
                    <p className="mt-2 text-muted-foreground max-w-2xl leading-relaxed">
                        The account owner, {ownerName}, has designated you as the inheritor for the following assets.
                        Each item here is securely encrypted and only accessible via your verified session.
                    </p>
                </div>

                {/* Filters */}
                <div className="mb-8 flex flex-col gap-4 sm:flex-row bg-card/40 p-3 rounded-2xl border border-border/50 backdrop-blur-sm">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Search assigned assets..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-background/50 border-border/40 text-foreground pl-10 focus-visible:ring-primary/20"
                        />
                    </div>
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="w-full sm:w-[200px] bg-background/50 border-border/40 text-foreground">
                            <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                            <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                            <SelectItem value="all">All Categories</SelectItem>
                            {Object.entries(typeLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Grid */}
                {filteredAssets.length > 0 ? (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filteredAssets.map((asset) => {
                            const Icon = typeIcons[asset.type] || FileText
                            const isFile = !!asset.filePaths

                            return (
                                <Card
                                    key={asset.id}
                                    className="group relative overflow-hidden border-border/50 bg-card/40 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 active:scale-[0.98]"
                                >
                                    {/* Preview Area */}
                                    <div className="relative aspect-video w-full overflow-hidden bg-muted/20">
                                        {asset.type === "image" && asset.filePaths ? (
                                            <img
                                                src={getAssetUrl(asset.filePaths)}
                                                alt={asset.name}
                                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                                            />
                                        ) : asset.type === "video" && asset.filePaths ? (
                                            <div className="relative h-full w-full">
                                                <video src={getAssetUrl(asset.filePaths)} className="h-full w-full object-cover" />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                                    <Video className="h-10 w-10 text-white/80" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center">
                                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/5 text-primary/40 group-hover:bg-primary/10 group-hover:text-primary/60 transition-all">
                                                    <Icon className="h-8 w-8" />
                                                </div>
                                            </div>
                                        )}

                                        <div className="absolute left-3 top-3">
                                            <span className="inline-flex items-center rounded-lg bg-black/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md border border-white/10">
                                                {typeLabels[asset.type]}
                                            </span>
                                        </div>

                                        <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                size="icon"
                                                variant="secondary"
                                                className="h-8 w-8 rounded-full bg-black/60 text-white border-white/10 hover:bg-primary hover:text-white"
                                                onClick={() => setViewAsset(asset)}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <CardContent className="flex flex-col gap-3 p-5">
                                        <div onClick={() => setViewAsset(asset)} className="cursor-pointer">
                                            <h3 className="font-bold text-foreground leading-tight group-hover:text-primary transition-colors">{asset.name}</h3>
                                            <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                                                {asset.description || "No description provided"}
                                            </p>
                                        </div>

                                        {asset.type === "password" && (
                                            <div className="mt-1 flex items-center justify-between rounded-lg bg-secondary/50 p-2 border border-border/40">
                                                <code className="text-[11px] font-mono text-primary truncate max-w-[120px]">
                                                    {showPassword[asset.id] ? asset.content : "••••••••••••"}
                                                </code>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors"
                                                    onClick={(e) => { e.stopPropagation(); togglePassword(asset.id); }}
                                                >
                                                    {showPassword[asset.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                                </Button>
                                            </div>
                                        )}

                                        <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-3 text-[10px] font-medium text-muted-foreground">
                                            <span className="flex items-center gap-1"><FileCheck className="h-3 w-3 text-success" /> Encrypted Vault Access</span>
                                            <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                ) : (
                    <div className="flex h-80 flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border/50 bg-card/20 backdrop-blur-sm">
                        <Lock className="h-12 w-12 text-muted-foreground/20" />
                        <div className="text-center">
                            <p className="text-lg font-bold text-foreground">No Assets Found</p>
                            <p className="text-sm text-muted-foreground">There are no assets matching your criteria in this inherited vault.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Asset Detail View Modal (Read-Only) */}
            {viewAsset && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-300"
                    onClick={() => setViewAsset(null)}
                >
                    <Card
                        className="relative w-full max-w-2xl overflow-hidden border-border bg-card shadow-2xl animate-in zoom-in-95 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setViewAsset(null)}
                            className="absolute right-4 top-4 z-10 rounded-full bg-black/20 p-2 text-white/70 hover:bg-black/40 hover:text-white transition-all ring-1 ring-white/10"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        <div className="grid md:grid-cols-2">
                            <div className="bg-muted/30 flex items-center justify-center bg-gradient-to-br from-primary/10 to-transparent border-r border-border/50 min-h-[350px]">
                                {viewAsset.type === "image" && viewAsset.filePaths ? (
                                    <img src={getAssetUrl(viewAsset.filePaths)} alt={viewAsset.name} className="h-full w-full object-contain p-4" />
                                ) : viewAsset.type === "video" && viewAsset.filePaths ? (
                                    <video src={getAssetUrl(viewAsset.filePaths)} controls autoPlay className="h-full w-full object-contain" />
                                ) : (viewAsset.type === "document" || viewAsset.type === "legal-file") && viewAsset.filePaths ? (
                                    <iframe
                                        src={getAssetUrl(viewAsset.filePaths)}
                                        title={viewAsset.name}
                                        className="h-full w-full min-h-[350px] w-full border-none rounded-l-xl bg-slate-950/20"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center gap-4 py-20">
                                        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                                            {(() => {
                                                const VIcon = typeIcons[viewAsset.type] || FileText
                                                return <VIcon className="h-12 w-12" />
                                            })()}
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-widest text-primary/60">{typeLabels[viewAsset.type]}</span>
                                    </div>
                                )}
                            </div>

                            <div className="p-8 flex flex-col justify-between gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="inline-flex items-center rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400 border border-emerald-500/20">
                                                View-Only Access
                                            </span>
                                            {viewAsset.filePaths && (
                                                <span className="inline-flex items-center rounded-lg bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-400 border border-blue-500/20">
                                                    Encrypted Stream
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="text-2xl font-extrabold text-foreground leading-tight">{viewAsset.name}</h2>
                                        <p className="mt-2 text-sm text-muted-foreground leading-relaxed italic border-l-2 border-primary/30 pl-3">
                                            {viewAsset.description || "No description provided."}
                                        </p>
                                    </div>

                                    {viewAsset.content && (
                                        <div className="rounded-xl border border-border/50 bg-secondary/30 p-4">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                                {viewAsset.type === "password" ? "Secure Password" : "Inherited Note"}
                                            </p>
                                            <div className="flex items-center justify-between gap-2">
                                                {viewAsset.type === "password" ? (
                                                    <>
                                                        <code className="text-sm font-mono text-primary break-all">
                                                            {showPassword[viewAsset.id] ? viewAsset.content : "••••••••••••••••"}
                                                        </code>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 hover:bg-primary/5" onClick={() => togglePassword(viewAsset.id)}>
                                                            {showPassword[viewAsset.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <p className="text-sm text-foreground whitespace-pre-wrap">{viewAsset.content}</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    <Button size="lg" className="w-full gap-2 rounded-xl" onClick={() => setViewAsset(null)}>
                                        Close Preview
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </main>
    )
}
