import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, FileText, Download, FileCode2, Loader2, Check,
  Maximize2, Minimize2,
} from 'lucide-react';
import type { WorkLog } from '@worklog/services/useWorkLogStore';
import { mapWorkLogToDocument, renderDeveloperDoc, exportToPdf, exportToDocx } from '@worklog/services/docEngine';

interface DocumentationPreviewProps {
  log: WorkLog;
  open: boolean;
  onClose: () => void;
}

export function DocumentationPreview({ log, open, onClose }: DocumentationPreviewProps) {
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);
  const [exported, setExported] = useState<'pdf' | 'docx' | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const doc = mapWorkLogToDocument(log);
  const html = renderDeveloperDoc(doc);
  const filename = log.title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').toLowerCase();

  useEffect(() => {
    if (!open) {
      setExporting(null);
      setExported(null);
      setFullscreen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  useEffect(() => {
    if (iframeRef.current && open) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
      }
    }
  }, [html, open]);

  const handleExportPdf = async () => {
    setExporting('pdf');
    setExported(null);
    try {
      const iframeBody = iframeRef.current?.contentDocument?.body;
      await exportToPdf(html, filename, iframeBody || undefined);
      setExported('pdf');
      setTimeout(() => setExported(null), 2500);
    } catch (e) {
      console.error('PDF export failed:', e);
    } finally {
      setExporting(null);
    }
  };

  const handleExportDocx = async () => {
    setExporting('docx');
    setExported(null);
    try {
      await exportToDocx(doc, filename);
      setExported('docx');
      setTimeout(() => setExported(null), 2500);
    } catch (e) {
      console.error('DOCX export failed:', e);
    } finally {
      setExporting(null);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            onClick={e => e.stopPropagation()}
            className={`bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden ${
              fullscreen ? 'fixed inset-2 z-10' : 'relative w-full max-w-6xl h-[85vh]'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-700/60 bg-surface-900/80 backdrop-blur-sm flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
                  <FileText size={15} className="text-brand-400" />
                </div>
                <div>
                  <h2 className="text-sm font-display font-bold text-surface-50">Documentation Preview</h2>
                  <p className="text-[11px] text-surface-400">{log.title}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* PDF Export */}
                <button
                  onMouseDown={e => e.preventDefault()}
                  onClick={handleExportPdf}
                  disabled={exporting === 'pdf'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all
                    bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting === 'pdf' ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : exported === 'pdf' ? (
                    <Check size={12} />
                  ) : (
                    <Download size={12} />
                  )}
                  PDF
                </button>

                {/* DOCX Export */}
                <button
                  onMouseDown={e => e.preventDefault()}
                  onClick={handleExportDocx}
                  disabled={exporting === 'docx'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all
                    bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/30
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting === 'docx' ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : exported === 'docx' ? (
                    <Check size={12} />
                  ) : (
                    <FileCode2 size={12} />
                  )}
                  DOCX
                </button>

                <div className="w-px h-5 bg-surface-700 mx-1" />

                {/* Fullscreen */}
                <button
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => setFullscreen(f => !f)}
                  className="p-1.5 rounded-lg text-surface-400 hover:text-surface-50 hover:bg-surface-700/60 transition-all"
                  title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>

                {/* Close */}
                <button
                  onMouseDown={e => e.preventDefault()}
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-surface-400 hover:text-surface-50 hover:bg-surface-700/60 transition-all"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Preview Area */}
            <div className="flex-1 overflow-hidden bg-white">
              <iframe
                ref={iframeRef}
                title="Documentation Preview"
                className="w-full h-full border-0"
                sandbox="allow-same-origin"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
