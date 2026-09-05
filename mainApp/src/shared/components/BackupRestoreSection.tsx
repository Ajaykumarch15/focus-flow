import { useState, useRef } from 'react';
import { Download, Upload, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '@shared/utils/api';
import {
  downloadBackup,
  parseBackupFile,
  validateBackup,
} from '@shared/utils/backup';
import { useStore } from '@worklog/services/useStore';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import { useWorkLogStore } from '@worklog/services/useWorkLogStore';
import { useRoadmapStore } from '@personal/services/useRoadmapStore';
import { useScheduleStore } from '@worklog/services/useScheduleStore';
import { useHabitStore } from '@worklog/services/useHabitStore';
import { Button } from '@shared/components/ui/Button';
import { ConfirmDialog } from '@shared/components/ui/ConfirmDialog';
import type { FocusFlowBackup } from '@shared/types/backup';

export function BackupRestoreSection() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<FocusFlowBackup | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const backup = await api.backup.exportData();
      downloadBackup(backup);
    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setImportResult(null);

    try {
      const backup = await parseBackupFile(file);
      const { valid, error: validationError } = validateBackup(backup);
      if (!valid) {
        setError(validationError || 'Invalid backup file');
        return;
      }
      setPendingBackup(backup);
      setConfirmImport(true);
    } catch (err: any) {
      setError(err.message || 'Failed to parse backup file');
    }

    if (fileRef.current) fileRef.current.value = '';
  };

  const handleConfirmImport = async () => {
    if (!pendingBackup) return;
    setConfirmImport(false);
    setImporting(true);
    setError(null);

    try {
      const result = await api.backup.importData(pendingBackup);
      setImportResult([
        `Imported: ${result.imported.tasks} tasks, ${result.imported.journals} journals, ${result.imported.personalTasks} personal tasks`,
        `${result.imported.activeLogs + result.imported.closedLogs} work logs, ${result.imported.roadmaps} roadmaps`,
        `${result.imported.schedules} schedules, ${result.imported.habits} habits, ${result.imported.projects} projects`,
      ]);

      // Re-fetch all stores
      useStore.getState().loadAll();
      usePersonalTaskStore.getState().fetchTasks();
      useWorkLogStore.getState().loadAll();
      useRoadmapStore.getState().loadRoadmaps();
      useScheduleStore.getState().fetchSchedules();
      useHabitStore.getState().loadHabits();
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setImporting(false);
      setPendingBackup(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-surface-400">
        Export all your FocusFlow data as a single backup file, or import a previous backup.
        Importing merges new data without overwriting existing items.
      </p>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {importResult && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
          <Check size={14} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold mb-1">Backup imported successfully</p>
            {importResult.map((line, i) => <p key={i}>{line}</p>)}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={handleExport}
          disabled={exporting}
          leftIcon={exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        >
          {exporting ? 'Exporting…' : 'Export Full Backup'}
        </Button>

        <Button
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          leftIcon={importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        >
          {importing ? 'Importing…' : 'Import from Backup'}
        </Button>

        <input
          ref={fileRef}
          type="file"
          accept=".ffbackup.json,.json"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      <ConfirmDialog
        isOpen={confirmImport}
        title="Import Backup"
        message={
          pendingBackup
            ? `This backup was exported on ${new Date(pendingBackup.exportedAt).toLocaleDateString()}. Existing data will NOT be overwritten — only new items will be added. Continue?`
            : ''
        }
        confirmLabel="Import"
        variant="primary"
        onConfirm={handleConfirmImport}
        onCancel={() => { setConfirmImport(false); setPendingBackup(null); }}
      />
    </div>
  );
}
