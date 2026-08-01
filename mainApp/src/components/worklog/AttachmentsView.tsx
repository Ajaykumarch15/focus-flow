import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Paperclip, Link2, Plus, Trash2, ExternalLink, FileText, Image as ImageIcon, Folder } from 'lucide-react';
import { WorkLog, WorkLink, WorkAttachment, useWorkLogStore } from '../../store/useWorkLogStore';

interface AttachmentsViewProps {
  workLog: WorkLog;
}

const LINK_CATEGORIES: WorkLink['category'][] = [
  'Figma', 'GitHub', 'Jira', 'Linear', 'Documentation', 'API', 'Database', 'PR', 'Meeting Notes', 'General'
];

export function AttachmentsView({ workLog }: AttachmentsViewProps) {
  const { addLink, deleteLink, addAttachment, deleteAttachment } = useWorkLogStore();
  const [showAddLink, setShowAddLink] = useState(false);
  const [showAddAtt, setShowAddAtt] = useState(false);

  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkCat, setLinkCat] = useState<WorkLink['category']>('General');

  const [attName, setAttName] = useState('');
  const [attUrl, setAttUrl] = useState('');
  const [attType, setAttType] = useState('image');
  const [attDesc, setAttDesc] = useState('');

  const links = workLog.links || [];
  const attachments = workLog.attachments || [];

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTitle.trim() || !linkUrl.trim()) return;
    await addLink(workLog._id, linkTitle, linkUrl, linkCat);
    setLinkTitle('');
    setLinkUrl('');
    setShowAddLink(false);
  };

  const handleAddAtt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attName.trim() || !attUrl.trim()) return;
    await addAttachment(workLog._id, {
      name: attName,
      url: attUrl,
      type: attType,
      sizeBytes: 1024 * 256,
      description: attDesc,
    });
    setAttName('');
    setAttUrl('');
    setAttDesc('');
    setShowAddAtt(false);
  };

  return (
    <div className="space-y-8">
      {/* Categorized Important Links */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-surface-50 flex items-center gap-2">
              <Link2 size={18} className="text-brand-400" />
              Categorized Reference Links
            </h3>
            <p className="text-xs text-surface-400">
              Quick links to PRs, Figma designs, Linear tickets, API docs, or meeting notes.
            </p>
          </div>
          <button
            onClick={() => setShowAddLink(true)}
            className="btn-primary text-xs flex items-center gap-1.5 px-3 py-1.5"
          >
            <Plus size={14} /> Add Link
          </button>
        </div>

        <AnimatePresence>
          {showAddLink && (
            <motion.form
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              onSubmit={handleAddLink}
              className="card p-4 rounded-xl border border-brand-500/30 bg-surface-850 space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  className="input text-sm rounded-lg"
                  placeholder="Link Title (e.g., Pull Request #42)"
                  value={linkTitle} onChange={e => setLinkTitle(e.target.value)} required
                />
                <input
                  className="input text-sm rounded-lg"
                  placeholder="URL (https://...)"
                  value={linkUrl} onChange={e => setLinkUrl(e.target.value)} required
                />
                <select
                  className="input text-sm rounded-lg"
                  value={linkCat} onChange={e => setLinkCat(e.target.value as any)}
                >
                  {LINK_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddLink(false)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                <button type="submit" className="btn-primary text-xs px-4 py-1.5">Save Link</button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {links.map(l => (
            <div key={l._id} className="card p-3 rounded-xl border border-surface-800 bg-surface-900/60 flex items-center justify-between group">
              <a href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 min-w-0 flex-1 hover:text-brand-400 transition-colors">
                <ExternalLink size={14} className="text-surface-400 flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-surface-100 truncate block">{l.label}</span>
                  <span className="badge bg-surface-800 text-surface-400 text-[9px] mt-0.5">{l.category}</span>
                </div>
              </a>
              <button
                onClick={() => deleteLink(workLog._id, l._id)}
                className="p-1 text-surface-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Attachments Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-surface-50 flex items-center gap-2">
              <Paperclip size={18} className="text-purple-400" />
              Attachments & Screenshots
            </h3>
            <p className="text-xs text-surface-400">
              Attach design assets, architecture diagrams, test outputs, or screenshots.
            </p>
          </div>
          <button
            onClick={() => setShowAddAtt(true)}
            className="btn-primary text-xs flex items-center gap-1.5 px-3 py-1.5"
          >
            <Plus size={14} /> Add Attachment
          </button>
        </div>

        <AnimatePresence>
          {showAddAtt && (
            <motion.form
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              onSubmit={handleAddAtt}
              className="card p-4 rounded-xl border border-purple-500/30 bg-surface-850 space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  className="input text-sm rounded-lg"
                  placeholder="Asset Name (e.g., Auth Flow Diagram)"
                  value={attName} onChange={e => setAttName(e.target.value)} required
                />
                <input
                  className="input text-sm rounded-lg"
                  placeholder="URL / File Link"
                  value={attUrl} onChange={e => setAttUrl(e.target.value)} required
                />
                <select
                  className="input text-sm rounded-lg"
                  value={attType} onChange={e => setAttType(e.target.value)}
                >
                  <option value="image">Screenshot / Image</option>
                  <option value="diagram">Diagram / Design</option>
                  <option value="pdf">PDF / Document</option>
                  <option value="code">Code Snippet / Log</option>
                </select>
              </div>
              <input
                className="input text-sm rounded-lg w-full"
                placeholder="Description / Context..."
                value={attDesc} onChange={e => setAttDesc(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddAtt(false)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                <button type="submit" className="btn-primary text-xs px-4 py-1.5">Add Attachment</button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {attachments.map(a => (
            <div key={a._id} className="card p-4 rounded-xl border border-surface-800 bg-surface-900/60 flex items-start justify-between gap-3 group">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 mt-0.5">
                  <Folder size={18} />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <a href={a.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-surface-100 hover:text-brand-400 truncate block">
                    {a.name}
                  </a>
                  {a.description && <p className="text-xs text-surface-400 truncate">{a.description}</p>}
                  <span className="badge bg-surface-800 text-surface-400 text-[9px]">{a.type}</span>
                </div>
              </div>
              <button
                onClick={() => deleteAttachment(workLog._id, a._id)}
                className="p-1 text-surface-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
