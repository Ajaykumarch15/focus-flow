import { saveAs } from 'file-saver';
import type { FocusFlowBackup, BackupData } from '@shared/types/backup';

export async function computeChecksum(data: BackupData): Promise<string> {
  const json = JSON.stringify(data);
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(json));
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function downloadBackup(backup: FocusFlowBackup): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const date = new Date().toISOString().slice(0, 10);
  saveAs(blob, `focusflow-backup-${date}.ffbackup.json`);
}

export function parseBackupFile(file: File): Promise<FocusFlowBackup> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        resolve(parsed);
      } catch {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function validateBackup(backup: any): { valid: boolean; error?: string } {
  if (!backup || typeof backup !== 'object') {
    return { valid: false, error: 'File is not a valid backup' };
  }
  if (backup.version !== 1) {
    return { valid: false, error: `Unsupported backup version: ${backup.version}` };
  }
  if (!backup.data || typeof backup.data !== 'object') {
    return { valid: false, error: 'Backup is missing data section' };
  }
  const d = backup.data;
  const requiredArrays = ['tasks', 'journals', 'personalTasks', 'schedules', 'habits', 'projects', 'roadmaps'] as const;
  for (const key of requiredArrays) {
    if (!Array.isArray(d[key])) {
      return { valid: false, error: `Backup data.${key} is not an array` };
    }
  }
  if (!d.workLogs || !Array.isArray(d.workLogs.activeLogs) || !Array.isArray(d.workLogs.closedLogs)) {
    return { valid: false, error: 'Backup data.workLogs is invalid' };
  }
  return { valid: true };
}

export function getBackupSummary(d: BackupData): string[] {
  const items: string[] = [];
  if (d.tasks.length) items.push(`${d.tasks.length} task${d.tasks.length !== 1 ? 's' : ''}`);
  if (d.journals.length) items.push(`${d.journals.length} journal entr${d.journals.length !== 1 ? 'ies' : 'y'}`);
  if (d.personalTasks.length) items.push(`${d.personalTasks.length} personal task${d.personalTasks.length !== 1 ? 's' : ''}`);
  const totalLogs = d.workLogs.activeLogs.length + d.workLogs.closedLogs.length;
  if (totalLogs) items.push(`${totalLogs} work log${totalLogs !== 1 ? 's' : ''}`);
  if (d.roadmaps.length) items.push(`${d.roadmaps.length} roadmap${d.roadmaps.length !== 1 ? 's' : ''}`);
  if (d.schedules.length) items.push(`${d.schedules.length} schedule${d.schedules.length !== 1 ? 's' : ''}`);
  if (d.habits.length) items.push(`${d.habits.length} habit${d.habits.length !== 1 ? 's' : ''}`);
  if (d.projects.length) items.push(`${d.projects.length} project${d.projects.length !== 1 ? 's' : ''}`);
  return items;
}
