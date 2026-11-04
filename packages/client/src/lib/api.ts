import axios from 'axios';
import type { BackupResult, BackupStatus } from '@networth/shared';

// Shared axios instance for platform-level API calls
const api = axios.create({ baseURL: '/api' });

export const fetchHealth = () => api.get<{ status: string; timestamp: string }>('/health').then((r) => r.data);

export const fetchBackupStatus = () => api.get<BackupStatus>('/system/backup/status').then((r) => r.data);

export const runBackup = () => api.post<BackupResult>('/system/backup', { upload: true }).then((r) => r.data);

export default api;
