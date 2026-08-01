import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, FileText, Code, Sparkles, Copy, Check, X } from 'lucide-react';
import { WorkLog } from '../../store/useWorkLogStore';
import { downloadWorkLogMarkdown, downloadWorkLogJSON, generateAIStandupSummary } from '../../utils/workLogExporter';
import { toast } from '../../store/useToastStore';

interface WorkLogExporterModalProps {
  workLog: WorkLog;
  isOpen: boolean;
  onClose: () => void;
}

export function WorkLogExporterModal({ workLog, isOpen, onClose }: WorkLogExporterModalProps) {
  const [copiedAI, setCopiedAI] = useState(false);
  const aiSummary = generateAIStandupSummary(workLog);

  if (!isOpen) return null;

  const handleCopyAI = () => {
    navigator.clipboard.writeText(aiSummary);
    setCopiedAI(true);
    toast.success('Copied to Clipboard', 'AI standup summary copied successfully.');
    setTimeout(() => setCopiedAI(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          className="card p-6 rounded-3xl border border-surface-800 bg-surface-900 max-w-lg w-full space-y-6 shadow-2xl relative"
        >
          <button onClick={onClose} className="absolute right-4 top-4 text-surface-500 hover:text-surface-200">
            <X size={18} />
          </button>

          <div>
            <h3 className="text-lg font-bold text-surface-50 flex items-center gap-2">
              <Download size={20} className="text-brand-400" />
              Export Work Journal & AI Reports
            </h3>
            <p className="text-xs text-surface-400 mt-0.5">
              Export "{workLog.title}" in professional developer formats.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => { downloadWorkLogMarkdown(workLog); toast.success('Exported Markdown', 'Downloaded .md file'); }}
              className="p-4 rounded-2xl bg-surface-850 hover:bg-surface-800 border border-surface-750 text-left transition-all group"
            >
              <FileText size={20} className="text-brand-400 mb-2 group-hover:scale-110 transition-transform" />
              <div className="text-sm font-semibold text-surface-50">Markdown (.md)</div>
              <div className="text-xs text-surface-400">Standard engineering journal doc</div>
            </button>

            <button
              onClick={() => { downloadWorkLogJSON(workLog); toast.success('Exported JSON', 'Downloaded .json file'); }}
              className="p-4 rounded-2xl bg-surface-850 hover:bg-surface-800 border border-surface-750 text-left transition-all group"
            >
              <Code size={20} className="text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
              <div className="text-sm font-semibold text-surface-50">Structured JSON</div>
              <div className="text-xs text-surface-400">Complete raw work data backup</div>
            </button>
          </div>

          {/* AI Ready Standup Prompt Box */}
          <div className="card p-4 rounded-2xl border border-amber-500/20 bg-surface-850 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles size={14} /> AI Ready Daily Standup Summary
              </span>
              <button
                onClick={handleCopyAI}
                className="btn-secondary text-[11px] px-2.5 py-1 flex items-center gap-1"
              >
                {copiedAI ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                {copiedAI ? 'Copied' : 'Copy'}
              </button>
            </div>
            <textarea
              readOnly
              className="input text-xs font-mono w-full resize-none rounded-xl bg-surface-900 text-surface-300 leading-relaxed"
              rows={6}
              value={aiSummary}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
