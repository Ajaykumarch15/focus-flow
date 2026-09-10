import { Upload, FileText, Image, Film } from 'lucide-react';

interface MeetingMediaTabProps {
  meetingId: string;
  canEdit?: boolean;
}

export function MeetingMediaTab({ canEdit = false }: MeetingMediaTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-surface-400">Media & Attachments</label>
        {canEdit && (
          <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-brand-500 hover:bg-brand-500/10">
            <Upload size={12} />
            Upload
          </button>
        )}
      </div>

      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-300 py-12 dark:border-surface-700">
        <Upload size={32} className="mb-3 text-surface-300 dark:text-surface-600" />
        <p className="text-sm font-medium text-surface-400">No attachments yet</p>
        <p className="text-xs text-surface-400">Upload files, recordings, or presentations</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button className="flex flex-col items-center gap-1 rounded-lg border border-surface-200 p-3 text-surface-400 hover:border-brand-500/30 hover:text-brand-500 dark:border-surface-700">
          <FileText size={20} />
          <span className="text-[10px]">Documents</span>
        </button>
        <button className="flex flex-col items-center gap-1 rounded-lg border border-surface-200 p-3 text-surface-400 hover:border-brand-500/30 hover:text-brand-500 dark:border-surface-700">
          <Image size={20} />
          <span className="text-[10px]">Images</span>
        </button>
        <button className="flex flex-col items-center gap-1 rounded-lg border border-surface-200 p-3 text-surface-400 hover:border-brand-500/30 hover:text-brand-500 dark:border-surface-700">
          <Film size={20} />
          <span className="text-[10px]">Recordings</span>
        </button>
      </div>
    </div>
  );
}
