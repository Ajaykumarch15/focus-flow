import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Paperclip, Upload, X, File, Image, FileText } from 'lucide-react';

interface TaskAttachmentsSectionProps {
  attachments?: Array<{ id: string; name: string; type: string; url: string }>;
}

export function TaskAttachmentsSection({ attachments = [] }: TaskAttachmentsSectionProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [files, setFiles] = useState(attachments);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (newFiles: File[]) => {
    const mapped = newFiles.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      type: f.type,
      url: URL.createObjectURL(f),
    }));
    setFiles((prev) => [...prev, ...mapped]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image size={14} className="text-blue-400" />;
    if (type.includes('pdf')) return <FileText size={14} className="text-red-400" />;
    return <File size={14} className="text-surface-400" />;
  };

  return (
    <div
      id="section-attachments"
      className="rounded-2xl border border-surface-800 bg-surface-900 p-5"
    >
      <h3 className="flex items-center gap-2 text-sm font-bold text-surface-100 mb-4">
        <Paperclip size={15} className="text-brand-400" />
        Attachments
      </h3>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center gap-2 py-8 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
          isDragOver
            ? 'border-brand-500 bg-brand-500/5'
            : 'border-surface-700 hover:border-surface-600 hover:bg-surface-850/50'
        }`}
      >
        <Upload size={20} className={`${isDragOver ? 'text-brand-400' : 'text-surface-500'}`} />
        <div className="text-center">
          <p className="text-xs font-medium text-surface-400">
            Drop files here or click to upload
          </p>
          <p className="text-[10px] text-surface-600 mt-0.5">
            Images, documents, or any relevant files
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* File list */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex flex-col gap-1.5 mt-3"
          >
            {files.map((file) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-850/50 border border-surface-800 group"
              >
                {getFileIcon(file.type)}
                <span className="flex-1 text-xs text-surface-300 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-surface-600 hover:text-red-400 transition-all"
                >
                  <X size={12} />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
