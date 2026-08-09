"use client"

import { useState, useEffect } from "react"
import { ExternalLink, FileText, Image as ImageIcon, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { secureAdminFetch } from "@/lib/admin-api"

interface VerificationDocumentViewerProps {
  url: string | null
  mimeType?: string
  fileName?: string
  label: string
}

export function VerificationDocumentViewer({
  url,
  mimeType,
  fileName = "Document",
  label,
}: VerificationDocumentViewerProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [detectedMime, setDetectedMime] = useState<string>(mimeType || "application/pdf")

  useEffect(() => {
    if (!url) return

    let active = true
    let createdUrl: string | null = null

    setLoading(true)
    setError(false)

    secureAdminFetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const contentType = res.headers.get("content-type") || ""
        const blob = await res.blob()
        if (!active) return

        const nameLower = (fileName || "").toLowerCase()
        let finalMime = mimeType || contentType || blob.type

        if (
          nameLower.endsWith(".jpeg") ||
          nameLower.endsWith(".jpg") ||
          nameLower.endsWith(".png") ||
          nameLower.endsWith(".webp")
        ) {
          finalMime = "image/jpeg"
        } else if (nameLower.endsWith(".pdf")) {
          finalMime = "application/pdf"
        }

        setDetectedMime(finalMime)
        createdUrl = URL.createObjectURL(blob)
        setObjectUrl(createdUrl)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Error fetching document blob:", err)
        if (active) {
          setError(true)
          setLoading(false)
        }
      })

    return () => {
      active = false
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl)
      }
    }
  }, [url, fileName, mimeType])

  const isPdf = detectedMime.includes("pdf")
  const isImage =
    detectedMime.includes("image") || (fileName && /\.(jpeg|jpg|png|webp|gif)$/i.test(fileName))

  if (!url) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] border-2 border-dashed border-border rounded-xl bg-muted/20">
        <AlertCircle className="w-8 h-8 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No {label} Provided</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {isPdf ? (
            <FileText className="w-4 h-4 text-blue-500" />
          ) : (
            <ImageIcon className="w-4 h-4 text-emerald-500" />
          )}
          {fileName}
        </div>
        <div className="flex gap-2">
          {objectUrl && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
              <a href={objectUrl} target="_blank" rel="noopener noreferrer" download={fileName}>
                <ExternalLink className="w-3.5 h-3.5" />
                Open / Download
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="relative flex-1 min-h-[500px] rounded-xl border border-border overflow-hidden bg-muted/30">
        {loading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm z-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent mb-4" />
            <p className="text-sm text-muted-foreground animate-pulse">Decrypting and loading document...</p>
          </div>
        )}

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="w-8 h-8 text-destructive mb-3" />
            <p className="text-sm font-medium text-destructive">Failed to load document.</p>
            <p className="text-xs text-muted-foreground mt-1">The file might be corrupted, missing, or unauthorized.</p>
          </div>
        ) : objectUrl && isImage ? (
          <div className="w-full h-full flex items-center justify-center p-4">
            <img
              src={objectUrl}
              alt={fileName}
              className="max-w-full max-h-[600px] object-contain rounded-lg shadow-md"
            />
          </div>
        ) : objectUrl && isPdf ? (
          <iframe
            src={objectUrl}
            className="w-full h-full border-none min-h-[500px]"
            title={fileName}
          />
        ) : !loading && objectUrl ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <FileText className="w-8 h-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">Unsupported File Type</p>
            <p className="text-xs text-muted-foreground mt-1">{detectedMime}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

