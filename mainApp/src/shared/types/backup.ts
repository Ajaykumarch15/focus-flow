export interface FocusFlowBackup {
  version: 1;
  exportedAt: string;
  exportedBy: string;
  checksum: string;
  data: BackupData;
}

export interface BackupData {
  profile: Record<string, any>;
  theme: Record<string, any>;
  tasks: any[];
  journals: any[];
  personalTasks: any[];
  workLogs: {
    activeLogs: any[];
    closedLogs: any[];
  };
  roadmaps: any[];
  schedules: any[];
  habits: any[];
  projects: any[];
  workspacePreference: string;
}

export interface BackupImportResult {
  imported: {
    tasks: number;
    journals: number;
    personalTasks: number;
    activeLogs: number;
    closedLogs: number;
    roadmaps: number;
    schedules: number;
    habits: number;
    projects: number;
  };
}
