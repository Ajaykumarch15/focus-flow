import { useState } from 'react';
import { Copy, ExternalLink, Check } from 'lucide-react';
import { cn } from '@shared/utils/cn';

interface MeetingLinkFieldProps {
  link: string;
  platform: string;
  className?: string;
}

function getPlatformLabel(platform: string): string {
  switch (platform) {
    case 'google_meet': return 'Google Meet';
    case 'zoom': return 'Zoom';
    case 'teams': return 'Teams';
    default: return 'Meeting';
  }
}

export function MeetingLinkField({ link, platform, className }: MeetingLinkFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(`https://${link}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!link) {
    return (
      <div className={cn('space-y-1.5', className)}>
        <label className="text-xs font-semibold text-surface-400">Link</label>
        <p className="text-xs text-surface-400">No link generated</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="text-xs font-semibold text-surface-400">Link</label>
      <div className="flex items-center gap-2">
        <div className="flex-1 truncate rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 font-mono text-xs text-surface-600 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-300">
          {link}
        </div>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded-lg border border-surface-200 p-2 text-surface-400 hover:bg-surface-100 hover:text-surface-600 dark:border-surface-700 dark:hover:bg-surface-800 dark:hover:text-surface-300"
          title="Copy link"
        >
          {copied ? <Check size={14} className="text-success-500" /> : <Copy size={14} />}
        </button>
        <a
          href={`https://${link}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg border border-surface-200 p-2 text-surface-400 hover:bg-surface-100 hover:text-brand-500 dark:border-surface-700 dark:hover:bg-surface-800"
          title={`Open in ${getPlatformLabel(platform)}`}
        >
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
