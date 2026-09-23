"use client";

import * as React from "react";
import { Download, Eye, FileText } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";

export interface DocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  fileUrl?: string;
  mimeType?: string;
  metadata?: Record<string, any>;
  onDownload?: () => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  isOpen,
  onClose,
  title,
  fileUrl,
  mimeType = "application/pdf",
  metadata,
  onDownload,
}) => {
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType.includes("pdf");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title={
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" />
          <span className="truncate max-w-md">{title}</span>
        </div>
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          {onDownload && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={onDownload}
            >
              Download Decrypted File
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4 text-left">
        {/* Document Preview Area */}
        <div className="w-full h-80 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-center overflow-hidden">
          {fileUrl ? (
            isImage ? (
              <img src={fileUrl} alt={title} className="max-h-full max-w-full object-contain" />
            ) : isPdf ? (
              <iframe src={fileUrl} className="w-full h-full border-none" title={title} />
            ) : (
              <div className="text-center p-6 space-y-2">
                <FileText className="w-12 h-12 text-zinc-500 mx-auto" />
                <p className="text-xs text-zinc-400">
                  Preview not supported for mime type: {mimeType}
                </p>
              </div>
            )
          ) : (
            <div className="text-center p-6 space-y-2">
              <Eye className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-xs text-zinc-500">Document ready for decryption.</p>
            </div>
          )}
        </div>

        {/* Extracted Metadata / OCR Attributes */}
        {metadata && Object.keys(metadata).length > 0 && (
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3.5 space-y-2">
            <h5 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Document Attributes & OCR Verification
            </h5>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(metadata).map(([key, value]) => (
                <div key={key} className="flex flex-col">
                  <span className="text-zinc-500 capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                  <span className="font-medium text-zinc-200 truncate">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
