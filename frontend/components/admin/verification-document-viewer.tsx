"use client"

import { useState } from "react"
import { ExternalLink, Maximize2, FileText, Image as ImageIcon, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface VerificationDocumentViewerProps {
  url: string | null
  mimeType?: string
  fileName?: string
  label: string
}

export function VerificationDocumentViewer({
  url,
  mimeType = "application/pdf",
  fileName = "Document",
  label,
}: VerificationDocumentViewerProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const isPdf = mimeType.includes("pdf")
  const isImage = mimeType.includes("image")

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
          <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5" />
              Open In New Tab
            </a>
          </Button>
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
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive mb-3" />
            <p className="text-sm font-medium text-destructive">Failed to load document.</p>
            <p className="text-xs text-muted-foreground mt-1">The file might be corrupted or missing.</p>
          </div>
        ) : isPdf ? (
          <iframe
            src={url}
            className="w-full h-full border-none"
            title={fileName}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false)
              setError(true)
            }}
          />
        ) : isImage ? (
          <div className="w-full h-full flex items-center justify-center p-4">
            <img
              src={url}
              alt={fileName}
              className="max-w-full max-h-full object-contain rounded-lg"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false)
                setError(true)
              }}
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <FileText className="w-8 h-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">Unsupported File Type</p>
            <p className="text-xs text-muted-foreground mt-1">{mimeType}</p>
          </div>
        )}
      </div>
    </div>
  )
}
