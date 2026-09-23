"use client";

import * as React from "react";
import { UploadCloud, File, X, CheckCircle2 } from "lucide-react";

export interface FileUploaderProps {
  label?: string;
  accept?: string;
  maxSizeMB?: number;
  onFileSelect: (file: File | null) => void;
  selectedFile?: File | null;
  error?: string;
  className?: string;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  label = "Upload Secure File",
  accept,
  maxSizeMB = 50,
  onFileSelect,
  selectedFile,
  error,
  className = "",
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    setLocalError(null);
    if (!files || files.length === 0) return;
    const file = files[0];

    if (file.size > maxSizeMB * 1024 * 1024) {
      setLocalError(`File size exceeds maximum allowed limit of ${maxSizeMB}MB`);
      onFileSelect(null);
      return;
    }

    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const displayError = error || localError;

  return (
    <div className={`w-full space-y-1.5 text-left ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-zinc-300">{label}</label>
      )}

      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
          isDragging
            ? "border-purple-500 bg-purple-950/20"
            : selectedFile
            ? "border-emerald-500/40 bg-emerald-950/10"
            : displayError
            ? "border-red-500/60 bg-red-950/10"
            : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {selectedFile ? (
          <div className="flex items-center justify-between w-full p-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <File className="w-5 h-5" />
              </div>
              <div className="text-left overflow-hidden">
                <p className="text-xs font-medium text-zinc-200 truncate max-w-xs">
                  {selectedFile.name}
                </p>
                <p className="text-[10px] text-zinc-400">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Ready for encryption
                </p>
              </div>
            </div>
            <button
              onClick={clearFile}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="p-3 rounded-2xl bg-zinc-800/60 border border-zinc-700/50 text-purple-400 mb-2.5">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-xs font-medium text-zinc-200">
              Click to browse or drag and drop file here
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Encrypted with AES-256 upon upload • Max {maxSizeMB}MB
            </p>
          </>
        )}
      </div>

      {displayError && <p className="text-xs text-red-400 font-medium">{displayError}</p>}
    </div>
  );
};
